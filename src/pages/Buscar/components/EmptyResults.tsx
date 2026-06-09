/**
 * "Nada encontrado para X" — `total_estimate === 0` no payload.
 *
 * Difere de `EmptyState` (que é o estado inicial). Aqui o backend já
 * respondeu — mostramos a query buscada (entre aspas) e uma sugestão
 * acionável. Em Sprint 5 podemos adicionar "Você quis dizer Y" baseado
 * em `query_terms_expanded` quando o stem diverge da query original.
 */
interface EmptyResultsProps {
  query: string;
}

export function EmptyResults({ query }: EmptyResultsProps) {
  return (
    <div
      className="search-state search-state--no-results"
      role="status"
      aria-live="polite"
    >
      <p className="search-state__headline">Nada encontrado para “{query}”.</p>
      <p className="search-state__hint">
        Tente termos mais gerais (ex.: “kpop” em vez de “kpop 4ª geração”) ou
        verifique a grafia.
      </p>
    </div>
  );
}
