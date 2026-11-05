/**
 * MSW: `GET /api/v1/search/articles/` (backend/apps/search, ADR-023).
 *
 * Busca sobre o banco do demo (src/mocks/demo/db.ts), então todo resultado
 * aponta para um artigo que existe e abre. Roda no dev local (único mock
 * ativo ali, porque o Django local não liga a busca: SEARCH_FEATURE_ENABLED
 * = False → 503) e no site demo.
 *
 * Aproximação do full-text do Postgres: cada termo precisa aparecer em
 * título, resumo ou corpo, sem diferenciar acento nem caixa; título pesa
 * mais; empate desfeito pela data. `query_terms_expanded` devolve os termos
 * sem acento (o mark.js do <HighlightedText> já ignora diacríticos).
 *
 * Cenários fixos, mantidos para a UX dos estados de erro/vazio:
 *   - `q=flood`   → 429 com `retry_after: 23` (corpo e header);
 *   - `q=qzxzqzx` → 0 resultados.
 *
 * Desvio do backend: o serializer real devolve
 * `author: {id, display_name, slug}`; o frontend lê `author.name`. O mock
 * segue o tipo do frontend (src/pages/Buscar/types.ts).
 */
import { HttpResponse } from 'msw';
import { demoDb } from '@/mocks/demo/db';
import { route } from '@/mocks/demo/http';
import { fullName } from '@/mocks/demo/serializers';

const VARY = 'Authorization, Accept-Encoding';
const MIN_Q = 2;
const MAX_Q = 200;
const MAX_PER_PAGE = 50;

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function cacheHeaders() {
  return {
    'Cache-Control': demoDb.currentUser()
      ? 'private, max-age=60'
      : 'public, max-age=60, stale-while-revalidate=300',
    Vary: VARY,
    'X-Cache': 'MISS',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

const errorBody = (error: string, detail: string, status: number) =>
  HttpResponse.json({ error, detail }, { status });

/** Cursor opaco: offset em base64 (o real é HMAC; o cliente não o lê). */
const encodeCursor = (offset: number) => btoa(`o:${offset}`);
function decodeCursor(cursor: string) {
  try {
    const m = /^o:(\d+)$/.exec(atob(cursor));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export const searchHandlers = [
  route('get', '/search/articles/', ({ request }) => {
    const started = Date.now();
    const p = new URL(request.url).searchParams;
    const q = (p.get('q') ?? '').trim();

    if (q.toLowerCase() === 'flood')
      return HttpResponse.json(
        { error: 'rate_limit_exceeded', retry_after: 23 },
        {
          status: 429,
          headers: { 'Retry-After': '23', 'X-Cache': 'BYPASS', Vary: VARY },
        },
      );

    if (q.length < MIN_Q)
      return errorBody('query_too_short', `mínimo ${MIN_Q} caracteres`, 400);
    if (q.length > MAX_Q)
      return errorBody('query_too_long', `máximo ${MAX_Q} caracteres`, 400);

    const terms = Array.from(new Set(fold(q).split(/\s+/).filter(Boolean)));

    let offset = 0;
    const cursor = p.get('cursor');
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded === null)
        return errorBody(
          'cursor_invalid',
          'Cursor inválido. Recomece a paginação.',
          400,
        );
      offset = decoded;
    }
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, Number(p.get('per_page')) || 20),
    );

    const author = p.get('author');
    const category = p.get('category');
    const de = p.get('de') ? Date.parse(p.get('de')!) : null;
    const ate = p.get('ate') ? Date.parse(p.get('ate')!) : null;
    const { articles, categories } = demoDb.state;

    const hits = articles
      .filter((a) => a.status === 'published' && a.published_at)
      .filter((a) => !author || a.author_id === author)
      .filter(
        (a) =>
          !category ||
          String(a.category_id) === category ||
          categories.find((c) => c.id === a.category_id)?.slug === category,
      )
      .filter((a) => {
        const t = Date.parse(a.published_at!);
        return (de === null || t >= de) && (ate === null || t <= ate);
      })
      .map((a) => {
        const title = fold(a.title);
        const rest = fold(`${a.excerpt} ${a.body}`);
        const found = terms.every((t) => title.includes(t) || rest.includes(t));
        const inTitle = terms.filter((t) => title.includes(t)).length;
        return {
          a,
          found,
          score: (inTitle * 2 + terms.length) / (terms.length * 3),
        };
      })
      .filter((h) => h.found)
      .sort(
        (x, y) =>
          y.score - x.score ||
          y.a.published_at!.localeCompare(x.a.published_at!),
      );

    const page = hits.slice(offset, offset + perPage);
    const next = offset + perPage < hits.length ? offset + perPage : null;

    return HttpResponse.json(
      {
        results: page.map(({ a, score }) => {
          const user = demoDb.findUser(a.author_id);
          return {
            id: a.id,
            title: a.title,
            slug: a.slug,
            excerpt: a.excerpt,
            published_at: a.published_at,
            author: { id: a.author_id, name: user ? fullName(user) : '' },
            category: categories.find((c) => c.id === a.category_id) ?? null,
            cover_url: a.cover_image,
            score: Math.round(score * 1000) / 1000,
          };
        }),
        next_cursor: next === null ? null : encodeCursor(next),
        total_estimate: hits.length,
        query_terms_expanded: terms,
        took_ms: Math.max(8, Date.now() - started + 18),
      },
      { headers: cacheHeaders() },
    );
  }),
];
