/**
 * Spec: T30.1.16 (useSearch) + T30.1.X7 (Bug 6 fix `next_cursor null`).
 *
 * Foco do TDD:
 *   - getNextPageParam DEVE converter `null` → `undefined` para que
 *     TanStack pare de paginar (sem isso, fetch infinito — Bug 6).
 *   - `enabled` deve ser falso quando q < 2 chars (CA01).
 *   - 4xx NÃO deve disparar retry (sem ônus em rate limit p/ erro do user).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { useSearch, _internals } from '../useSearch';
import * as searchService from '../../services/searchService';
import type { SearchResultPage } from '../../types';

function makeWrapper(initialUrl: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const samplePage = (cursor: string | null): SearchResultPage => ({
  results: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Como o kpop reinventou a indústria',
      slug: 'kpop-industria',
      excerpt: 'kpop hoje move mais playlists no Spotify Brasil…',
      published_at: '2026-05-20T10:00:00Z',
      author: { id: 'a1', name: 'João Silva' },
      category: { id: 1, name: 'Música', slug: 'musica' },
      cover_url: null,
      score: 0.42,
    },
  ],
  next_cursor: cursor,
  total_estimate: 142,
  query_terms_expanded: ['kpop'],
  took_ms: 45,
});

describe('useSearch — getNextPageParam (Bug 6 / T30.1.X7)', () => {
  it('converte next_cursor null → undefined → hasNextPage === false', () => {
    // Verifica o exporte interno usado pelo useInfiniteQuery.
    // Manter o teste em nível unitário evita timing de waitFor + rede.
    const last = samplePage(null);
    expect(_internals.getNextPageParam(last)).toBeUndefined();
  });

  it('mantém next_cursor string quando há mais páginas', () => {
    const last = samplePage('abc.def.ghi');
    expect(_internals.getNextPageParam(last)).toBe('abc.def.ghi');
  });
});

describe('useSearch — enabled rule (CA01)', () => {
  beforeEach(() => {
    vi.spyOn(searchService, 'fetchSearch').mockResolvedValue(samplePage(null));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NÃO dispara fetch quando q.length < 2', async () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: makeWrapper('/buscar?q=a'),
    });
    // Aguarda um tick para garantir que o effect rodou.
    await new Promise((r) => setTimeout(r, 20));
    expect(searchService.fetchSearch).not.toHaveBeenCalled();
    expect(result.current.status).not.toBe('success');
  });

  it('dispara fetch quando q.length ≥ 2 (após debounce)', async () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: makeWrapper('/buscar?q=kpop'),
    });
    await waitFor(
      () => {
        expect(result.current.data?.pages[0].total_estimate).toBe(142);
      },
      { timeout: 1500 },
    );
    expect(searchService.fetchSearch).toHaveBeenCalled();
  });
});

describe('useSearch — retry policy', () => {
  it('NÃO retenta em 4xx (politica anti-rate-limit)', () => {
    const err = {
      isAxiosError: true,
      response: { status: 400 },
    } as never;
    expect(_internals.shouldRetry(0, err)).toBe(false);
    expect(
      _internals.shouldRetry(0, { response: { status: 429 } } as never),
    ).toBe(false);
  });

  it('Retenta 1 vez em 5xx', () => {
    const err = { response: { status: 503 } } as never;
    expect(_internals.shouldRetry(0, err)).toBe(true);
    expect(_internals.shouldRetry(1, err)).toBe(false);
  });
});
