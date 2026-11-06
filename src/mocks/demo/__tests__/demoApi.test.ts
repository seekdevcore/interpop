// @vitest-environment node
/**
 * Integração do mock da API do site demo (Render, para o design).
 *
 * Usa os services REAIS (axios de src/services/api.ts) contra os handlers do
 * MSW via msw/node: se o mock divergir do contrato que as telas consomem,
 * quebra aqui e não na frente do designer. Ambiente `node` porque o
 * adaptador http do axios + FormData nativo do Node é o par que o MSW
 * intercepta sem perder o multipart (o FormData do jsdom não atravessa o
 * interceptor de XHR).
 *
 * Contrato espelhado: views/serializers de backend/apps (levantamento de
 * 2026-11-05), com as mensagens pt-BR literais do DRF/Django.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { setupServer } from 'msw/node';
import type { AxiosError } from 'axios';
import { demoHandlers } from '@/mocks/handlers';
import { demoDb, DEMO_ACCOUNTS } from '@/mocks/demo/db';
import articleService from '@/services/articleService';
import { authService } from '@/services/authService';
import commentService from '@/services/commentService';
import moderationService from '@/services/moderationService';
import newsletterService from '@/services/newsletterService';
import metricsService from '@/services/metricsService';
import { fetchSearch } from '@/pages/Buscar/services/searchService';

// api.ts dispara `window.dispatchEvent('auth:logout')` quando o refresh
// falha; no ambiente node não há window.
vi.stubGlobal('window', new EventTarget());

const server = setupServer(...demoHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => demoDb.reset());

const ADMIN = DEMO_ACCOUNTS.find((a) => a.role === 'admin')!.email;
const DEV = DEMO_ACCOUNTS.find((a) => a.role === 'dev')!.email;
const EDITOR = DEMO_ACCOUNTS.find((a) => a.role === 'editor')!.email;
const READER = DEMO_ACCOUNTS.find((a) => a.role === 'user')!.email;

async function loginAs(email: string) {
  const { data } = await authService.login({ email, password: 'qualquer' });
  return data;
}

/** Executa e devolve a resposta de erro (falha o teste se não houver erro). */
async function failure(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    const res = (err as AxiosError).response;
    if (!res) throw err;
    return { status: res.status, data: res.data as Record<string, unknown> };
  }
  throw new Error('esperava erro HTTP, request deu certo');
}

