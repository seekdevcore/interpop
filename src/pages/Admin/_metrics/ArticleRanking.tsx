/**
 * ArticleRanking — tabela de ranking de artigos com inline bar chart.
 *
 * Pattern Posthog/Plausible: cada linha recebe um background com width
 * proporcional ao view_count daquele artigo vs o top. Dá escala visual
 * instantânea sem precisar de chart panel separado.
 *
 * E4 do reorganization-proposal: extraído de Admin/index.tsx:1271 inline.
 */
import { formatDateShort } from '@/utils/formatDate';
import type { PerArticleMetric } from '@/services/metricsService';
import { formatNumber } from './formatNumber';

interface ArticleRankingProps {
  articles: PerArticleMetric[];
}

export function ArticleRanking({ articles }: ArticleRankingProps) {
  const maxViews = Math.max(...articles.map((a) => a.view_count), 1);

  return (
    <div className="metrics__ranking">
      <div className="metrics__ranking-head">
        <span>Publicação</span>
        <span className="metrics__ranking-col">Views</span>
        <span className="metrics__ranking-col">Coment.</span>
        <span className="metrics__ranking-col">Curtidas</span>
        <span className="metrics__ranking-col">Engaj.</span>
      </div>
      <ol className="metrics__ranking-list">
        {articles.map((a, i) => {
          const widthPct = Math.max(2, (a.view_count / maxViews) * 100);
          const engagementPct = (a.engagement_rate * 100).toFixed(1);
          return (
            <li key={a.slug} className="metrics__ranking-row">
              <div
                className="metrics__ranking-bar"
                style={{ width: `${widthPct}%` }}
                aria-hidden="true"
              />
              <div className="metrics__ranking-content">
                <div className="metrics__ranking-title-cell">
                  <span className="metrics__ranking-index">{i + 1}</span>
                  <div>
                    <p className="metrics__ranking-title">{a.title}</p>
                    {a.published_at && (
                      <p className="metrics__ranking-date">
                        {formatDateShort(a.published_at)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.view_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.comment_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.like_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num metrics__ranking-engagement">
                  {engagementPct}%
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
