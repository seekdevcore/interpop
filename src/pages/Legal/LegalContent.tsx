/**
 * LegalContent — fonte única para Termos de Uso e Política de Privacidade.
 *
 * Renderizado dentro de Modal (acesso rápido do formulário de cadastro)
 * e dentro de páginas dedicadas (/termos, /privacidade — linkadas no
 * footer, indexáveis e compartilháveis).
 *
 * Conteúdo refletivo dos dados *realmente coletados* pela aplicação:
 *   - Cadastro: nome, sobrenome, e-mail, senha (hash bcrypt)
 *   - Cookies httpOnly JWT (access_token, refresh_token)
 *   - Comentários e curtidas (vinculados ao usuário)
 *   - Newsletter (e-mail + token de unsubscribe)
 *   - AuditLog (IP, user-agent, path) — Marco Civil Art. 15 (logs 6 meses)
 *   - django-axes (tentativas falhas de login) — Legítimo interesse / segurança
 *   - View count por artigo (NÃO vinculado a usuário)
 *
 * Base legal LGPD (Art. 7º): execução de contrato (cadastro/auth),
 * consentimento (newsletter), cumprimento de obrigação legal (audit),
 * legítimo interesse (segurança).
 *
 * ⚠️ Este é um *modelo técnico* fiel ao que a app processa. Recomenda-se
 * revisão por advogado antes de uso em produção comercial.
 */
import './Legal.css';

const LAST_UPDATE = '17 de maio de 2026';
const CONTACT_EMAIL = 'interpop.cc@gmail.com';

interface LegalContentProps {
  type: 'termos' | 'privacidade';
}