describe('auth', () => {
  it('me sem sessão → 401 com detail do DRF', async () => {
    const res = await failure(authService.me());
    expect(res.status).toBe(401);
    expect(res.data.detail).toBe(
      'As credenciais de autenticação não foram fornecidas.',
    );
  });

  it('login com conta demo e qualquer senha → usuário público', async () => {
    const user = await loginAs(EDITOR);
    expect(user).toMatchObject({ role: 'editor', is_banned: false });
    expect(user.full_name).toBe(`${user.first_name} ${user.last_name}`);
    expect(user.avatar_initial).toBe(user.first_name[0].toUpperCase());
    const { data: me } = await authService.me();
    expect(me.id).toBe(user.id);
  });

  it('login com e-mail desconhecido → non_field_errors', async () => {
    const res = await failure(
      authService.login({ email: 'ninguem@example.com', password: 'x' }),
    );
    expect(res.status).toBe(400);
    expect(res.data.non_field_errors).toEqual(['E-mail ou senha inválidos.']);
  });

  it('login de conta banida → "Conta suspensa."', async () => {
    const banned = demoDb.state.users.find((u) => u.is_banned)!;
    const res = await failure(
      authService.login({ email: banned.email, password: 'x' }),
    );
    expect(res.data.non_field_errors).toEqual(['Conta suspensa.']);
  });

  it('logout encerra a sessão', async () => {
    await loginAs(READER);
    const { data } = await authService.logout();
    expect(data).toEqual({ detail: 'Logout realizado.' });
    expect((await failure(authService.me())).status).toBe(401);
  });

  it('register cria conta, loga e devolve 201', async () => {
    const res = await authService.register({
      email: 'nova@example.com',
      username: 'nova.pessoa',
      first_name: 'Nova',
      last_name: 'Pessoa',
      password: 'Senha@123',
      password2: 'Senha@123',
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ role: 'user', full_name: 'Nova Pessoa' });
    expect((await authService.me()).data.username).toBe('nova.pessoa');
  });

  // Ordem do DRF: validadores de campo primeiro; `validate()` (senhas) só
  // roda se eles passarem, e para no primeiro erro (coincidência → força).
  const base = {
    email: 'outra@example.com',
    username: 'outra',
    first_name: 'A',
    last_name: 'B',
    password: 'Senha@123',
    password2: 'Senha@123',
  };

  it('register: e-mail duplicado (só caixa diferente) e username inválido', async () => {
    const res = await failure(
      authService.register({
        ...base,
        email: EDITOR.toUpperCase(),
        username: 'com espaço',
        password2: 'diferente',
      }),
    );
    expect(res.status).toBe(400);
    expect(res.data.email).toEqual(['Este e-mail já está em uso.']);
    expect(res.data.username).toEqual([
      'Use apenas letras, números, ponto, hífen ou underline (sem espaços).',
    ]);
    expect(res.data.password2).toBeUndefined();
  });

  it('register: curta (campo), senhas diferentes, depois senha fraca', async () => {
    // `CharField(min_length=8)` barra antes de `validate()` rodar
    const short = await failure(
      authService.register({ ...base, password: 'Ab@1', password2: 'x' }),
    );
    expect(short.data).toEqual({
      password: ['Certifique-se de que este campo tenha mais de 8 caracteres.'],
    });
    const mismatch = await failure(
      authService.register({ ...base, password2: 'Outra@123' }),
    );
    expect(mismatch.data).toEqual({ password2: ['As senhas não coincidem.'] });
    const weak = await failure(
      authService.register({
        ...base,
        password: 'fracafraca',
        password2: 'fracafraca',
      }),
    );
    expect(weak.data).toEqual({
      password: [
        'A senha precisa conter uma letra maiúscula, um número, um caractere especial (@$!%*?&#).',
      ],
    });
  });

  it('updateProfile (JSON) altera bio e nome', async () => {
    await loginAs(READER);
    const { data } = await authService.updateProfile({
      first_name: 'Carla',
      bio: 'Leitora assídua.',
    });
    expect(data).toMatchObject({
      first_name: 'Carla',
      bio: 'Leitora assídua.',
    });
    expect(data.full_name.startsWith('Carla ')).toBe(true);
  });

  it('updateProfile com avatar (multipart) devolve URL do avatar', async () => {
    await loginAs(READER);
    const avatar = new File([new Uint8Array([1, 2, 3])], 'eu.png', {
      type: 'image/png',
    });
    const { data } = await authService.updateProfile({ avatar });
    expect(typeof data.avatar).toBe('string');
  });

  it('changePassword encerra a sessão; senha nova fraca é recusada', async () => {
    await loginAs(READER);
    const weak = await failure(authService.changePassword('antiga', 'abc'));
    expect(weak.status).toBe(400);
    expect(weak.data.new_password).toBeDefined();
    const ok = await authService.changePassword('antiga', 'Nova@1234');
    expect(ok.data).toEqual({ detail: 'Senha alterada com sucesso.' });
    expect((await failure(authService.me())).status).toBe(401);
  });

  it('password reset: pedido sempre 200; confirmação exige token UUID', async () => {
    const req = await authService.requestPasswordReset('qualquer@example.com');
    expect(req.data.detail).toBe(
      'Se o e-mail existir, você receberá as instruções em instantes.',
    );
    const bad = await failure(
      authService.confirmPasswordReset('nao-e-uuid', 'Nova@1234'),
    );
    // `token` é UUIDField: malformado barra antes da busca no banco
    expect(bad.data.token).toEqual(['Deve ser um UUID válido.']);
    // Demo não envia e-mail: qualquer UUID bem formado vale como token
    const ok = await authService.confirmPasswordReset(
      '3f2b8c1e-0d4a-4e8b-9c1f-2a7d6e5b4c3a',
      'Nova@1234',
    );
    expect(ok.data.detail).toBe('Senha redefinida com sucesso.');
  });
});

