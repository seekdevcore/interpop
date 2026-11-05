/**
 * Demo: `GET /api/v1/admin/metrics/` (backend/apps/audit/views.py).
 *
 * Formato e janelas idênticos ao backend: buckets no fuso do projeto
 * (America/Sao_Paulo, UTC−3 fixo desde 2019), rótulos do `strftime` em
 * locale C (`%H:00`, `%d/%m`, `%b/%y` com mês em inglês), filtros
 * `>= since` e `< now`.
 *
 * Números: o seed tem 9 pessoas e 10 comentários, o que deixaria o
 * dashboard vazio. Comentários, curtidas, assinantes e usuários ganham uma
 * base sintética determinística (mesmo bucket → mesmo número) somada ao que
 * o designer criar no demo; a tabela por artigo ganha uma base
 * proporcional às visualizações. Artigos e visualizações são só os reais.
 */
import { demoDb } from '@/mocks/demo/db';
import { authenticate, isAdmin, json, route } from '@/mocks/demo/http';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TZ_OFFSET = -3 * HOUR;

const PERIOD_DELTAS: Record<string, number> = {
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
  year: 365 * DAY,
};

type Step = 'hour' | 'day' | 'month';
const stepFor = (period: string): Step =>
  period === 'day' ? 'hour' : period === 'year' ? 'month' : 'day';

/** Data "de parede" em UTC−3, manipulada com os getters UTC. */
const wall = (ms: number) => new Date(ms + TZ_OFFSET);
const fromWall = (d: Date) => d.getTime() - TZ_OFFSET;

function floorTo(ms: number, step: Step) {
  const d = wall(ms);
  if (step === 'month') d.setUTCDate(1);
  if (step === 'hour') d.setUTCMinutes(0, 0, 0);
  else d.setUTCHours(0, 0, 0, 0);
  return fromWall(d);
}

function nextBucket(ms: number, step: Step) {
  if (step === 'hour') return ms + HOUR;
  if (step === 'day') return ms + DAY;
  const d = wall(ms);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return fromWall(d);
}

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const pad = (n: number) => String(n).padStart(2, '0');

function label(ms: number, step: Step) {
  const d = wall(ms);
  if (step === 'hour') return `${pad(d.getUTCHours())}:00`;
  if (step === 'day')
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
  return `${MONTHS[d.getUTCMonth()]}/${pad(d.getUTCFullYear() % 100)}`;
}

/** `_generate_buckets`: inícios que cobrem [since, until). */
function buckets(since: number, until: number, step: Step) {
  const out: number[] = [];
  for (let cur = floorTo(since, step); cur < until; cur = nextBucket(cur, step))
    out.push(cur);
  return out;
}

/** `_bucket_counts`: conta timestamps (ISO) por bucket dentro da janela. */
function countIn(
  stamps: string[],
  starts: number[],
  since: number,
  until: number,
  step: Step,
) {
  const index = new Map(starts.map((s, i) => [s, i]));
  const counts = starts.map(() => 0);
  for (const iso of stamps) {
    const t = Date.parse(iso);
    if (t < since || t >= until) continue;
    const i = index.get(floorTo(t, step));
    if (i !== undefined) counts[i] += 1;
  }
  return counts;
}

