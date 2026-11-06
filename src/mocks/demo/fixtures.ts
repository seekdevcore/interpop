/**
 * Seed do site demo: o "banco" com que o designer começa, e para o qual
 * "Resetar dados" volta.
 *
 * Conteúdo: os 12 artigos de `backend/seed_test_articles.py` (seedArticles.ts)
 * com as capas de banco de imagens que o próprio seed baixa (Unsplash via
 * picsum), mais 2 rascunhos, pessoas fictícias e um pouco de conversa nos
 * comentários. Nada vem do db.sqlite3 local: lá há e-mail de assinante real.
 *
 * Datas são relativas a `now` para o site sempre parecer "vivo".
 * IDs são UUIDs fixos: reset volta exatamente ao mesmo estado.
 */
import type { ApiCategory } from '@/services/articleService';
import { SEED_ARTICLES } from './seedArticles';

export type Role = 'dev' | 'admin' | 'editor' | 'user';

export interface DemoUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  bio: string;
  avatar: string | null;
  date_joined: string;
  last_login: string | null;
  updated_at: string;
  is_active: boolean;
  is_banned: boolean;
}

export interface DemoArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  cover_caption: string;
  author_id: string;
  category_id: number | null;
  status: 'draft' | 'published';
  is_featured: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoComment {
  id: string;
  article_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  liked_by: string[];
  is_deleted: boolean;
}

export interface DemoBan {
  id: string;
  user_id: string;
  banned_by_id: string;
  unbanned_by_id: string | null;
  reason: string;
  trigger_message: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  unbanned_at: string | null;
}

export interface DemoBanRequest {
  id: string;
  target_id: string;
  requested_by_id: string;
  reason: string;
  trigger_message: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by_id: string | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
}

