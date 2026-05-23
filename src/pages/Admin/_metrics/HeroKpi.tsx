/**
 * HeroKpi — big-number KPI card (Linear/Vercel pattern).
 *
 * Mostra valor atual + delta chip (com seta ▲/▼/·) vs janela anterior
 * idêntica. `delta=null` significa "não aplicável" (renderiza traço).
 *
 * E4 do reorganization-proposal: extraído de Admin/index.tsx:1224 (era
 * inline) para reuso futuro e clareza. CSS continua em Admin.css (F13
 * vai resolver a co-localização de CSS).
 */
import { formatNumber } from './formatNumber';

interface HeroKpiProps {
  label: string;
  value: number;
  /** Difference vs previous identical window. `null` = not applicable. */
  delta: number | null;
  deltaSuffix: string;
}

export function HeroKpi({ label, value, delta, deltaSuffix }: HeroKpiProps) {
  const direction =
    delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '·';

  return (
    <div className="metrics__hero-card">
      <p className="metrics__hero-label">{label}</p>
      <p className="metrics__hero-value">{formatNumber(value)}</p>
      <div className="metrics__hero-meta">
        {delta !== null ? (
          <span className={`metrics__delta metrics__delta--${direction}`}>
            <span aria-hidden="true">{arrow}</span>
            {delta > 0 ? '+' : ''}
            {formatNumber(delta)}
          </span>
        ) : (
          <span className="metrics__delta metrics__delta--neutral">—</span>
        )}
        <span className="metrics__hero-context">{deltaSuffix}</span>
      </div>
    </div>
  );
}
