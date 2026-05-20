import type { Article, Category, Comment } from '../types';

export const CATEGORIES: Category[] = [
  'Todos',
  'Música',
  'Moda',
  'Cinema',
  'Literatura',
  'Cultura Digital',
];

export const ARTICLES: Article[] = [
  {
    id: 1,
    slug: 'equilibrio-poder-era-digital',
    category: 'Política',
    title: 'O Equilíbrio de Poder na Era Digital',
    excerpt:
      'Algoritmos, dados e conectividade tornaram-se armas tão potentes quanto qualquer arsenal bélico. Como a tecnologia reconfigurou o poder geopolítico no século XXI.',
    coverImage:
      'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=85',
    author: {
      name: 'Maria Silva',
      role: 'Correspondente Internacional',
      avatarInitial: 'M',
    },
    publishedAt: '27 abr 2026',
    readTime: 8,
    featured: true,
    tags: ['Geopolítica', 'Tecnologia', 'Soberania Digital'],
  },
  {
    id: 2,
    slug: 'competicoes-esportivas-futuro',
    category: 'Tecnologia',
    title: 'Competições esportivas no futuro: realidade aumentada e eSports',
    excerpt:
      'A fusão entre esportes tradicionais e tecnologia digital cria uma nova era de entretenimento global com audiências bilionárias.',
    coverImage:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
    author: {
      name: 'Carlos Mendes',
      role: 'Editor de Tecnologia',
      avatarInitial: 'C',
    },
    publishedAt: '26 abr 2026',
    readTime: 5,
  },
  {
    id: 3,
    slug: 'festas-mundiais-bastidores',
    category: 'Cultura',
    title: 'Festas Mundiais: bastidores de uma produção monumental',
    excerpt:
      'Como as maiores celebrações culturais do planeta são organizadas e o impacto econômico e social que geram nas comunidades locais.',
    coverImage:
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80',
    author: {
      name: 'Ana Costa',
      role: 'Editora de Cultura',
      avatarInitial: 'A',
    },
    publishedAt: '25 abr 2026',
    readTime: 6,
  },
  {
    id: 4,
    slug: 'cidades-inteligentes-urbanismo',
    category: 'Negócios',
    title: 'Cidades inteligentes: o modelo que redefine o urbanismo global',
    excerpt:
      'Investimentos em infraestrutura conectada transformam metrópoles ao redor do mundo em laboratórios vivos de inovação urbana.',
    coverImage:
      'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80',
    author: {
      name: 'Pedro Rocha',
      role: 'Repórter de Negócios',
      avatarInitial: 'P',
    },
    publishedAt: '24 abr 2026',
    readTime: 7,
  },
  {
    id: 5,
    slug: 'seguranca-cibernetica-ameacas',
    category: 'Internacional',
    title: 'Segurança Cibernética: ameaças crescentes exigem resposta global',
    excerpt:
      'Ataques coordenados a infraestruturas críticas aceleram a criação de alianças internacionais de defesa digital sem precedentes.',
    coverImage:
      'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&q=80',
    author: {
      name: 'Julia Farias',
      role: 'Analista de Segurança',
      avatarInitial: 'J',
    },
    publishedAt: '23 abr 2026',
    readTime: 9,
  },
  {
    id: 6,
    slug: 'crises-migratorias-perspectivas',
    category: 'Economia',
    title: 'Crises Migratórias: desafios e perspectivas para 2026',
    excerpt:
      'O fluxo de refugiados em níveis históricos pressiona governos e organizações internacionais a buscarem soluções estruturais urgentes.',
    coverImage:
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
    author: {
      name: 'Ricardo Lima',
      role: 'Editor de Economia',
      avatarInitial: 'R',
    },
    publishedAt: '22 abr 2026',
    readTime: 6,
  },
  {
    id: 7,
    slug: 'acordo-diplomatico-historico',
    category: 'Política',
    title: 'Novo acordo diplomático transforma relações internacionais',
    excerpt:
      'Líderes mundiais assinam tratado histórico que redefine o equilíbrio de poder entre as maiores potências do século XXI.',
    coverImage:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
    author: {
      name: 'Maria Silva',
      role: 'Correspondente Internacional',
      avatarInitial: 'M',
    },
    publishedAt: '21 abr 2026',
    readTime: 4,
  },
];

export const FEATURED_ARTICLE = ARTICLES.find((a) => a.featured) ?? ARTICLES[0];

export const ARTICLE_BODY = `
Sempre diziam que o poder vinha de exércitos e fronteiras. Hoje, a arena global se transformou de maneiras que nenhum teórico clássico das relações internacionais poderia prever com precisão. Algoritmos, dados e conectividade tornaram-se armas tão potentes quanto qualquer arsenal bélico do século passado.

A transição digital não é apenas uma questão tecnológica — é, acima de tudo, uma reconfiguração profunda do poder político, econômico e cultural no cenário mundial. Países que antes eram periféricos nas discussões globais agora exercem influência desproporcional ao seu tamanho geográfico, simplesmente por dominarem infraestruturas digitais críticas.

O paradoxo desta nova ordem é que a mesma tecnologia que democratiza o acesso à informação também concentra poder nas mãos de pouquíssimas corporações e Estados que controlam os cabos submarinos, os satélites e os centros de dados que formam a espinha dorsal da internet moderna. As implicações geopolíticas são profundas e ainda pouco compreendidas pela maioria dos cidadãos.

Neste contexto, observamos uma corrida silenciosa pelo domínio de padrões tecnológicos, protocolos de comunicação e infraestrutura de inteligência artificial. Quem define os parâmetros técnicos define, em última instância, as regras do jogo global — e isso representa uma forma de soberania que os tratados internacionais clássicos ainda não sabem como regular adequadamente.
`;

export const COMMENTS: Comment[] = [
  {
    id: 1,
    author: 'Ricardo Nunes',
    avatarInitial: 'R',
    text: 'Excelente análise. O artigo traz uma perspectiva necessária sobre as transformações geopolíticas atuais e suas implicações para países em desenvolvimento.',
    publishedAt: '2h atrás',
  },
  {
    id: 2,
    author: 'Laura Costa',
    avatarInitial: 'L',
    text: 'Concordo com os pontos levantados. A era digital realmente mudou as regras do jogo — e os tratados internacionais precisam urgentemente se atualizar.',
    publishedAt: '5h atrás',
  },
];
