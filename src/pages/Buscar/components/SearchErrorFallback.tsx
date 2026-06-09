import type { FallbackProps } from 'react-error-boundary';

/**
 * Fallback do <ErrorBoundary> para o sub-tree de resultados (ADR-030-FE).
 *
 * Resilient sub-tree: o ErrorBoundary só envolve `<SearchResults>` —
 * NÃO o <SearchInput>. Se a renderização dos resultados quebrar (axios
 * timeout, parser de payload corrompido, throw em algum componente
 * filho), o input continua respondendo, o usuário ajusta o termo, o
 * `resetKeys` do react-error-boundary re-mounta o sub-tree quando
 * `deferredQ` muda. Não perdemos a página inteira.
 *
 * Mensagem em pt-BR; botão "Tentar novamente" chama `resetErrorBoundary`.
 */
export function SearchErrorFallback({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  return (
    <div
      className="search-state search-state--error"
      role="alert"
      aria-live="assertive"
      id="search-error"
    >
      <h2 className="search-state__headline">Não foi possível buscar agora.</h2>
      <p className="search-state__hint">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        type="button"
        className="search-state__retry"
        onClick={resetErrorBoundary}
      >
        Tentar novamente
      </button>
    </div>
  );
}