describe('artigos e categorias', () => {
  it('categorias paginadas, ordenadas por nome, slug de Música com acento', async () => {
    const { data } = await articleService.listCategories();
    expect(data.count).toBe(5);
    expect(data.results.map((c) => c.slug)).toEqual([
      'cinema',
      'cultura-digital',
      'literatura',
      'moda',
      'música',
    ]);
  });

  it('anônimo vê só publicados; um deles é destaque', async () => {
    const { data } = await articleService.list({ page: '1' });
    expect(data.count).toBe(12);
    expect(data.results.every((a) => a.status === 'published')).toBe(true);
    expect(data.results.filter((a) => a.is_featured)).toHaveLength(1);
    // listagem não carrega body (payload enxuto, igual ao serializer)
    expect(data.results[0].body).toBeUndefined();
  });

  it('editor vê rascunhos também (nulos primeiro, como no Postgres)', async () => {
    await loginAs(EDITOR);
    const { data } = await articleService.list({ page: '1' });
    expect(data.count).toBe(14);
    expect(data.results[0].status).toBe('draft');
    const drafts = await articleService.list({ status: 'draft' });
    expect(drafts.data.count).toBe(2);
  });

  it('filtra por categoria e busca no texto', async () => {
    const musica = await articleService.list({ category__slug: 'música' });
    expect(musica.data.count).toBe(3);
    expect(
      musica.data.results.every((a) => a.category?.slug === 'música'),
    ).toBe(true);
    const busca = await articleService.list({ search: 'hallyu' });
    expect(busca.data.count).toBeGreaterThan(0);
  });

  it('detalhe traz body, legenda e capa; rascunho é 404 para anônimo', async () => {
    const { data: list } = await articleService.list({ page: '1' });
    const { data } = await articleService.get(list.results[0].slug);
    expect(data.body).toBeTruthy();
    expect(data.cover_caption).toBeTruthy();
    expect(data.cover_image).toBeTruthy();
    const draft = demoDb.state.articles.find((a) => a.status === 'draft')!;
    const res = await failure(articleService.get(draft.slug));
    expect(res.status).toBe(404);
  });

  it('recordView devolve 204 e soma uma visualização', async () => {
    const { data: list } = await articleService.list({ page: '1' });
    const slug = list.results[0].slug;
    const before = (await articleService.get(slug)).data.view_count;
    const res = await articleService.recordView(slug);
    expect(res.status).toBe(204);
    expect((await articleService.get(slug)).data.view_count).toBe(before + 1);
  });

  it('leitor não cria artigo (403); anônimo recebe 401', async () => {
    const payload = {
      title: 'X',
      excerpt: 'Y',
      body: 'Z',
      cover_caption: 'Foto: X',
    };
    expect((await failure(articleService.create(payload))).status).toBe(401);
    await loginAs(READER);
    const res = await failure(articleService.create(payload));
    expect(res.status).toBe(403);
    expect(res.data.detail).toBe(
      'Você não tem permissão para executar essa ação.',
    );
  });

  it('editor cria artigo (multipart) com slug unicode e vira destaque único', async () => {
    await loginAs(EDITOR);
    const cover = new File([new Uint8Array([9])], 'capa.jpg', {
      type: 'image/jpeg',
    });
    const res = await articleService.create({
      title: 'Ação & Reação: o pop coreano',
      excerpt: 'Resumo',
      body: 'Corpo do texto',
      category_id: 5,
      status: 'published',
      is_featured: true,
      cover_caption: 'Foto: Divulgação',
      cover_image: cover,
    });
    expect(res.status).toBe(201);
    const created = demoDb.state.articles.find(
      (a) => a.title === 'Ação & Reação: o pop coreano',
    )!;
    expect(created.slug).toBe('ação-reação-o-pop-coreano');
    expect(created.published_at).toBeTruthy();
    expect(demoDb.state.articles.filter((a) => a.is_featured)).toHaveLength(1);
    const { data } = await articleService.get(created.slug);
    expect(data.category?.slug).toBe('música');
  });

  // ArticleWriteSerializer: legenda é erro de campo; a capa só é cobrada em
  // `validate()`, que o DRF não roda enquanto houver erro de campo.
  it('create exige legenda (campo) e depois capa (validate)', async () => {
    await loginAs(EDITOR);
    const base = { title: 'T', excerpt: 'E', body: 'B' };
    const noCaption = await failure(articleService.create(base));
    expect(noCaption.data).toEqual({
      cover_caption: ['A legenda da capa é obrigatória.'],
    });
    const blank = await failure(
      articleService.create({ ...base, cover_caption: '   ' }),
    );
    expect(blank.data).toEqual({
      cover_caption: [
        'A legenda da capa é obrigatória (ex.: "Foto: Agência").',
      ],
    });
    const noCover = await failure(
      articleService.create({ ...base, cover_caption: 'Foto: X' }),
    );
    expect(noCover.data).toEqual({
      cover_image: ['A imagem de capa é obrigatória.'],
    });
  });

  it('slug repetido ganha sufixo -1', async () => {
    await loginAs(EDITOR);
    const existing = demoDb.state.articles[0];
    const cover = new File([new Uint8Array([1])], 'c.jpg', {
      type: 'image/jpeg',
    });
    await articleService.create({
      title: existing.title,
      excerpt: 'E',
      body: 'B',
      cover_caption: 'Foto: X',
      cover_image: cover,
    });
    expect(
      demoDb.state.articles.some((a) => a.slug === `${existing.slug}-1`),
    ).toBe(true);
  });

  it('PATCH só pelo autor ou admin; DELETE remove', async () => {
    const othersArticle = demoDb.state.articles.find(
      (a) =>
        a.author_id !== demoDb.state.users.find((u) => u.email === EDITOR)!.id,
    )!;
    await loginAs(EDITOR);
    const res = await failure(
      articleService.update(othersArticle.slug, { title: 'Invasão' }),
    );
    expect(res.status).toBe(403);

    await loginAs(ADMIN);
    await articleService.update(othersArticle.slug, { excerpt: 'Novo resumo' });
    expect((await articleService.get(othersArticle.slug)).data.excerpt).toBe(
      'Novo resumo',
    );
    const del = await articleService.remove(othersArticle.slug);
    expect(del.status).toBe(204);
    expect((await failure(articleService.get(othersArticle.slug))).status).toBe(
      404,
    );
  });
});

