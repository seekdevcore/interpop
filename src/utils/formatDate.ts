/**
 * formatDate utilities — formatação consistente de datas pt-BR.
 *
 * Consolida 4+ implementações ad-hoc (NewsCard, AdminPosts, Article,
 * CommentItem + usos inline em CreatePost/MetricsDashboard/Admin) com
 * variações sutis de formato que iam divergindo.
 *
 * 3 formatadores cobrem todos os casos de uso:
 *  - formatDateShort  → "08 jun 2026"            (cards, tabelas, listagens)
 *  - formatDateLong   → "8 de junho de 2026"     (header de artigo, post pages)
 *  - formatDateTime   → "08 jun 2026, 14:30"     (comentários, audit, logs UI)
 *
 * Todas aceitam `string | null | undefined` e retornam '' como fallback —
 * o caller decide se exibe placeholder ("—") via `formatDateShort(x) || '—'`.
 *
 * Nota: usa `Intl.DateTimeFormat` que é cached internamente pelo browser
 * (criar instância nova a cada call é barato — ms-scale).
 */

type DateInput = string | null | undefined;

function _parse(input: DateInput): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** "08 jun 2026" — cards, listagens, tabelas admin. */
export function formatDateShort(input: DateInput): string {
  const d = _parse(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** "8 de junho de 2026" — header de artigo, página de leitura longa. */
export function formatDateLong(input: DateInput): string {
  const d = _parse(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** "08 jun 2026, 14:30" — comentários, audit trail, logs UI. */
export function formatDateTime(input: DateInput): string {
  const d = _parse(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
