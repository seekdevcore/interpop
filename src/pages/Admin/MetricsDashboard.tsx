/**
 * MetricsDashboard — visual "dashboard" view for the admin Metrics page.
 *
 * Inspired by editorial-platform analytics surfaces (Substack Stats,
 * Ghost Admin, Posthog Insights, Plausible, Medium Stats) — the goal is
 * a magazine-grade panel for interpop, not a generic SaaS dashboard.
 *
 *   1. AreaChart "Atividade por dia"   — comments + likes time series
 *      (Plausible + Posthog: gradient fill, NO dot markers — markers
 *      on flat zeros are the #1 source of "broken chart" aesthetic)
 *   2. Donut    "Editorias"             — articles by category, with
 *      zero-count categories filtered out of the donut AND legend so
 *      a single populated editoria doesn't share air with empty slots
 *      (Linear Insights composition pattern + Pitchfork category codes)
 *   3. AreaChart "Novos assinantes"    — subscribers per bucket
 *      (Substack Stats: single gradient area, same visual family as #1)
 *   4. Ranking  "Top publicações"      — list with inline-bar background
 *      proportional to view share; replaces the previous HBarChart
 *      which wasted ~90% of card width with axis padding when there
 *      was only one article (Posthog / Plausible "Top pages" pattern)
 *
 * Design rules from AGENTS.md (`referencias_dashboards`):
 *   - Paleta ≤3 cores principais: navy primary + magenta accent + neutro.
 *     Category colors are data encoding, not decoration — exempt from the limit.
 *   - Cartões com border-radius suave, sem sombras pesadas.
 *   - Filtros sempre acessíveis (handled at parent level — period + view toggle).
 *   - Hierarquia "agregados no topo / detalhamento abaixo" (parent renders
 *     hero KPIs; this view is pure visual detail).
 *
 * Acessibilidade (WCAG 2.2 — 1.1.1 Non-text Content):
 *   - Each chart card gets role="img" + aria-label with computed data
 *     summary so screen readers get the metric, not the SVG.
 */
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AdminMetricsResponse } from '@/services/metricsService';

interface MetricsDashboardProps {
  metrics: AdminMetricsResponse;
}

