/**
 * formatNumber — formatador pt-BR consistente para KPIs do dashboard.
 *
 * Compartilhado entre HeroKpi + SmallStat + ArticleRanking para evitar
 * 3 cópias. Não foi pra src/utils/formatDate.ts porque formato numérico
 * é dimensão diferente (locale + thousand separator), não data.
 *
 * Quando o projeto tiver outros lugares precisando, promover para
 * src/utils/formatNumber.ts.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}
