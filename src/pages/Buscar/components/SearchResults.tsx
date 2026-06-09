/**
 * Orquestrador dos 5 estados da busca (CA01 / DESIGN-v3 §2.5).
 *
 * Estados (ordem de prioridade na renderização):
 *   1. Empty             — q < 2 chars (não chamou backend).
 *   2. Loading           — primeiro fetch ou fetchNextPage.
 *   3. RateLimited       — 429 do backend; mostra countdown + retry.
 *   4. Error             — outros 4xx/5xx: THROW para subir ao ErrorBoundary.
 *   5. NoResults         — `total_estimate === 0`.
 *   6. Results           — render dos cards + "Carregar mais" se hasNextPage.
 *
 * Por que "lançar" em error em vez de tratar localmente:
 *   ADR-030-FE define que o sub-tree de resultados é envolvido por
 *   ErrorBoundary com `resetKeys={[deferredQ]}` — quando a query muda,
 *   o boundary reseta automaticamente. Lançar aqui mantém a página
 *   declarativa (boundary cuida do rollback de UI).
 *
 * aria-live no cabeçalho "X resultados" permite que SR anuncie a
 * mudança de contagem sem mover foco — leitura editorial não-intrusiva.
 */
import { useSearch } from '../hooks/useSearch';
import { isSearchError } from '../services/searchService';
import { ResultCard } from './ResultCard';
import { ResultsSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { EmptyResults } from './EmptyResults';
import { RateLimitedState } from './RateLimitedState';

export function SearchResults() {
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isEnabled,
    deferredQ,
    isError,
    error,
    refetch,
  } = useSearch();

  // 1. Empty inicial — usuário ainda não digitou o suficiente.
  if (!isEnabled) {
    return <EmptyState />;
  }

  // 3. RateLimited — capturamos 429 antes do throw para mostrar countdown.
  if (isError && isSearchError(error) && error.response?.status === 429) {
    const retryAfterHeader = error.response.headers?.['retry-after'];
    const retryAfterBody = error.response.data?.retry_after;
    const retryAfter =
      (typeof retryAfterHeader === 'string'
        ? Number(retryAfterHeader)
        : undefined) ?? retryAfterBody;
    return (
      <RateLimitedState
        retryAfterSeconds={retryAfter}
        onRetry={() => refetch()}
      />
    );
  }

  // 4. Erro genérico — lança para subir ao <ErrorBoundary>.
  if (isError) {
    throw error instanceof Error
      ? error
      : new Error('Erro ao buscar artigos. Tente novamente.');
  }

  // 2. Loading — primeira chamada (sem data ainda).
  if (isLoading || (isFetching && !data)) {
    return <ResultsSkeleton count={6} />;
  }

  // Sem data depois de tudo isso: estado inconsistente; renderiza skeleton
  // para não quebrar (defensive).
  if (!data) {
    return <ResultsSkeleton count={6} />;
  }

  const firstPage = data.pages[0];
  const total = firstPage.total_estimate;
  const allResults = data.pages.flatMap((p) => p.results);
  const terms = firstPage.query_terms_expanded;

  // 5. NoResults — backend respondeu mas estimou 0.
  if (total === 0 && allResults.length === 0) {
    return <EmptyResults query={deferredQ} />;
  }

  // 6. Results — header com contagem aria-live + cards + "Carregar mais".
  return (
    <section
      className="search-results"
      aria-label="Resultados da busca"
      aria-busy={isFetching}
    >
      <header className="search-results__header" aria-live="polite">
        <span className="search-results__count">
          {total} resultado{total === 1 ? '' : 's'}
        </span>
      </header>

      <ul className="search-results__list">
        {allResults.map((item) => (
          <li key={item.id} className="search-results__item">
            <ResultCard item={item} terms={terms} />
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="search-results__more">
          <button
            type="button"
            className="search-results__more-button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </section>
  );
}
