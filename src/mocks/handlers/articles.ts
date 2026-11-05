/**
 * Demo: `/api/v1/categories/` e `/api/v1/articles/*`
 * (backend/apps/articles/{views,serializers}.py).
 *
 * Desvio consciente: o backend real devolve rascunho no detalhe para
 * qualquer um (achado de segurança registrado no PR); o demo responde 404
 * para quem não é editor+, que é o comportamento que a tela espera.
 * Escrita de artigo não checa `IsNotBanned` — igual ao backend (outro
 * achado do PR): editor banido ainda publica.
 */
import { demoDb } from '@/mocks/demo/db';
import type { DemoArticle, DemoUser } from '@/mocks/demo/fixtures';
import {
  authenticate,
  bool,
  charField,
  detail,
  errorBag,
  fileUrl,
  isAdmin,
  isStaff,
  json,
  matchesSearch,
  MSG,
  noContent,
  paginate,
  readBody,
  route,
  safeDecode,
  type Body,
  type ErrorBag,
} from '@/mocks/demo/http';
import { articleDetail, articleListItem } from '@/mocks/demo/serializers';

const ORDERING_FIELDS = ['published_at', 'view_count', 'created_at'] as const;
type OrderField = (typeof ORDERING_FIELDS)[number];

/** Comparação do Postgres: NULL é o maior valor (DESC → nulos primeiro). */
function compare(a: DemoArticle, b: DemoArticle, field: OrderField) {
  const x = a[field];
  const y = b[field];
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? -1 : 1;
}

