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
    <dl className="metrics__small-card">
      {/* dt=rótulo, dd=valor (evita o alerta "possible heading" do WAVE). */}
      <dt className="metrics__small-label">{label}</dt>
      <dd className="metrics__small-value">{formatNumber(value)}</dd>
    </dl>
  );
}
