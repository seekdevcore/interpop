/**
 * Spec: SearchResults orquestra 5 estados (DESIGN-v3 §2.5).
 *
 * Estratégia: mockamos `useSearch` para forçar cada branch. Não tocamos
 * em rede aqui — o teste do hook real cobre rede + Bug 6 + retry policy
 * em `hooks/__tests__/useSearch.test.tsx`. Aqui testamos a renderização.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { SearchResults } from '../components/SearchResults';
import * as useSearchModule from '../hooks/useSearch';
import type { SearchResultPage } from '../types';

function wrap(node: ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

const page = (overrides: Partial<SearchResultPage> = {}): SearchResultPage => ({
  results: [
    {
      id: 'id-1',
      title: 'O kpop hoje',
      slug: 'kpop-hoje',
      excerpt: 'Texto curto.',
      published_at: '2026-05-01T00:00:00Z',
      author: { id: 'a', name: 'Ana' },
      category: { id: 1, name: 'Música', slug: 'musica' },
      cover_url: null,
      score: 0.1,
    },
  ],
  next_cursor: null,
  total_estimate: 1,
  query_terms_expanded: ['kpop'],
  took_ms: 30,
  ...overrides,
});

type UseSearchReturn = ReturnType<typeof useSearchModule.useSearch>;

function mockUseSearch(partial: Partial<UseSearchReturn>) {
  // Cast intencional: o hook real retorna ~25 props do TanStack —
  // só nos importam as usadas pelo SearchResults.
  vi.spyOn(useSearchModule, 'useSearch').mockReturnValue(
    partial as UseSearchReturn,
  );
}

describe('SearchResults — 5 estados (CA01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Empty: q < 2 chars → EmptyState', () => {
    mockUseSearch({ isEnabled: false, deferredQ: 'k' });
    render(wrap(<SearchResults />));
    expect(screen.getByText(/digite ao menos 2 caracteres/i)).toBeDefined();
  });

  it('Loading: primeiro fetch → ResultsSkeleton', () => {
    mockUseSearch({
      isEnabled: true,
      isLoading: true,
      isFetching: true,
      deferredQ: 'kpop',
    });
    render(wrap(<SearchResults />));
    expect(
      screen.getByRole('status', { name: /carregando resultados/i }),
    ).toBeDefined();
  });

  it('NoResults: total_estimate=0 → EmptyResults', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'qzxzqzx',
      data: {
        pages: [page({ results: [], total_estimate: 0 })],
        pageParams: [],
      },
    });
    render(wrap(<SearchResults />));
    expect(screen.getByText(/nada encontrado para .qzxzqzx./i)).toBeDefined();
  });

  it('Results: renderiza cabeçalho + lista de ResultCards', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'kpop',
      data: { pages: [page()], pageParams: [] },
    });
    render(wrap(<SearchResults />));
    expect(screen.getByText(/1 resultado/i)).toBeDefined();
    // HighlightedText quebra "O kpop hoje" em ["O ", <mark>kpop</mark>, " hoje"]
    // Buscar via textContent normalizado do link âncora do ResultCard
    const link = screen.getByRole('link', { name: /kpop/i });
    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'O kpop hoje',
    );
  });

  it('Plural: total ≠ 1 escreve "resultados"', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'kpop',
      data: {
        pages: [page({ total_estimate: 42 })],
        pageParams: [],
      },
    });
    render(wrap(<SearchResults />));
    expect(screen.getByText(/42 resultados/i)).toBeDefined();
  });

  it('hasNextPage: renderiza botão "Carregar mais"', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'kpop',
      hasNextPage: true,
      data: { pages: [page()], pageParams: [] },
    });
    render(wrap(<SearchResults />));
    expect(
      screen.getByRole('button', { name: /carregar mais/i }),
    ).toBeDefined();
  });

  it('RateLimited (429): renderiza countdown', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'kpop',
      isError: true,
      error: {
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '23' },
          data: { retry_after: 23 },
        },
      } as unknown as Error,
      refetch: vi.fn() as unknown as UseSearchReturn['refetch'],
    });
    render(wrap(<SearchResults />));
    expect(screen.getByText(/muitas buscas/i)).toBeDefined();
    expect(screen.getByText(/aguarde 23s/i)).toBeDefined();
  });

  it('Error genérico: throw para ErrorBoundary', () => {
    mockUseSearch({
      isEnabled: true,
      deferredQ: 'kpop',
      isError: true,
      error: new Error('Boom!'),
    });
    // React loga o throw em console.error — silenciamos para o test output
    // ficar limpo. (O throw é o comportamento esperado.)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() => render(wrap(<SearchResults />))).toThrow('Boom!');
    consoleError.mockRestore();
  });
});