export interface DemoSubscriber {
  email: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

export interface DemoState {
  version: number;
  users: DemoUser[];
  categories: ApiCategory[];
  articles: DemoArticle[];
  comments: DemoComment[];
  bans: DemoBan[];
  banRequests: DemoBanRequest[];
  subscribers: DemoSubscriber[];
}

/** Suba quando o formato ou o conteúdo do seed mudar: o dado salvo no
 *  navegador do designer com versão diferente é descartado e re-semeado. */
export const DATA_VERSION = 1;

const COVERS = import.meta.glob<string>('./covers/*.webp', {
  eager: true,
  import: 'default',
});
const cover = (n: number) => COVERS[`./covers/cover-${n}.webp`] ?? null;

/** UUID v4 válido e determinístico: `kind` distingue as tabelas. */
export const seedId = (kind: string, n: number) =>
  `${kind.padEnd(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Ordenadas por nome, como `GET /categories/` (ids na mesma ordem). */
export const CATEGORIES: ApiCategory[] = [
  { id: 1, name: 'Cinema', slug: 'cinema' },
  { id: 2, name: 'Cultura Digital', slug: 'cultura-digital' },
  { id: 3, name: 'Literatura', slug: 'literatura' },
  { id: 4, name: 'Moda', slug: 'moda' },
  { id: 5, name: 'Música', slug: 'música' },
];

interface PersonSeed {
  first: string;
  last: string;
  email: string;
  role: Role;
  bio: string;
  joinedDaysAgo: number;
  banned?: boolean;
}

const PEOPLE: PersonSeed[] = [
  {
    first: 'Renata',
    last: 'Duarte',
    email: 'dev@example.com',
    role: 'dev',
    bio: 'Criou o Interpop e cuida da plataforma.',
    joinedDaysAgo: 420,
  },
  {
    first: 'Marcos',
    last: 'Vieira',
    email: 'admin@example.com',
    role: 'admin',
    bio: 'Editor-chefe. Coordena pauta e moderação.',
    joinedDaysAgo: 400,
  },
  {
    first: 'Ana',
    last: 'Lima',
    email: 'editor@example.com',
    role: 'editor',
    bio: 'Escreve sobre música, plataformas e economia da atenção.',
    joinedDaysAgo: 380,
  },
  {
    first: 'Bia',
    last: 'Mota',
    email: 'bia@example.com',
    role: 'editor',
    bio: 'Pesquisa moda, cinema e literatura como política externa.',
    joinedDaysAgo: 300,
  },
  {
    first: 'Carlos',
    last: 'Rocha',
    email: 'leitor@example.com',
    role: 'user',
    bio: '',
    joinedDaysAgo: 200,
  },
  {
    first: 'Júlia',
    last: 'Santos',
    email: 'julia@example.com',
    role: 'user',
    bio: 'Estudante de Relações Internacionais.',
    joinedDaysAgo: 120,
  },
  {
    first: 'Pedro',
    last: 'Alves',
    email: 'pedro@example.com',
    role: 'user',
    bio: '',
    joinedDaysAgo: 60,
  },
  {
    first: 'Lucas',
    last: 'Ferreira',
    email: 'lucas@example.com',
    role: 'user',
    bio: '',
    joinedDaysAgo: 45,
    banned: true,
  },
  {
    first: 'Mariana',
    last: 'Costa',
    email: 'mariana@example.com',
    role: 'user',
    bio: 'Fã de k-drama e de boas notas de rodapé.',
    joinedDaysAgo: 10,
  },
];

/** As 4 contas que o painel demo oferece em "Entrar como". */
export const DEMO_ACCOUNTS = PEOPLE.slice(0, 5)
  .filter((p) => p.email !== 'bia@example.com')
  .map((p) => ({
    email: p.email,
    role: p.role,
    name: `${p.first} ${p.last}`,
  }));

const ROLE_LABEL: Record<Role, string> = {
  dev: 'Dev',
  admin: 'Admin',
  editor: 'Editora',
  user: 'Leitor',
};
export const roleLabel = (r: Role) => ROLE_LABEL[r];

const VIEWS = [
  4820, 3110, 2675, 1980, 2240, 1530, 3890, 1210, 960, 1475, 2050, 880,
];

const CAPTION = 'Imagem ilustrativa — Foto: Unsplash';

const usernameOf = (p: PersonSeed) =>
  `${p.first}.${p.last}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function buildSeed(
  now: number,
  slugify: (s: string) => string,
): DemoState {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  const users: DemoUser[] = PEOPLE.map((p, i) => ({
    id: seedId('a1', i + 1),
    email: p.email,
    username: usernameOf(p),
    first_name: p.first,
    last_name: p.last,
    role: p.role,
    bio: p.bio,
    avatar: null,
    date_joined: iso(p.joinedDaysAgo * DAY),
    last_login: iso((i + 1) * 5 * HOUR),
    updated_at: iso(p.joinedDaysAgo * DAY),
    is_active: true,
    is_banned: Boolean(p.banned),
  }));
  const byEmail = (email: string) => users.find((u) => u.email === email)!.id;
  const ANA = byEmail('editor@example.com');
  const BIA = byEmail('bia@example.com');
  const catId = (slug: string) => CATEGORIES.find((c) => c.slug === slug)!.id;

  const articles: DemoArticle[] = SEED_ARTICLES.map((s, i) => {
    const publishedAgo = (i * 4 + 1) * DAY + i * 3 * HOUR;
    return {
      id: seedId('b2', i + 1),
      slug: slugify(s.title),
      title: s.title,
      excerpt: s.excerpt,
      body: s.body,
      cover_image: cover(i + 1),
      cover_caption: CAPTION,
      author_id: ['música', 'cultura-digital'].includes(s.category_slug)
        ? ANA
        : BIA,
      category_id: catId(s.category_slug),
      status: 'published',
      is_featured: i === 0,
      view_count: VIEWS[i % VIEWS.length],
      published_at: iso(publishedAgo),
      created_at: iso(publishedAgo + DAY),
      updated_at: iso(publishedAgo),
    };
  });

  const drafts: Array<Omit<DemoArticle, 'id' | 'slug'>> = [
    {
      title: 'O algoritmo como curador de gosto',
      excerpt:
        'Recomendação automática virou política cultural sem ministério: quem decide o que o mundo escuta?',
      body: 'Rascunho em andamento.\n\n## Pontos a desenvolver\n\nPlaylists editoriais, viés de popularidade e o peso das majors nos contratos de distribuição.',
      cover_image: cover(11),
      cover_caption: CAPTION,
      author_id: ANA,
      category_id: catId('cultura-digital'),
      status: 'draft',
      is_featured: false,
      view_count: 0,
      published_at: null,
      created_at: iso(2 * DAY),
      updated_at: iso(2 * DAY),
    },
    {
      title: 'Bollywood e a diplomacia do espetáculo',
      excerpt:
        'A maior indústria de cinema do mundo em volume ainda busca tradução em influência.',
      body: 'Rascunho sem capa: falta escolher a imagem e fechar a legenda.',
      cover_image: null,
      cover_caption: '',
      author_id: BIA,
      category_id: catId('cinema'),
      status: 'draft',
      is_featured: false,
      view_count: 0,
      published_at: null,
      created_at: iso(6 * HOUR),
      updated_at: iso(6 * HOUR),
    },
  ];
  drafts.forEach((d, i) =>
    articles.push({
      ...d,
      id: seedId('b2', 100 + i),
      slug: slugify(d.title),
    }),
  );

  const [CARLOS, JULIA, PEDRO, MARIANA, MARCOS, LUCAS] = [
    'leitor@example.com',
    'julia@example.com',
    'pedro@example.com',
    'mariana@example.com',
    'admin@example.com',
    'lucas@example.com',
  ].map(byEmail);

  let cn = 0;
  const comments: DemoComment[] = [];
  const comment = (
    articleIdx: number,
    author: string,
    content: string,
    hoursAgo: number,
    liked_by: string[] = [],
    parent: DemoComment | null = null,
  ) => {
    const c: DemoComment = {
      id: seedId('c3', ++cn),
      article_id: articles[articleIdx].id,
      author_id: author,
      content,
      parent_id: parent?.id ?? null,
      created_at: iso(hoursAgo * HOUR),
      liked_by,
      is_deleted: false,
    };
    comments.push(c);
    return c;
  };

  const c1 = comment(
    0,
    JULIA,
    'Excelente recorte. Faltou falar do papel das escolas de idol como política de exportação, mas a parte do orçamento é muito boa.',
    20,
    [CARLOS, MARIANA, PEDRO],
  );
  comment(
    0,
    ANA,
    'Obrigada, Júlia! As escolas de idol entram na parte 2, já está na pauta.',
    18,
    [JULIA],
    c1,
  );
  comment(0, CARLOS, 'Também senti falta disso.', 16, [], c1);
  const c2 = comment(
    0,
    MARIANA,
    'Dá para comparar com o que a Turquia faz com as novelas? Parece o mesmo modelo.',
    9,
    [JULIA],
  );
  comment(
    0,
    MARCOS,
    'Boa pergunta. Temos um texto sobre dizi turcas saindo em breve.',
    7,
    [MARIANA, CARLOS],
    c2,
  );
  comment(0, PEDRO, 'Texto denso, mas dá vontade de ler até o fim.', 3);
  comment(1, CARLOS, 'Nunca tinha pensado no BTS como ativo diplomático.', 30, [
    JULIA,
  ]);
  comment(2, JULIA, 'O dado sobre exportação de música me surpreendeu.', 50);
  comment(3, MARIANA, 'Moda como soft power faz muito sentido.', 70, [CARLOS]);
  comment(6, CARLOS, 'Quero mais textos sobre cinema!', 100);

  const bans: DemoBan[] = [
    {
      id: seedId('d4', 1),
      user_id: LUCAS,
      banned_by_id: MARCOS,
      unbanned_by_id: null,
      reason: 'Spam de links em comentários',
      trigger_message: 'Compre seguidores baratos no meu perfil!!!',
      created_at: iso(5 * DAY),
      expires_at: null,
      is_active: true,
      unbanned_at: null,
    },
  ];

  const banRequests: DemoBanRequest[] = [
    {
      id: seedId('e5', 1),
      target_id: PEDRO,
      requested_by_id: ANA,
      reason: 'Comentários ofensivos recorrentes',
      trigger_message: 'Quem escreve um texto desses devia mudar de profissão.',
      status: 'pending',
      decided_by_id: null,
      decided_at: null,
      decision_note: '',
      created_at: iso(DAY),
    },
  ];

  const subscribers: DemoSubscriber[] = [
    'leitor@example.com',
    'assinante1@example.com',
    'assinante2@example.com',
  ].map((email, i) => ({
    email,
    token: seedId('f6', i + 1),
    is_active: true,
    created_at: iso((90 - i * 30) * DAY),
  }));

  return {
    version: DATA_VERSION,
    users,
    categories: CATEGORIES.map((c) => ({ ...c })),
    articles,
    comments,
    bans,
    banRequests,
    subscribers,
  };
}
