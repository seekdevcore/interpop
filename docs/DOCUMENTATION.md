# Documentação do Projeto Interpop

Bem-vindo(a) à documentação oficial do **Interpop**. Este documento foi cuidadosamente elaborado para guiar novos e atuais desenvolvedores pela arquitetura do projeto, ajudando a compreender a organização dos arquivos, o funcionamento das principais lógicas e a estrutura do banco de dados, com um foco especial no ecossistema do **Backend**.

---

## 1. Visão Geral da Arquitetura

O projeto **Interpop** segue uma arquitetura baseada em microsserviços lógicos (ou monólito modular) separada em duas partes principais no mesmo repositório (Monorepo):

- **Frontend**: Desenvolvido utilizando **React 19**, **TypeScript** e **Vite**, com roteamento via **React Router DOM v7** e requisições HTTP gerenciadas pelo **Axios**.
- **Backend**: Uma poderosa **API RESTful** construída com **Python**, **Django 5.1.4** e **Django REST Framework (DRF)**.

A raiz do projeto abriga as configurações do frontend (como `package.json` e `vite.config.ts`), além das pastas `src/` (código React) e `backend/` (código Django).

---

## 2. Organização dos Arquivos (Como se achar no projeto)

### 2.1. O Diretório Raiz e Frontend (`/src`)

O desenvolvimento de interface ocorre primariamente na pasta `src/`:

- `src/components/`: Componentes visuais isolados e reutilizáveis (ex: Botões, Modais, Cards).
- `src/pages/`: Componentes maiores que representam rotas/telas inteiras da aplicação.
- `src/services/`: Centralização das chamadas à API (configurações do Axios, interceptadores).
- `src/router/`: Definição das rotas do React Router.
- `src/contexts/` & `src/hooks/`: Gerenciamento de estado global e lógicas customizadas.
- `src/types/`: Interfaces e tipos de TypeScript para padronização de dados.

### 2.2. O Diretório Backend (`/backend`)

Toda a inteligência de negócios da API reside aqui. O backend segue as convenções do Django, mas utiliza uma estrutura de pasta `apps/` para manter a raiz limpa:

- `backend/config/`: Contém os arquivos de configuração central.
  - `config/settings/`: Onde as configurações são divididas (`base.py`, `development.py`, `production.py`). Todas as variáveis sensíveis são chamadas aqui via `python-decouple`.
  - `config/urls.py`: O roteador principal da API. É aqui que todos os endpoints das rotas `/api/` são centralizados.
- `backend/apps/`: Contém os "aplicativos" (módulos) do Django. Cada pasta aqui é autossuficiente, possuindo seus próprios `models.py`, `views.py`, `urls.py` e `serializers.py`:
  - `users/`: Gerencia autenticação, usuários e perfis.
  - `articles/`: Módulo de publicações, categorias e posts.
  - `comments/`: Interações de usuários com os artigos.
  - `moderation/`: Ferramentas administrativas para gerenciar o conteúdo gerado por usuários.
  - `newsletter/`: Sistema de inscrições de e-mail.
  - `audit/`: Sistema de log para rastrear ações sensíveis.

---

## 3. O Backend em Detalhes

O backend do Interpop é desenhado com foco em **segurança**, **modularidade** e **desempenho**.

### 3.1. Tecnologias Essenciais

- **Django REST Framework (DRF)**: Utilizado na serialização de dados (transformar Models em JSON) e criação das Views/Endpoints (Geralmente usando ViewSets e GenericViews).
- **SimpleJWT**: Cuida da emissão e validação de Tokens JWT.
- **Argon2**: Algoritmo de hash de última geração utilizado para proteger as senhas dos usuários.
- **Django-Axes**: Middleware vital para a segurança que previne ataques de Força Bruta (brute-force), bloqueando o IP após um número específico de falhas de login.
- **WhiteNoise**: Middleware utilizado para servir arquivos estáticos de maneira eficiente, especialmente em produção.

### 3.2. Fluxo de Autenticação e Segurança (Função Importante)

O sistema não retorna o token JWT em um JSON puro para ser salvo no `localStorage` do frontend (o que seria uma falha de segurança XSS). Em vez disso, o DRF está configurado no `base.py` para usar **JWTCookieAuthentication**:

