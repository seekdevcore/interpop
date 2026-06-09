/**
 * Skeletons para Suspense fallback.
 *
 * - `BuscarSkeleton`: shell inteira da rota (lazy `<Buscar/>`).
 * - `ResultsSkeleton`: 6 cards skeleton — usado dentro da página
 *   enquanto o useSearch primeiro busca.
 *
 * Visual: shimmer suave alternando `--clr-skeleton` ↔ `--clr-skeleton-shimmer`
 * (tokens já light + dark). Sem inline animations — tudo em CSS para honrar
 * `prefers-reduced-motion`.
 */

export function BuscarSkeleton() {
  return (
    <div
      className="container buscar-skeleton"
      role="status"
      aria-label="Carregando página de busca"
    >
      <div className="buscar-skeleton__header" />
      <div className="buscar-skeleton__input" />
      <div className="buscar-skeleton__chips" />
      <ResultsSkeleton count={4} />
    </div>
  );
}

interface ResultsSkeletonProps {
  count?: number;
}

export function ResultsSkeleton({ count = 6 }: ResultsSkeletonProps) {
  // a11y (axe-core): `role="status"` no <ul> sobrescreve o role="list"
  // implícito e os <li> filhos perdem o ancestral de lista válido. Fix:
  // landmark live region vai num <div> wrapper; o <ul> mantém semântica
  // de lista intacta. (Achado do REVIEW-PHASE-3 BLOQUEIO-2 + axe.)
  return (
    <div role="status" aria-label="Carregando resultados">
      <ul className="results-skeleton" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="results-skeleton__card">
            <div className="results-skeleton__thumb" />
            <div className="results-skeleton__body">
              <div className="results-skeleton__line results-skeleton__line--lg" />
              <div className="results-skeleton__line results-skeleton__line--md" />
              <div className="results-skeleton__line results-skeleton__line--sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