describe('comentários', () => {
  const featuredSlug = () =>
    demoDb.state.articles.find((a) => a.is_featured)!.slug;

  // Formato do backend: `parent_id` é write_only (não volta na resposta) e
  // a resposta (ReplySerializer) não tem `replies`/`replies_count`.
  it('lista paginada com respostas aninhadas (só topo na raiz)', async () => {
    const { data } = await commentService.list(featuredSlug(), { page: '1' });
    expect(data.count).toBeGreaterThan(0);
    expect(data).toHaveProperty('next');
    const withReplies = data.results.find((c) => c.replies.length > 0)!;
    expect(withReplies.replies_count).toBe(withReplies.replies.length);
    expect(withReplies).not.toHaveProperty('parent_id');
    const reply = withReplies.replies[0];
    expect(reply).not.toHaveProperty('replies');
    expect(data.results.some((c) => c.id === reply.id)).toBe(false);
    const times = withReplies.replies.map((r) => r.created_at);
    expect([...times].sort()).toEqual(times);
  });

  it('anônimo não comenta (401); leitor comenta e responde', async () => {
    expect(
      (await failure(commentService.add(featuredSlug(), 'Oi'))).status,
    ).toBe(401);
    await loginAs(READER);
    const { data: top, status } = await commentService.add(
      featuredSlug(),
      'Ótima análise!',
    );
    expect(status).toBe(201);
    expect(top).toMatchObject({ content: 'Ótima análise!', replies: [] });
    const { data: reply } = await commentService.add(
      featuredSlug(),
      'Concordo.',
      top.id,
    );
    const { data: list } = await commentService.list(featuredSlug());
    const parent = list.results.find((c) => c.id === top.id)!;
    expect(parent.replies.map((r) => r.id)).toEqual([reply.id]);
    const res = await failure(
      commentService.add(featuredSlug(), 'Resposta da resposta', reply.id),
    );
    expect(res.data.parent_id).toEqual([
      'Comentário pai inválido ou não encontrado.',
    ]);
  });

  it('curtir alterna; outro leitor não apaga comentário alheio; admin apaga', async () => {
    await loginAs(READER);
    const { data: c } = await commentService.add(featuredSlug(), 'Meu texto');
    expect((await commentService.toggleLike(c.id)).data).toEqual({
      liked: true,
      likes_count: 1,
    });
    expect((await commentService.toggleLike(c.id)).data.liked).toBe(false);

    await loginAs(EDITOR);
    expect((await failure(commentService.remove(c.id))).status).toBe(403);
    await loginAs(ADMIN);
    expect((await commentService.remove(c.id)).status).toBe(204);
    const { data } = await commentService.list(featuredSlug());
    expect(data.results.some((x) => x.id === c.id)).toBe(false);
  });

  it('comentários de rascunho → 404', async () => {
    const draft = demoDb.state.articles.find((a) => a.status === 'draft')!;
    expect((await failure(commentService.list(draft.slug))).status).toBe(404);
  });
});