// Editorial accent palette — mirrors src/styles/global.css tokens
// (migrated 2026-05-17 away from loud violet/magenta to editorial earth tones).
const CATEGORY_COLORS: Record<string, string> = {
  música: '#5E4F3B', // sépia/earth (was #7C3AED violet)
  moda: '#A8554C', // terracotta (was #BE185D magenta)
  cinema: '#B45309',
  literatura: '#15803D',
  'cultura-digital': '#0E7490',
  default: '#6B7280',
};
const NAVY = '#19144c';
// Secondary series color for area charts — terracotta from the new
// editorial palette; replaces the previous magenta accent #BE185D.
const TERRACOTTA = '#A8554C';
const AXIS = '#9CA3AF';
const GRID = '#EEF0F4';

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const activityData = metrics.time_series.labels.map((label, i) => ({
    label,
    comments: metrics.time_series.comments[i] ?? 0,
    likes: metrics.time_series.likes[i] ?? 0,
    subscribers: metrics.time_series.subscribers[i] ?? 0,
  }));

  // Recharts 3.x: data items carry `fill`, no Cell wrappers needed.
  const allCategories = metrics.category_breakdown.map((c) => ({
    name: c.name,
    value: c.count,
    fill: CATEGORY_COLORS[c.slug] ?? CATEGORY_COLORS.default,
  }));
  // Drop zero-count categories so a single populated editoria doesn't
  // share a donut/legend with 5 empty slots — Linear/Posthog never show
  // empty rows in their composition widgets.
  const visibleCategories = allCategories.filter((c) => c.value > 0);
  const totalArticles = allCategories.reduce((sum, c) => sum + c.value, 0);

  const topArticles = metrics.per_article.slice(0, 5);
  const maxTopViews = Math.max(...topArticles.map((a) => a.view_count), 1);

  // ── Resumos textuais p/ leitores de tela (WCAG 2.2 — 1.1.1) ───────────
  const totalComments = activityData.reduce((s, d) => s + d.comments, 0);
  const totalLikes = activityData.reduce((s, d) => s + d.likes, 0);
  const totalNewSubs = activityData.reduce((s, d) => s + d.subscribers, 0);

  const activityAria =
    `Série temporal de atividade no período: ${totalComments} comentários e ` +
    `${totalLikes} curtidas ao longo de ${activityData.length} pontos.`;

  const subscribersAria =
    `Área de novos assinantes da newsletter: ` +
    `${totalNewSubs} no total ao longo de ${activityData.length} pontos.`;

  const categoryAria =
    visibleCategories.length === 0
      ? 'Sem dados de categoria neste período.'
      : `${totalArticles} publicações distribuídas em ${visibleCategories.length} ` +
        `editorias: ${visibleCategories.map((c) => `${c.name} ${c.value}`).join(', ')}.`;

  const topArticlesAria =
    topArticles.length === 0
      ? 'Sem publicações para ranquear.'
      : `Ranking das ${topArticles.length} publicações mais vistas: ` +
        topArticles
          .map(
            (a, i) => `${i + 1}. ${a.title} com ${a.view_count} visualizações`,
          )
          .join('; ') +
        '.';

  const tooltipStyle = {
    background: NAVY,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
    padding: '8px 12px',
  };
  const tooltipLabel = { color: '#fff', fontWeight: 600 };
  const tooltipItem = { color: '#fff' };

  return (
    <div className="dash">
      <div className="dash__row dash__row--top">
        {/* ── Atividade por dia (AreaChart · Plausible/Posthog) ── */}
        <div className="dash__card dash__card--wide">
          <header className="dash__card-head">
            <h3>Atividade por dia</h3>
            <p>
              Comentários e curtidas · {totalComments + totalLikes} eventos no
              período
            </p>
          </header>
          <div className="dash__chart" role="img" aria-label={activityAria}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={activityData}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={TERRACOTTA}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={TERRACOTTA}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={GRID}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={AXIS}
                  fontSize={12}
                  tickMargin={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={12}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabel}
                  itemStyle={tooltipItem}
                />
                <Area
                  type="monotone"
                  dataKey="comments"
                  name="Comentários"
                  stroke={NAVY}
                  strokeWidth={2}
                  fill="url(#gradComments)"
                  fillOpacity={1}
                  activeDot={{ r: 4, strokeWidth: 0, fill: NAVY }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="likes"
                  name="Curtidas"
                  stroke={TERRACOTTA}
                  strokeWidth={2}
                  fill="url(#gradLikes)"
                  fillOpacity={1}
                  activeDot={{ r: 4, strokeWidth: 0, fill: TERRACOTTA }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="dash__series-legend">
            <span className="dash__series-item">
              <i style={{ background: NAVY }} aria-hidden="true" />
              Comentários <b>{totalComments}</b>
            </span>
            <span className="dash__series-item">
              <i style={{ background: TERRACOTTA }} aria-hidden="true" />
              Curtidas <b>{totalLikes}</b>
            </span>
          </div>
        </div>

        {/* ── Editorias (Donut · Linear Insights composition) ── */}
        <div className="dash__card">
          <header className="dash__card-head">
            <h3>Editorias</h3>
            <p>
              {visibleCategories.length === 0
                ? 'Aguardando primeira publicação'
                : `${visibleCategories.length} de ${allCategories.length} categorias ativas`}
            </p>
          </header>
          <div
            className="dash__chart dash__chart--donut"
            role="img"
            aria-label={categoryAria}
          >
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={
                    visibleCategories.length > 0
                      ? visibleCategories
                      : [{ name: '—', value: 1, fill: '#EAEAEA' }]
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={visibleCategories.length > 1 ? 3 : 0}
                  startAngle={90}
                  endAngle={-270}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                {visibleCategories.length > 0 && (
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
            <dl className="dash__donut-center">
              {/* dt=rótulo, dd=valor (evita "possible heading" no número central). */}
              <dt className="dash__donut-label">
                publicaç{totalArticles === 1 ? 'ão' : 'ões'}
              </dt>
              <dd className="dash__donut-value">{totalArticles}</dd>
            </dl>
          </div>
          {visibleCategories.length > 0 && (
            <ul className="dash__legend">
              {visibleCategories.map((c) => (
                <li key={c.name}>
                  <span
                    className="dash__legend-dot"
                    style={{ background: c.fill }}
                  />
                  <span className="dash__legend-name">{c.name}</span>
                  <span className="dash__legend-value">{c.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="dash__row">
        {/* ── Novos assinantes (AreaChart · Substack Stats) ── */}
        <div className="dash__card">
          <header className="dash__card-head">
            <h3>Novos assinantes</h3>
            <p>Inscrições na newsletter · {totalNewSubs} no período</p>
          </header>
          <div className="dash__chart" role="img" aria-label={subscribersAria}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={activityData}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={GRID}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={AXIS}
                  fontSize={12}
                  tickMargin={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={12}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabel}
                  itemStyle={tooltipItem}
                />
                <Area
                  type="monotone"
                  dataKey="subscribers"
                  name="Novos assinantes"
                  stroke={NAVY}
                  strokeWidth={2}
                  fill="url(#gradSubs)"
                  fillOpacity={1}
                  activeDot={{ r: 4, strokeWidth: 0, fill: NAVY }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Top publicações (Ranking · Posthog/Plausible "Top pages") ── */}
        <div className="dash__card">
          <header className="dash__card-head">
            <h3>Top publicações</h3>
            <p>5 mais visualizadas (acumulado)</p>
          </header>
          <div className="dash__top" role="img" aria-label={topArticlesAria}>
            {topArticles.length === 0 ? (
              <div className="dash__empty">Sem publicações ainda.</div>
            ) : (
              <ol className="dash__top-list">
                {topArticles.map((a, i) => {
                  const pct = Math.max(3, (a.view_count / maxTopViews) * 100);
                  return (
                    <li key={a.slug} className="dash__top-row">
                      <span
                        className="dash__top-bar"
                        style={{ width: `${pct}%` }}
                        aria-hidden="true"
                      />
                      <span className="dash__top-rank">{i + 1}</span>
                      <div className="dash__top-meta">
                        <p className="dash__top-title">{a.title}</p>
                        {a.published_at && (
                          <time className="dash__top-date">
                            {new Date(a.published_at).toLocaleDateString(
                              'pt-BR',
                            )}
                          </time>
                        )}
                      </div>
                      <span className="dash__top-views">
                        {a.view_count.toLocaleString('pt-BR')}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
