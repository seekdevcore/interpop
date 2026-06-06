/**
 * MSW handlers para `/api/v1/search/articles/` (fix BLOQUEIO-1 do
 * REVIEW-PHASE-3 + T30.1.X12).
 *
 * Por que existe: dev local roda Vite na 5173; backend Django roda na
 * 8000 (não embedded). Sem backend ativo, `/buscar` mostra Error.
 * Estes handlers entregam fixtures plausíveis baseadas no contract da
 * Fase 2 (DESIGN-v3 §2.4 + ADR-022 query_terms_expanded) — suficiente
 * para validar UX dos 5 estados sem subir Django.
 *
 * Cenários simulados (controlados pela query `q`):
 *   - `q=kpop` → 142 hits, 10 retornados, com `query_terms_expanded`
 *     para o highlight casar plurais pt-BR.
 *   - `q=qzxzqzx` (qualquer query sem matches) → 0 hits.
 *   - `q=flood` → 429 (rate limit), `retry_after: 23` no payload e header.
 *   - default → success com 10 hits genéricos.
 *
 * Sprint 5: cenários por filtro (autor, editoria, range datas), cursor
 * pagination simulada, latência artificial para visualizar Skeleton.
 */
import { http, HttpResponse, delay } from 'msw';

// MSW v2 matcha por origem: path relativo `/api/...` só intercepta requests
// same-origin. Como axios (src/services/api.ts) usa baseURL absoluta
// `http://localhost:8000`, os requests reais são cross-origin do dev server
// `:5173`. Padrão `*//api/...` (qualquer protocolo + host) garante captura
// independentemente de `VITE_API_URL`. Bug descoberto no smoke manual da
// Fase 3 — todas as 4 chamadas estavam caindo no Django real (503).
const ENDPOINT = '*/api/v1/search/articles/';

const SAMPLE_AUTHORS = [
  { id: 'a-ana', name: 'Ana Lima' },
  { id: 'a-bia', name: 'Bia Mota' },
  { id: 'a-carlos', name: 'Carlos Rocha' },
] as const;

const SAMPLE_CATEGORIES = [
  { id: 1, name: 'Música', slug: 'musica' },
  { id: 2, name: 'Moda', slug: 'moda' },
  { id: 3, name: 'Cinema', slug: 'cinema' },
  { id: 4, name: 'Literatura', slug: 'literatura' },
  { id: 5, name: 'Cultura Digital', slug: 'cultura-digital' },
] as const;

function makeResults(query: string, n: number) {
  return Array.from({ length: n }).map((_, i) => {
    const category = SAMPLE_CATEGORIES[i % SAMPLE_CATEGORIES.length];
    const author = SAMPLE_AUTHORS[i % SAMPLE_AUTHORS.length];
    return {
      id: `mock-${i + 1}`,
      title: `O ${query} hoje: análise editorial ${i + 1}`,
      slug: `${query}-hoje-${i + 1}`,
      excerpt: `Análise crítica sobre o cenário de ${query} na cultura pop. Texto editorial enxuto para demonstrar a UX da busca.`,
      published_at: new Date(
        Date.now() - i * 86_400_000 * 3, // 3 dias entre cada
      ).toISOString(),
      author,
      category,
      cover_url: null, // força placeholder editorial (data-variant)
      score: 1 - i * 0.05,
    };
  });
}

export const searchHandlers = [
  http.get(ENDPOINT, async ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';

    // Latência artificial para visualizar Skeleton em dev (sem isso o
    // mock responde em 0ms e a transição empty→loading→results é
    // invisível). 300ms casa com o budget de p50 do DESIGN §0.
    await delay(300);

    // Cenário: 429 rate limit (forçado por `q=flood`)
    if (q.toLowerCase() === 'flood') {
      return HttpResponse.json(
        {
          error: 'rate_limit_exceeded',
          retry_after: 23,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '23',
            'X-Cache': 'BYPASS',
            Vary: 'Authorization, Accept-Encoding',
          },
        },
      );
    }

    // Cenário: 0 hits
    if (q.toLowerCase() === 'qzxzqzx') {
      return HttpResponse.json(
        {
          results: [],
          next_cursor: null,
          total_estimate: 0,
          query_terms_expanded: [q.toLowerCase()],
          took_ms: 12,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            Vary: 'Authorization, Accept-Encoding',
            'X-Cache': 'MISS',
          },
        },
      );
    }

    // Cenário: success genérico (10 hits)
    const results = makeResults(q || 'kpop', 10);
    return HttpResponse.json(
      {
        results,
        next_cursor: null, // sem paginação no MVP (cap 50 páginas → S5)
        total_estimate: q.toLowerCase() === 'kpop' ? 142 : 10,
        // `query_terms_expanded` simulado (stems pt-BR via ts_lexize no
        // backend real). Inclui forma reduzida do termo + variantes.
        query_terms_expanded: q
          ? Array.from(new Set([q.toLowerCase(), q.toLowerCase().slice(0, 4)]))
          : [],
        took_ms: 47,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          Vary: 'Authorization, Accept-Encoding',
          'X-Cache': 'MISS',
        },
      },
    );
  }),
];