describe('moderação', () => {
  it('lista de usuários exige editor+; traz e-mail e contagens', async () => {
    await loginAs(READER);
    expect((await failure(moderationService.listUsers())).status).toBe(403);
    await loginAs(EDITOR);
    const { data } = await moderationService.listUsers();
    expect(data.results[0]).toHaveProperty('email');
    expect(data.results[0]).toHaveProperty('article_count');
  });

  it('admin lista bans ativos e bane leitor', async () => {
    await loginAs(ADMIN);
    const before = (await moderationService.listBans()).data.count;
    const target = demoDb.state.users.find(
      (u) => u.role === 'user' && !u.is_banned && u.email !== READER,
    )!;
    const { data: ban, status } = await moderationService.ban({
      user_id: target.id,
      reason: 'Spam repetido',
    });
    expect(status).toBe(201);
    expect(ban.user.id).toBe(target.id);
    expect((await moderationService.listBans()).data.count).toBe(before + 1);
    expect(demoDb.state.users.find((u) => u.id === target.id)!.is_banned).toBe(
      true,
    );
  });

  it('admin não bane outro admin (só dev); erro "Pk inválido"', async () => {
    await loginAs(ADMIN);
    const dev = demoDb.state.users.find((u) => u.role === 'dev')!;
    const res = await failure(
      moderationService.ban({ user_id: dev.id, reason: 'x' }),
    );
    expect(res.data.user_id).toEqual([
      `Pk inválido "${dev.id}" - objeto não existe.`,
    ]);
  });

  it('unban desativa o ban e libera o usuário', async () => {
    await loginAs(ADMIN);
    const { data } = await moderationService.listBans();
    const ban = data.results[0];
    expect((await moderationService.unban(ban.id)).status).toBe(204);
    expect(
      demoDb.state.users.find((u) => u.id === ban.user.id)!.is_banned,
    ).toBe(false);
    expect((await failure(moderationService.unban(ban.id))).status).toBe(404);
  });

  it('editor não vê bans (403), mas solicita ban; duplicata pendente falha', async () => {
    await loginAs(EDITOR);
    expect((await failure(moderationService.listBans())).status).toBe(403);
    const target = demoDb.state.users.find(
      (u) =>
        u.role === 'user' &&
        !u.is_banned &&
        !demoDb.state.banRequests.some(
          (r) => r.target_id === u.id && r.status === 'pending',
        ),
    )!;
    const { status } = await moderationService.createBanRequest({
      target_id: target.id,
      reason: 'Ofensas',
    });
    expect(status).toBe(201);
    const dup = await failure(
      moderationService.createBanRequest({ target_id: target.id, reason: 'x' }),
    );
    expect(dup.data.target_id).toEqual([
      'Já existe solicitação pendente para este usuário.',
    ]);
  });

  it('leitor vê lista de solicitações vazia; admin vê a pendente do seed', async () => {
    await loginAs(READER);
    expect((await moderationService.listBanRequests()).data.count).toBe(0);
    await loginAs(ADMIN);
    const { data } = await moderationService.listBanRequests({
      status: 'pending',
    });
    expect(data.count).toBe(1);
  });

  it('admin aprova solicitação → cria ban; decidir de novo → 400', async () => {
    await loginAs(ADMIN);
    const { data } = await moderationService.listBanRequests({
      status: 'pending',
    });
    const req = data.results[0];
    const { data: decided } = await moderationService.decideBanRequest(req.id, {
      action: 'approve',
    });
    expect(decided.status).toBe('approved');
    expect(decided.decided_by?.id).toBeTruthy();
    expect(
      demoDb.state.users.find((u) => u.id === req.target.id)!.is_banned,
    ).toBe(true);
    const again = await failure(
      moderationService.decideBanRequest(req.id, { action: 'reject' }),
    );
    expect(again.status).toBe(400);
    expect(again.data.detail).toBe('Solicitação já aprovada.');
  });

  it('usuário banido não comenta: 403 "Sua conta foi suspensa."', async () => {
    await loginAs(DEV);
    const target = demoDb.state.users.find((u) => u.email === READER)!;
    await moderationService.ban({ user_id: target.id, reason: 'teste' });
    // sessão do banido continua existindo (cookie), mas é barrada
    demoDb.setSession(target.id);
    const slug = demoDb.state.articles.find((a) => a.is_featured)!.slug;
    const res = await failure(commentService.add(slug, 'oi'));
    expect(res.status).toBe(403);
    expect(res.data.detail).toBe('Sua conta foi suspensa.');
  });
});