/** PRNG determinístico (mulberry32 sobre FNV-1a da chave). */
function seeded(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

type Synthetic = 'comments' | 'likes' | 'subscribers' | 'users';
const BASE_RANGE: Record<Synthetic, Record<Step, [number, number]>> = {
  comments: { hour: [0, 4], day: [6, 22], month: [180, 420] },
  likes: { hour: [0, 9], day: [15, 60], month: [500, 1300] },
  subscribers: { hour: [0, 2], day: [1, 8], month: [40, 120] },
  users: { hour: [0, 2], day: [1, 6], month: [30, 90] },
};
/** Totais "de vida inteira" da base sintética. */
const BASE_TOTALS: Record<Synthetic, number> = {
  comments: 3_180,
  likes: 9_420,
  subscribers: 864,
  users: 1_243,
};

function synthetic(series: Synthetic, start: number, step: Step) {
  const [min, max] = BASE_RANGE[series][step];
  return (
    min + Math.floor(seeded(`${series}|${step}|${start}`) * (max - min + 1))
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Fontes reais do demo, como timestamps ISO. */
function realStamps() {
  const { users, articles, comments, subscribers } = demoDb.state;
  const live = comments.filter((c) => !c.is_deleted);
  return {
    users: users.map((u) => u.date_joined),
    articles: articles.map((a) => a.created_at),
    comments: live.map((c) => c.created_at),
    // curtida do demo não guarda data: conta na data do comentário
    likes: comments.flatMap((c) => c.liked_by.map(() => c.created_at)),
    subscribers: subscribers
      .filter((s) => s.is_active)
      .map((s) => s.created_at),
  };
}

function series(since: number, until: number, step: Step) {
  const starts = buckets(since, until, step);
  const real = realStamps();
  const withBase = (key: Synthetic) =>
    countIn(real[key], starts, since, until, step).map(
      (n, i) => n + synthetic(key, starts[i], step),
    );
  return {
    starts,
    comments: withBase('comments'),
    likes: withBase('likes'),
    subscribers: withBase('subscribers'),
    users: withBase('users'),
    articles: countIn(real.articles, starts, since, until, step),
  };
}

function periodStats(since: number, until: number, step: Step) {
  const s = series(since, until, step);
  const new_comments = sum(s.comments);
  const new_likes = sum(s.likes);
  return {
    new_users: sum(s.users),
    new_subscribers: sum(s.subscribers),
    new_articles: sum(s.articles),
    new_comments,
    new_likes,
    // quem comentou ou curtiu: aproximação sobre a base sintética
    active_users: Math.round(new_comments * 0.45 + new_likes * 0.2),
  };
}

export const metricsHandlers = [
  route('get', '/admin/metrics/', ({ request }) => {
    // mesmas permissões da view: IsAuthenticated + IsAdminUser
    const auth = authenticate({ allow: isAdmin, allowBanned: true });
    if (auth.error) return auth.error;
    const period = new URL(request.url).searchParams.get('period') ?? 'week';
    const delta = PERIOD_DELTAS[period] ?? PERIOD_DELTAS.week;
    const step = stepFor(period);
    const now = demoDb.now();
    const since = now - delta;

    const ts = series(since, now, step);
    const { articles, comments, categories, subscribers, users } = demoDb.state;
    const published = articles.filter((a) => a.status === 'published');
    const liveComments = comments.filter((c) => !c.is_deleted);

    const per_article = [...published]
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 20)
      .map((a) => {
        const own = liveComments.filter((c) => c.article_id === a.id);
        // base sintética proporcional às visualizações (2–7% de engajamento),
        // fixa por artigo, mais o que o designer comentar/curtir no demo
        const comment_count =
          own.length +
          Math.round(a.view_count * (0.006 + seeded(`pa-c|${a.id}`) * 0.014));
        const like_count =
          sum(own.map((c) => c.liked_by.length)) +
          Math.round(a.view_count * (0.015 + seeded(`pa-l|${a.id}`) * 0.035));
        return {
          slug: a.slug,
          title: a.title,
          view_count: a.view_count,
          comment_count,
          like_count,
          published_at: a.published_at,
          engagement_rate: a.view_count
            ? Math.round(((comment_count + like_count) / a.view_count) * 1e4) /
              1e4
            : 0,
        };
      });

    return json({
      period,
      since: new Date(since).toISOString(),
      now: new Date(now).toISOString(),
      totals: {
        users: BASE_TOTALS.users + users.length,
        subscribers:
          BASE_TOTALS.subscribers +
          subscribers.filter((s) => s.is_active).length,
        articles: published.length,
        views: sum(articles.map((a) => a.view_count)),
        comments: BASE_TOTALS.comments + liveComments.length,
        likes: BASE_TOTALS.likes + sum(comments.map((c) => c.liked_by.length)),
      },
      period_stats: periodStats(since, now, step),
      previous_period_stats: periodStats(since - delta, since, step),
      per_article,
      time_series: {
        labels: ts.starts.map((s) => label(s, step)),
        comments: ts.comments,
        likes: ts.likes,
        subscribers: ts.subscribers,
        users: ts.users,
        articles: ts.articles,
      },
      category_breakdown: [...categories]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          count: published.filter((a) => a.category_id === c.id).length,
        })),
    });
  }),
];
