import api from './api';

export type MetricsPeriod = 'day' | 'week' | 'month' | 'year';

export interface AdminMetricsTotals {
  users: number;
  subscribers: number;
  articles: number;
  views: number;
  comments: number;
  likes: number;
}

export interface AdminMetricsPeriod {
  new_users: number;
  new_subscribers: number;
  new_articles: number;
  new_comments: number;
  new_likes: number;
  active_users: number;
}

export interface PerArticleMetric {
  slug: string;
  title: string;
  view_count: number;
  comment_count: number;
  like_count: number;
  published_at: string | null;
  /** (comments + likes) / views — 0..1, multiply by 100 for percentage. */
  engagement_rate: number;
}

export interface TimeSeries {
  labels: string[];
  comments: number[];
  likes: number[];
  subscribers: number[];
  users: number[];
  articles: number[];
}

export interface CategoryBucket {
  slug: string;
  name: string;
  count: number;
}

export interface AdminMetricsResponse {
  period: MetricsPeriod;
  since: string;
  now: string;
  totals: AdminMetricsTotals;
  period_stats: AdminMetricsPeriod;
  previous_period_stats: AdminMetricsPeriod;
  per_article: PerArticleMetric[];
  time_series: TimeSeries;
  category_breakdown: CategoryBucket[];
}

const metricsService = {
  get: (period: MetricsPeriod = 'week') =>
    api.get<AdminMetricsResponse>('/api/admin/metrics/', {
      params: { period },
    }),
};

export default metricsService;