export function LegalContent({ type }: LegalContentProps) {
  return (
    <div className="legal">
      <p className="legal__last-update">
        Última atualização: <strong>{LAST_UPDATE}</strong>
      </p>

      {type === 'termos' ? <TermsBody /> : <PrivacyBody />}

      <p className="legal__disclaimer">
        Em caso de dúvidas, entre em contato com a redação pelo e-mail{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}

/* ─── Termos de Uso ─────────────────────────────────────────────────── */

function TermsBody() {
  return (
    <>
      <p className="legal__lede">
        Estes Termos regulam o uso do <strong>Interpop</strong> (a
        "Plataforma"), um projeto editorial independente de análise crítica do
        Soft Power e da cultura pop. Ao criar uma conta ou utilizar a
        Plataforma, você concorda com estes Termos.
      </p>

      <h3>1. Aceitação dos Termos</h3>
      <p>
        Ao marcar a caixa "Aceito os Termos de uso e a Política de privacidade"
        no momento do cadastro, você declara ter lido, compreendido e concordado
        integralmente com este documento. Sem essa aceitação, não é possível
        criar uma conta.
      </p>

      <h3>2. Quem pode se cadastrar</h3>
      <p>
        O cadastro é destinado a pessoas com <strong>18 anos ou mais</strong>.
        Menores de idade só podem utilizar a Plataforma com supervisão e
        consentimento expresso de seus responsáveis legais, nos termos do
        Estatuto da Criança e do Adolescente (Lei nº 8.069/1990) e do art. 14 da
        LGPD (Lei nº 13.709/2018).
      </p>

      <h3>3. Conta de usuário</h3>
      <ul>
        <li>
          Você é responsável pela veracidade dos dados informados no cadastro
          (nome, sobrenome, e-mail).
        </li>
        <li>
          A senha é pessoal e intransferível. O Interpop nunca solicitará sua
          senha por e-mail ou telefone.
        </li>
        <li>
          Comunique imediatamente qualquer uso não autorizado de sua conta
          através do e-mail{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h3>4. Uso aceitável</h3>
      <p>É vedado utilizar a Plataforma para:</p>
      <ul>
        <li>
          Publicar conteúdo difamatório, calunioso, racista, xenófobo, sexista,
          homofóbico, transfóbico, capacitista ou que incite violência, ódio ou
          discriminação;
        </li>
        <li>
          Veicular spam, propaganda comercial não autorizada ou correntes;
        </li>
        <li>
          Tentar acessar áreas restritas, contas de outros usuários ou
          comprometer a integridade técnica da Plataforma;
        </li>
        <li>
          Coletar dados de outros usuários sem autorização (scraping, harvest de
          e-mails, etc.);
        </li>
        <li>
          Reproduzir integralmente artigos do Interpop em outros veículos sem
          autorização escrita (citações com link e atribuição são permitidas e
          incentivadas).
        </li>
      </ul>

      <h3>5. Conteúdo gerado pelo usuário</h3>
      <p>
        Comentários publicados na Plataforma são de responsabilidade exclusiva
        de quem os escreve. Ao publicar um comentário, você concede ao Interpop
        licença não-exclusiva, gratuita e mundial para exibi-lo associado ao seu
        nome de usuário no contexto do artigo correspondente.
      </p>

      <h3>6. Moderação e banimento</h3>
      <p>
        A redação do Interpop pode, a seu critério editorial e em conformidade
        com estes Termos:
      </p>
      <ul>
        <li>Remover comentários que violem o item 4;</li>
        <li>Suspender ou banir contas que reincidam em violações;</li>
        <li>Recusar cadastros suspeitos (bots, contas duplicadas, etc.).</li>
      </ul>
      <p>
        Banimentos são registrados com motivo e podem ser contestados pelo
        e-mail de contato.
      </p>

      <h3>7. Propriedade intelectual</h3>
      <p>
        Todo o conteúdo editorial (artigos, ilustrações, edições da newsletter)
        é de titularidade do Interpop e de seus respectivos autores, protegido
        pela Lei de Direitos Autorais (Lei nº 9.610/1998). É permitido
        compartilhar links e citações breves com atribuição clara; reprodução
        integral exige autorização escrita.
      </p>

      <h3>8. Encerramento da conta</h3>
      <p>
        Você pode encerrar sua conta a qualquer momento solicitando por e-mail.
        O encerramento implica a eliminação de seus dados pessoais conforme
        descrito na Política de Privacidade, ressalvadas obrigações legais de
        retenção (ex.: logs de acesso por 6 meses conforme art. 15 do Marco
        Civil da Internet, Lei nº 12.965/2014).
      </p>

      <h3>9. Limitação de responsabilidade</h3>
      <p>
        O Interpop é um projeto independente sem fins lucrativos imediatos. O
        conteúdo é publicado em regime de melhor esforço editorial. O Interpop
        não se responsabiliza por:
      </p>
      <ul>
        <li>Interrupções temporárias do serviço por causas técnicas;</li>
        <li>Conteúdo publicado por usuários (comentários);</li>
        <li>Danos decorrentes do uso indevido da Plataforma por terceiros.</li>
      </ul>

      <h3>10. Alterações nos Termos</h3>
      <p>
        Estes Termos podem ser alterados a qualquer momento. Alterações
        materiais serão comunicadas por e-mail aos usuários cadastrados com
        antecedência mínima de 15 dias. O uso continuado da Plataforma após o
        prazo implica aceitação das novas condições.
      </p>

      <h3>11. Lei aplicável e foro</h3>
      <p>
        Estes Termos são regidos pela legislação brasileira, em especial pela
        LGPD (Lei nº 13.709/2018), pelo Marco Civil da Internet (Lei nº
        12.965/2014) e pelo Código de Defesa do Consumidor (Lei nº 8.078/1990).
        Fica eleito o foro do domicílio do usuário para dirimir quaisquer
        controvérsias.
      </p>
    </>
  );
}

/* ─── Política de Privacidade ───────────────────────────────────────── */

function PrivacyBody() {
  return (
    <>
      <p className="legal__lede">
        Esta Política descreve como o <strong>Interpop</strong> coleta, utiliza,
        armazena e protege os seus dados pessoais, em conformidade com a
        <strong> Lei Geral de Proteção de Dados Pessoais</strong> (LGPD, Lei nº
        13.709/2018) e com o <strong>Marco Civil da Internet</strong> (Lei nº
        12.965/2014).
      </p>

      <h3>1. Quem somos</h3>
      <p>
        O Interpop é um projeto editorial independente. Para fins desta
        Política, atuamos como <strong>controlador</strong> dos seus dados
        pessoais (Art. 5º, VI da LGPD). Contato:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h3>2. Quais dados coletamos</h3>
      <table className="legal__table">
        <thead>
          <tr>
            <th>Dado</th>
            <th>Quando</th>
            <th>Por quê</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Nome, sobrenome, e-mail, senha (armazenada como <em>hash</em>{' '}
              bcrypt — nunca em texto puro)
            </td>
            <td>No cadastro</td>
            <td>Execução de contrato (Art. 7º, V da LGPD)</td>
          </tr>
          <tr>
            <td>
              Cookies de autenticação <em>httpOnly</em> (JWT access + refresh)
            </td>
            <td>No login</td>
            <td>Execução de contrato — manter sua sessão ativa</td>
          </tr>
          <tr>
            <td>Conteúdo dos comentários e curtidas</td>
            <td>Quando você interage com artigos</td>
            <td>Execução de contrato</td>
          </tr>
          <tr>
            <td>E-mail (para newsletter)</td>
            <td>Ao se inscrever na newsletter</td>
            <td>Consentimento (Art. 7º, I da LGPD)</td>
          </tr>
          <tr>
            <td>
              Endereço IP, <em>user-agent</em> e <em>timestamp</em> de ações
            </td>
            <td>A cada ação que modifica dados (publicar comentário, etc.)</td>
            <td>
              Cumprimento de obrigação legal (Art. 7º, II) — guarda de registros
              de acesso por <strong>6 meses</strong> nos termos do Art. 15 do
              Marco Civil da Internet
            </td>
          </tr>
          <tr>
            <td>Tentativas de login mal-sucedidas (IP + e-mail)</td>
            <td>Em logins com senha errada</td>
            <td>
              Legítimo interesse em segurança (Art. 7º, IX da LGPD) — prevenção
              a ataques de força bruta
            </td>
          </tr>
          <tr>
            <td>Visualizações de artigo (contador agregado)</td>
            <td>Ao abrir um artigo</td>
            <td>
              <strong>Não vinculado a usuário individual.</strong> Apenas soma
              quantas vezes o artigo foi visto, sem rastrear quem
            </td>
          </tr>
        </tbody>
      </table>

      <h3>3. O que NÃO coletamos</h3>
      <ul>
        <li>
          Dados sensíveis (origem racial, convicção religiosa, opinião política,
          filiação sindical, dados de saúde, biometria — Art. 5º, II da LGPD);
        </li>
        <li>Localização precisa (GPS);</li>
        <li>Dados de menores de 18 anos sem consentimento dos responsáveis;</li>
        <li>
          Cookies de rastreamento de terceiros (Google Analytics, Meta Pixel,
          etc.).
        </li>
      </ul>

      <h3>4. Como usamos seus dados</h3>
      <ul>
        <li>
          <strong>Operar a Plataforma:</strong> autenticar, exibir seus
          comentários, processar curtidas;
        </li>
        <li>
          <strong>Comunicar:</strong> enviar a newsletter (se inscrito), avisos
          de novas publicações, notificações de segurança;
        </li>
        <li>
          <strong>Moderar:</strong> identificar e prevenir abusos (spam, hate
          speech);
        </li>
        <li>
          <strong>Cumprir a lei:</strong> atender requisições judiciais quando
          legalmente exigido.
        </li>
      </ul>

      <h3>5. Compartilhamento com terceiros</h3>
      <p>Compartilhamos o mínimo necessário, apenas com:</p>
      <ul>
        <li>
          <strong>Provedor de e-mail SMTP</strong> (atualmente Gmail/Google LLC)
          — recebe seu e-mail e o conteúdo das mensagens (welcome,
          notificações). Sujeito à política de privacidade do Google.
          Transferência internacional para os EUA com adequação prevista no Art.
          33 da LGPD;
        </li>
        <li>
          <strong>Provedor de hospedagem</strong> — armazena os dados em
          servidores que serão divulgados conforme escolhidos;
        </li>
        <li>
          <strong>Autoridades competentes</strong> — mediante ordem judicial.
        </li>
      </ul>
      <p>
        <strong>Não vendemos seus dados.</strong> Nunca. Não compartilhamos para
        marketing de terceiros.
      </p>

      <h3>6. Cookies</h3>
      <p>
        Usamos apenas <strong>cookies essenciais</strong> ao funcionamento:
      </p>
      <ul>
        <li>
          <code>access_token</code> e <code>refresh_token</code> (
          <em>httpOnly</em>, JWT) — mantêm você logado;
        </li>
        <li>
          <code>csrftoken</code> — proteção contra CSRF (Cross-Site Request
          Forgery).
        </li>
      </ul>
      <p>
        Não usamos cookies analíticos nem publicitários. Não há banner de
        consentimento de cookies porque os cookies utilizados se enquadram na
        exceção de "cookies estritamente necessários" prevista pela ANPD.
      </p>

      <h3>7. Por quanto tempo guardamos seus dados</h3>
      <ul>
        <li>
          <strong>Conta ativa:</strong> enquanto sua conta existir;
        </li>
        <li>
          <strong>Após exclusão da conta:</strong> dados pessoais identificáveis
          (nome, e-mail) são eliminados em até 30 dias. Comentários públicos são
          anonimizados (substituídos por "Usuário removido"), preservando o
          histórico editorial;
        </li>
        <li>
          <strong>Logs de acesso (IP, user-agent):</strong> 6 meses, conforme
          Art. 15 do Marco Civil da Internet;
        </li>
        <li>
          <strong>Tentativas falhas de login:</strong> 30 minutos (limpo
          automaticamente pelo sistema antifraude).
        </li>
      </ul>

      <h3>8. Seus direitos (Art. 18 da LGPD)</h3>
      <p>Você tem direito a:</p>
      <ul>
        <li>
          <strong>Confirmação</strong> da existência de tratamento de seus
          dados;
        </li>
        <li>
          <strong>Acesso</strong> aos dados que mantemos sobre você;
        </li>
        <li>
          <strong>Correção</strong> de dados incompletos, inexatos ou
          desatualizados;
        </li>
        <li>
          <strong>Anonimização, bloqueio ou eliminação</strong> de dados
          desnecessários ou tratados em desconformidade com a LGPD;
        </li>
        <li>
          <strong>Portabilidade</strong> dos dados a outro fornecedor de
          serviço, mediante requisição expressa;
        </li>
        <li>
          <strong>Eliminação</strong> dos dados pessoais tratados com base no
          seu consentimento (newsletter, por exemplo);
        </li>
        <li>
          <strong>Informação</strong> sobre com quais entidades públicas e
          privadas compartilhamos seus dados;
        </li>
        <li>
          <strong>Revogação do consentimento</strong> a qualquer momento;
        </li>
        <li>
          <strong>Petição perante a ANPD</strong> (Autoridade Nacional de
          Proteção de Dados) caso considere que seus direitos foram violados.
        </li>
      </ul>

      <h3>9. Como exercer seus direitos</h3>
      <p>
        Envie e-mail para{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=LGPD%20-%20Solicita%C3%A7%C3%A3o%20de%20direito%20do%20titular`}
        >
          {CONTACT_EMAIL}
        </a>{' '}
        com o assunto "LGPD - Solicitação de direito do titular" e descrevendo o
        que deseja. Responderemos em até <strong>15 dias</strong>. A solicitação
        é gratuita.
      </p>

      <h3>10. Segurança</h3>
      <p>Adotamos medidas técnicas e administrativas razoáveis:</p>
      <ul>
        <li>
          Senhas armazenadas como <em>hash</em> bcrypt (irreversível);
        </li>
        <li>Comunicação criptografada via HTTPS/TLS;</li>
        <li>
          Cookies de autenticação <em>httpOnly</em> e <em>Secure</em> em
          produção (não acessíveis via JavaScript);
        </li>
        <li>
          Proteção contra força bruta via <em>rate limiting</em>;
        </li>
        <li>Auditoria de operações sensíveis (banimentos, exclusões).</li>
      </ul>
      <p>
        Em caso de incidente de segurança que possa acarretar risco ou dano
        relevante aos titulares, comunicaremos a ANPD e os titulares afetados em
        prazo razoável, nos termos do Art. 48 da LGPD.
      </p>

      <h3>11. Alterações nesta Política</h3>
      <p>
        Alterações materiais serão comunicadas por e-mail com antecedência
        mínima de 15 dias. A versão sempre vigente é a publicada nesta página,
        com a data de última atualização indicada no topo.
      </p>
    </>
  );
}
