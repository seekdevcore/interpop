/**
 * A11y E2E via `vitest-axe` (fix BLOQUEIO-2 do REVIEW-PHASE-3, ADR-045).
 *
 * Por que existe: o commit `f0b3f34` declarava `[a11y axe-core]` mas o
 * arquivo nunca foi criado — `grep -rn "vitest-axe" src/` retornava
 * vazio. O REVIEW-PHASE-3 marcou como BLOQUEIO para o PR US30.1. Esta
 * suite fecha o gate.
 *
 * Estratégia:
 *   1. Estados em isolamento (rápido, sem mock TanStack): cobre 5 cenários
 *      (Empty, Loading via Skeleton, NoResults, RateLimited, Error) +
 *      componentes-chave (SearchInput, ResultCard, FilterChips).
 *   2. Integração leve da página `<Buscar>` sem rede (sem ?q → Empty
 *      state) — pega regressões de landmark uniqueness (1 h1, 1 search,
 *      etc.) que axe avalia sobre a árvore inteira.
 *
 * Visual regression dos 5 estados em viewport real (light + dark + mobile)
 * fica para Sprint 5 via Playwright `toHaveScreenshot` (ADR-042).
 * NVDA/VoiceOver manual já está no roadmap como TX-20.
 */
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
// vitest-axe@0.1.0 NÃO auto-extende `expect` ao importar `extend-expect`
// (esse arquivo só declara o tipo no namespace `Vi`, e Vitest 4 usa o
// módulo `vitest` direto). Runtime: chamamos `expect.extend` manualmente.
// Tipo: aumentamos o módulo `vitest` para o TS reconhecer o matcher.
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

expect.extend({ toHaveNoViolations });

import { EmptyState } from '../components/EmptyState';
import { EmptyResults } from '../components/EmptyResults';
import { RateLimitedState } from '../components/RateLimitedState';
import { SearchErrorFallback } from '../components/SearchErrorFallback';
import { ResultsSkeleton } from '../components/Skeletons';
import { SearchInput } from '../components/SearchInput';
import { ResultCard } from '../components/ResultCard';
import { FilterChips } from '../components/FilterChips';
import Buscar from '../Buscar';
import type { SearchResultItem } from '../types';

/** Wrapper mínimo (Router + Query) para componentes que precisam de hooks. */
function wrap(node: ReactNode, url = '/buscar') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleItem: SearchResultItem = {
  id: 'id-1',
  title: 'O kpop hoje',
  slug: 'kpop-hoje',
  excerpt: 'Análise editorial sobre o cenário atual.',
  published_at: '2026-05-01T00:00:00Z',
  author: { id: 'a', name: 'Ana' },
  category: { id: 1, name: 'Música', slug: 'musica' },
  cover_url: null,
  score: 0.5,
};

describe('A11y axe-core — 5 estados + componentes-chave (ADR-045)', () => {
  it('EmptyState: zero violações', async () => {
    const { container } = render(<EmptyState />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Loading (ResultsSkeleton): zero violações', async () => {
    const { container } = render(<ResultsSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmptyResults: zero violações', async () => {
    const { container } = render(<EmptyResults query="qzxzqzx" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('RateLimitedState: zero violações', async () => {
    const { container } = render(
      <RateLimitedState retryAfterSeconds={23} onRetry={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SearchErrorFallback (Error genérico): zero violações', async () => {
    const { container } = render(
      <SearchErrorFallback
        error={new Error('Falha de rede')}
        resetErrorBoundary={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('A11y axe-core — componentes interativos', () => {
  it('SearchInput: zero violações (form role="search" + landmark)', async () => {
    const { container } = render(wrap(<SearchInput />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ResultCard com cover ausente (placeholder letra): zero violações', async () => {
    const { container } = render(
      wrap(<ResultCard item={sampleItem} terms={['kpop']} />),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ResultCard com cover_url: zero violações (alt="" decorativo)', async () => {
    const { container } = render(
      wrap(
        <ResultCard
          item={{ ...sampleItem, cover_url: 'https://example.com/cover.jpg' }}
          terms={['kpop']}
        />,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FilterChips estado vazio: zero violações', async () => {
    const { container } = render(wrap(<FilterChips />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FilterChips com filtros aplicados: zero violações', async () => {
    const { container } = render(
      wrap(<FilterChips />, '/buscar?q=kpop&category=1&author=joao-silva'),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('A11y axe-core — integração página Buscar', () => {
  it('Buscar (Empty inicial): landmark uniqueness, 1 h1, form role=search', async () => {
    const { container } = render(wrap(<Buscar />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Buscar com ?q válido (Empty enquanto enabled=false ainda): zero violações', async () => {
    // q.length=1 < 2 → ainda EmptyState; landmark + input pré-populado.
    const { container } = render(wrap(<Buscar />, '/buscar?q=k'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