/** OrderingFilter: `ordering=-view_count,created_at`; campos fora da lista são ignorados. */
function sortArticles(items: DemoArticle[], ordering: string | null) {
  const keys = (ordering ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) =>
      (ORDERING_FIELDS as readonly string[]).includes(k.replace(/^-/, '')),
    );
  const spec = keys.length ? keys : ['-published_at', '-created_at'];
  return [...items].sort((a, b) => {
    for (const key of spec) {
      const desc = key.startsWith('-');
      const c = compare(a, b, key.replace(/^-/, '') as OrderField);
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

const findArticle = (slug: string) =>
  demoDb.state.articles.find((a) => a.slug === safeDecode(slug)) ?? null;

const notFound = () => detail(MSG.notFound('Article'), 404);

/** `IsOwnerOrAdmin` (has_object_permission). */
const canEdit = (user: DemoUser, a: DemoArticle) =>
  isAdmin(user) || a.author_id === user.id;

/** `PrimaryKeyRelatedField(queryset=Category, allow_null=True)`. */
function categoryField(bag: ErrorBag, body: Body) {
  if (!('category_id' in body)) return undefined;
  const raw = body.category_id;
  if (raw === null || raw === '') return null;
  const id = Number(raw);
  const exists =
    Number.isInteger(id) && demoDb.state.categories.some((c) => c.id === id);
  if (!exists) {
    bag.add('category_id', MSG.invalidPk(String(raw)));
    return undefined;
  }
  return id;
}

/** `ChoiceField(choices=Status)`. */
function statusField(
  bag: ErrorBag,
  body: Body,
): DemoArticle['status'] | undefined {
  if (!('status' in body)) return undefined;
  const v = String(body.status);
  if (v === 'draft' || v === 'published') return v;
  bag.add('status', `"${v}" não é um escolha válido.`);
  return undefined;
}

const CAPTION = {
  required: 'A legenda da capa é obrigatória.',
  blank: 'A legenda da capa é obrigatória (ex.: "Foto: Agência").',
};

/**
 * ArticleWriteSerializer. `partial` = PATCH (nada é obrigatório).
 * Devolve os campos válidos ou o erro no formato do DRF.
 */
function validateWrite(body: Body, partial: boolean) {
  const bag = errorBag();
  const required = !partial;
  const fields = {
    title: charField(bag, body, 'title', { required, maxLength: 500 }),
    excerpt: charField(bag, body, 'excerpt', { required, maxLength: 1000 }),
    body: charField(bag, body, 'body', { required }),
    cover_caption: charField(bag, body, 'cover_caption', {
      required,
      maxLength: 300,
      messages: CAPTION,
    }),
    category_id: categoryField(bag, body),
    status: statusField(bag, body),
    is_featured: 'is_featured' in body ? bool(body.is_featured) : undefined,
    cover_image: fileUrl(body.cover_image) ?? undefined,
  };
  if (bag.has()) return { error: bag.response() } as const;
  // validate(): só roda sem erro de campo
  if (!partial && !fields.cover_image)
    return {
      error: json({ cover_image: ['A imagem de capa é obrigatória.'] }, 400),
    } as const;
  return { fields } as const;
}

/** Só um destaque por vez (Article.save do backend). */
function enforceSingleFeatured(a: DemoArticle) {
  if (!a.is_featured) return;
  demoDb.state.articles.forEach((o) => {
    if (o.id !== a.id) o.is_featured = false;
  });
}

/** Resposta de create/update: os campos do ArticleWriteSerializer. */
const writeOut = (a: DemoArticle) => ({
  title: a.title,
  excerpt: a.excerpt,
  body: a.body,
  cover_image: a.cover_image,
  cover_caption: a.cover_caption,
  category_id: a.category_id,
  status: a.status,
  is_featured: a.is_featured,
});

/** Throttle de view por slug (o backend usa LocMem de 5 min por IP). */
const VIEW_WINDOW_MS = 5 * 60_000;
const lastView = new Map<string, number>();

export const articleHandlers = [
  route('get', '/categories/', ({ request }) => {
    const items = [...demoDb.state.categories].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    const page = paginate(request, items);
    return page.error ?? json(page.body);
  }),

  route('get', '/articles/', ({ request }) => {
    const viewer = demoDb.currentUser();
    const p = new URL(request.url).searchParams;
    const filled = (k: string) => {
      const v = p.get(k);
      return v === null || v === '' ? null : v;
    };
    const category = filled('category__slug');
    const status = filled('status');
    const featured = filled('is_featured');
    const users = demoDb.state.users;
    const items = demoDb.state.articles
      .filter((a) => (viewer && isStaff(viewer)) || a.status === 'published')
      .filter(
        (a) =>
          !category ||
          demoDb.state.categories.find((c) => c.id === a.category_id)?.slug ===
            category,
      )
      .filter((a) => !status || a.status === status)
      .filter((a) => featured === null || a.is_featured === bool(featured))
      .filter((a) => {
        const author = users.find((u) => u.id === a.author_id);
        return matchesSearch(request, [
          a.title,
          a.excerpt,
          a.body,
          author?.first_name,
          author?.last_name,
        ]);
      });
    const page = paginate(request, sortArticles(items, p.get('ordering')));
    if (page.error) return page.error;
    return json({
      ...page.body,
      results: page.body.results.map((a) => articleListItem(demoDb, a)),
    });
  }),

  route('post', '/articles/', async ({ request }) => {
    const auth = authenticate({ allow: isStaff, allowBanned: true });
    if (auth.error) return auth.error;
    const result = validateWrite(await readBody(request), false);
    if (result.error) return result.error;
    const f = result.fields;
    const now = demoDb.nowIso();
    const status = f.status ?? 'draft';
    const article: DemoArticle = {
      id: crypto.randomUUID(),
      slug: demoDb.uniqueSlug(f.title!),
      title: f.title!,
      excerpt: f.excerpt!,
      body: f.body!,
      cover_image: f.cover_image ?? null,
      cover_caption: f.cover_caption!,
      author_id: auth.user.id,
      category_id: f.category_id ?? null,
      status,
      is_featured: f.is_featured ?? false,
      view_count: 0,
      published_at: status === 'published' ? now : null,
      created_at: now,
      updated_at: now,
    };
    demoDb.state.articles.push(article);
    enforceSingleFeatured(article);
    return json(writeOut(article), 201);
  }),

  route<{ slug: string }>('get', '/articles/:slug/', ({ params }) => {
    const a = findArticle(params.slug);
    const viewer = demoDb.currentUser();
    if (!a || (a.status !== 'published' && !(viewer && isStaff(viewer))))
      return notFound();
    return json(articleDetail(demoDb, a));
  }),

  route<{ slug: string }>(
    'patch',
    '/articles/:slug/',
    async ({ params, request }) => {
      const auth = authenticate({ allow: isStaff, allowBanned: true });
      if (auth.error) return auth.error;
      const a = findArticle(params.slug);
      if (!a) return notFound();
      if (!canEdit(auth.user, a)) return detail(MSG.forbidden, 403);
      const result = validateWrite(await readBody(request), true);
      if (result.error) return result.error;
      const f = result.fields;
      if (f.title !== undefined) a.title = f.title;
      if (f.excerpt !== undefined) a.excerpt = f.excerpt;
      if (f.body !== undefined) a.body = f.body;
      if (f.cover_caption !== undefined) a.cover_caption = f.cover_caption;
      if (f.category_id !== undefined) a.category_id = f.category_id;
      if (f.is_featured !== undefined) a.is_featured = f.is_featured;
      if (f.cover_image) a.cover_image = f.cover_image;
      if (f.status !== undefined) {
        if (f.status === 'published' && !a.published_at)
          a.published_at = demoDb.nowIso();
        a.status = f.status;
      }
      a.updated_at = demoDb.nowIso();
      enforceSingleFeatured(a);
      return json(writeOut(a));
    },
  ),

  route<{ slug: string }>('delete', '/articles/:slug/', ({ params }) => {
    const auth = authenticate({ allow: isStaff, allowBanned: true });
    if (auth.error) return auth.error;
    const a = findArticle(params.slug);
    if (!a) return notFound();
    if (!canEdit(auth.user, a)) return detail(MSG.forbidden, 403);
    const state = demoDb.state;
    state.articles = state.articles.filter((x) => x.id !== a.id);
    state.comments = state.comments.filter((c) => c.article_id !== a.id);
    return noContent();
  }),

  route<{ slug: string }>('post', '/articles/:slug/view/', ({ params }) => {
    const a = findArticle(params.slug);
    const now = demoDb.now();
    if (a && a.status === 'published') {
      const last = lastView.get(a.slug);
      if (last === undefined || now - last >= VIEW_WINDOW_MS) {
        a.view_count += 1;
        lastView.set(a.slug, now);
      }
    }
    return noContent();
  }),
];
