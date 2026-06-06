/**
 * Página `/buscar` — busca editorial full-text (US30.1).
 *
 * Estrutura (DESIGN-v3 §2.5):
 *   <header>           h1 "Buscar" (landmark editorial visível, ADR-029).
 *   <SearchInput />    form role="search" + input type="search".
 *   <FilterChips />    shell URL-driven; popovers em Sprint 5.
 *   <ErrorBoundary>    ADR-030-FE — resilient sub-tree, NÃO envolve input.
 *     <Suspense fb=ResultsSkeleton>
 *       <SearchResults />   orquestra 5 estados.
 *
 * Pontos finos:
 *   - `useQueryClient` + `resetKeys={[deferredQ]}` no boundary: cada
 *     mudança de termo reseta o boundary; bug pontual em um item da SERP
 *     não trava futuras buscas.
 *   - SearchInput vive FORA do boundary — usuário sempre pode trocar a
 *     query mesmo quando os resultados quebraram.
 */
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryClient } from '@tanstack/react-query';

import { SearchInput } from './components/SearchInput';
import { FilterChips } from './components/FilterChips';
import { SearchResults } from './components/SearchResults';
import { SearchErrorFallback } from './components/SearchErrorFallback';
import { ResultsSkeleton } from './components/Skeletons';
import { useSearch } from './hooks/useSearch';

import './Buscar.css';
import './components/FilterChips.css';
import './components/ResultCard.css';
import './components/SearchStates.css';

/**
 * Sub-componente para acessar `deferredQ` (sai do hook único) e usar
 * como `resetKeys`. Ficar fora do `useSearch` evita duplicar fetch.
 */
function ResultsRegion() {
  const { deferredQ } = useSearch();
  const qc = useQueryClient();

  return (
    <ErrorBoundary
      FallbackComponent={SearchErrorFallback}
      resetKeys={[deferredQ]}
      onReset={() => {
        // Quando o usuário clica "Tentar novamente" OU muda a query,
        // invalidamos o cache da chave 'search' para forçar fetch fresh.
        qc.resetQueries({ queryKey: ['search'] });
      }}
    >
      <Suspense fallback={<ResultsSkeleton count={6} />}>
        <SearchResults />
      </Suspense>
    </ErrorBoundary>
  );
}

export function Buscar() {
  return (
    <main className="container buscar-page">
      <header className="buscar-page__header">
        <h1 className="buscar-page__title">Buscar</h1>
        <p className="buscar-page__subtitle">
          Procure no acervo editorial da Interpop.
        </p>
      </header>

      <SearchInput />

      <FilterChips />

      <ResultsRegion />
    </main>
  );
}

export default Buscar;
