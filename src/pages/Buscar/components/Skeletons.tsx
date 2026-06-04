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
  return (
    <ul
      className="results-skeleton"
      role="status"
      aria-label="Carregando resultados"
    >
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
  );
}