describe('newsletter', () => {
  it('inscrição nova e repetida', async () => {
    expect(
      (await newsletterService.subscribe('novo@example.com')).data.detail,
    ).toBe('Inscrição realizada com sucesso!');
    expect(
      (await newsletterService.subscribe('novo@example.com')).data.detail,
    ).toBe('E-mail já inscrito e reativado.');
  });

  it('e-mail inválido → erro de campo do Django', async () => {
    const res = await failure(newsletterService.subscribe('sem-arroba'));
    expect(res.data.email).toEqual(['Insira um endereço de email válido.']);
  });

  it('cancelamento com token do seed; token malformado é recusado', async () => {
    const token = demoDb.state.subscribers.find((s) => s.is_active)!.token;
    expect((await newsletterService.unsubscribe(token)).data.detail).toBe(
      'Inscrição cancelada com sucesso.',
    );
    const again = await failure(newsletterService.unsubscribe(token));
    expect(again.data.token).toEqual(['Token inválido ou já cancelado.']);
    const bad = await failure(newsletterService.unsubscribe('abc'));
    expect(bad.data.token).toEqual(['Deve ser um UUID válido.']);
  });
});

describe('métricas do admin', () => {
  it('exige admin/dev', async () => {
    await loginAs(EDITOR);
    expect((await failure(metricsService.get('week'))).status).toBe(403);
  });

  it('por artigo: engajamento plausível e comentário novo soma 1', async () => {
    await loginAs(ADMIN);
    const before = (await metricsService.get('week')).data.per_article;
    before.forEach((a) => {
      expect(a.engagement_rate).toBeGreaterThan(0.01);
      expect(a.engagement_rate).toBeLessThan(0.15);
    });
    const slug = demoDb.state.articles.find(
      (a) => a.status === 'published',
    )!.slug;
    await commentService.add(slug, 'Comentário para a métrica');
    const after = (await metricsService.get('week')).data.per_article;
    const count = (rows: typeof before) =>
      rows.find((a) => a.slug === slug)!.comment_count;
    expect(count(after)).toBe(count(before) + 1);
  });

  it.each([
    ['day', 25, /^\d{2}:00$/],
    ['week', 8, /^\d{2}\/\d{2}$/],
    ['month', 31, /^\d{2}\/\d{2}$/],
    ['year', 13, /^[A-Z][a-z]{2}\/\d{2}$/],
  ] as const)(
    'período %s: %i buckets, labels no formato do backend',
    async (period, buckets, labelRe) => {
      await loginAs(ADMIN);
      const { data } = await metricsService.get(period);
      expect(data.period).toBe(period);
      const ts = data.time_series;
      expect(ts.labels).toHaveLength(buckets);
      ts.labels.forEach((l) => expect(l).toMatch(labelRe));
      for (const key of [
        'comments',
        'likes',
        'subscribers',
        'users',
        'articles',
      ] as const) {
        expect(ts[key]).toHaveLength(buckets);
      }
      expect(data.totals.articles).toBe(12);
      expect(data.category_breakdown.map((c) => c.slug)).toContain('música');
      expect(data.per_article.length).toBeGreaterThan(0);
      const first = data.per_article[0];
      expect(first.view_count).toBeGreaterThanOrEqual(
        data.per_article[data.per_article.length - 1].view_count,
      );
      expect(data.previous_period_stats).toHaveProperty('new_users');
    },
  );
});

describe('busca editorial', () => {
  it('encontra artigos que existem no demo (slug navegável)', async () => {
    const page = await fetchSearch({ q: 'hallyu' });
    expect(page.results.length).toBeGreaterThan(0);
    const slugs = demoDb.state.articles.map((a) => a.slug);
    page.results.forEach((r) => expect(slugs).toContain(r.slug));
    expect(page.results[0]).toHaveProperty('author.name');
  });

  it('busca ignora acentos e caixa', async () => {
    const page = await fetchSearch({ q: 'MUSICA' });
    expect(page.total_estimate).toBeGreaterThan(0);
  });

  it('cenários fixos: flood → 429, qzxzqzx → 0 hits', async () => {
    const flood = await failure(fetchSearch({ q: 'flood' }));
    expect(flood.status).toBe(429);
    const zero = await fetchSearch({ q: 'qzxzqzx' });
    expect(zero.results).toEqual([]);
  });
});
