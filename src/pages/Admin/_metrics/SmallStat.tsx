/**
 * SmallStat — cartão de KPI secundário (densidade maior que HeroKpi).
 *
 * E4 do reorganization-proposal: extraído de Admin/index.tsx:1254 inline.
 */
import { formatNumber } from './formatNumber';

interface SmallStatProps {
  label: string;
  value: number;
}

export function SmallStat({ label, value }: SmallStatProps) {
  return (
    <div className="metrics__small-card">
      <p className="metrics__small-value">{formatNumber(value)}</p>
      <p className="metrics__small-label">{label}</p>
    </div>
  );
}