1. O usuário faz o POST de login.
2. O servidor valida as credenciais. Se falhar, o `django-axes` registra a tentativa falha.
3. Se sucesso, o servidor gera os tokens `access_token` e `refresh_token` e os insere como cookies `HttpOnly`, `Secure` e `Lax`.
4. Isso significa que as próximas requisições do frontend contêm o token automaticamente no cabeçalho do cookie, invisível e inacessível para códigos JavaScript no lado do cliente.

### 3.3. Outros Processos e Funções Importantes

- **Tratamento de Slugs (`_unique_slug`)**: No módulo de Artigos (`apps/articles/models.py`), a geração do `slug` da URL ocorre automaticamente no `save()` do modelo. O sistema converte o título, processa caracteres especiais (usando a biblioteca `slugify`) e, caso o slug já exista, implementa um laço recursivo numérico (`-1`, `-2`, etc.) para garantir unicidade absoluta.
- **Auditoria Avançada (`AuditLogMiddleware`)**: O projeto conta com um middleware específico na pasta `audit/` configurado globalmente em `MIDDLEWARE`. Cada requisição/modificação significativa na base de dados é interceptada e registrada, permitindo um rastro (log) limpo de quem alterou o que e quando.

---

## 4. O Banco de Dados e as Entidades (Models)

### 4.1. Configuração do Banco

O sistema foi concebido de forma agnóstica de provedor relacional, utilizando o ORM do Django.

- Em desenvolvimento local, o sistema costuma usar o `db.sqlite3` para facilitar a inicialização.
- Em produção, a biblioteca `psycopg2-binary` garante suporte para **PostgreSQL**, sendo este o banco alvo de alta performance.

As chaves primárias (IDs) para a maior parte das entidades sensíveis não são autoincrementais padrão (`1, 2, 3`), e sim `UUIDv4` gerados dinamicamente via `uuid.uuid4`. Isso impede ataques de enumeração indireta (descobrir quantos usuários ou artigos existem no banco ao tentar acessar a rota `/api/users/15`).

### 4.2. Principais Entidades (Tabelas)

#### Tabela `users` (Acesso Global)

O projeto **sobrescreve o modelo de usuário padrão** (`AbstractBaseUser`) pela modelagem `apps.users.User`, onde o identificador principal para login não é o `username`, mas sim o `email` (`USERNAME_FIELD = 'email'`).
**Campos Notáveis:**

- `role`: Define o papel do usuário (Ex: `admin`, `user`).
- `is_banned`: Um `BooleanField` essencial para permitir soft-ban sem deletar os registros do banco em relacionamentos estrangeiros.
- Existem Índices otimizados na tabela baseados na regra: `models.Index(fields=['role', 'is_active', 'is_banned'])` para tornar as buscas e filtragens no painel administrativo instantâneas.

#### Tabelas de `password_reset_tokens`

Para trocar senhas com segurança, tokens são salvos nesta tabela. O campo `expires_at` permite a invalidação proativa do link num curto período de tempo (Ex: 1 hora) através de uma lógica no método `save()`, caso o token já não tenha sido marcado como `is_used`.

#### Tabelas de `articles` e `categories`

O modelo `Article` conecta-se a `Category` e `User` (Através da Foreign Key apontando para o Autor do artigo).

- A tabela implementa proteção contra remoção acidental (`on_delete=models.PROTECT` para os autores). Se um usuário que é autor for removido, o Django não permitirá até o artigo ser reatribuído ou lidado.
- Os dados são organizados no banco com `Status.DRAFT` (Rascunho) ou `Status.PUBLISHED` (Publicado).

### 4.3. Índices e Otimização do DB

Observando a implementação dos Modelos (como em `Article`), você notará a presença da classe `Meta`, na qual são declarados `indexes = [models.Index(fields=['status', '-published_at'])]`. O backend garante a criação de índices estruturados para buscas frequentes (por exemplo, buscar apenas artigos publicados ordenados da data mais recente), entregando o máximo de performance mesmo se as tabelas ficarem massivas.

---

## Considerações Finais

Ao iniciar uma nova implementação:

1. **Frontend**: Crie componentes reutilizáveis e respeite o ecossistema de hooks do React 19. Comunique-se com a API pela camada de serviços.
2. **Backend**: Não polua as views com regras de negócio ou de banco. Utilize os Managers e os métodos dentro de `models.py` para lógica de dados, e os Serializers para filtragem de entrada/saída.
3. **Migrações**: Ao alterar qualquer `models.py`, não se esqueça de rodar `python manage.py makemigrations` seguido de `python manage.py migrate` para propagar as alterações no banco SQLite local ou no banco PostgreSQL do servidor.
