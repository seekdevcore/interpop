import api from './api';

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ApiArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  cover_image: string | null;
  /** Legenda da capa (G1-style: "Pessoa — Foto: Agência"). Só vem na detail
   *  view (`GET /api/articles/<slug>/`), não na listagem — evita inflar payload. */
  cover_caption?: string;
  author: {
    id: string;
    full_name: string;
    avatar: string | null;
    avatar_initial: string;
    role: string;
  };
  category: ApiCategory | null;
  status: 'draft' | 'published';
  is_featured: boolean;
  view_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ApiComment {
  id: string;
  author: {
    id: string;
    full_name: string;
    avatar: string | null;
    avatar_initial: string;
  };
  content: string;
  created_at: string;
}

export interface ArticleWritePayload {
  title: string;
  excerpt: string;
  body: string;
  category_id?: number | null;
  status?: 'draft' | 'published';
  is_featured?: boolean;
  cover_image?: File | null;
  cover_caption?: string;
}

// ── Cache de categorias ───────────────────────────────────────────────
// Categorias mudam muito raramente (admin Django). Em vez de cada página
// (News, CreatePost) refazer GET /api/categories/ a cada montagem, mantemos
// um cache in-module simples. Primeira chamada → request real; chamadas
// subsequentes → resolvem com o array em memória.
let _categoriesCache: ApiCategory[] | null = null;
let _categoriesPromise: Promise<ApiCategory[]> | null = null;

/** Limpa o cache (use após criar/editar categoria — não temos UI pra isso ainda). */
export function invalidateCategoriesCache(): void {
  _categoriesCache = null;
  _categoriesPromise = null;
}

const articleService = {
  list: (params?: Record<string, string>) =>
    api.get<{ results: ApiArticle[]; count: number }>('/api/articles/', {
      params,
    }),

  get: (slug: string) => api.get<ApiArticle>(`/api/articles/${slug}/`),

  create: (payload: ArticleWritePayload) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v as string | Blob);
    });
    return api.post<ApiArticle>('/api/articles/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (slug: string, payload: Partial<ArticleWritePayload>) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v as string | Blob);
    });
    return api.patch<ApiArticle>(`/api/articles/${slug}/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  remove: (slug: string) => api.delete(`/api/articles/${slug}/`),

  recordView: (slug: string) => api.post(`/api/articles/${slug}/view/`),

  listCategories: () =>
    api.get<{ results: ApiCategory[]; count: number }>('/api/categories/'),

  /** Versão cacheada — usar nas páginas que só precisam do array de categorias.
   *  Primeira chamada faz request, subsequentes resolvem com o cache em memória.
   *  Requests paralelos compartilham a mesma Promise (sem N requests simultâneos). */
  getCachedCategories(): Promise<ApiCategory[]> {
    if (_categoriesCache) return Promise.resolve(_categoriesCache);
    if (_categoriesPromise) return _categoriesPromise;
    _categoriesPromise = api
      .get<{ results: ApiCategory[]; count: number }>('/api/categories/')
      .then((r) => {
        _categoriesCache = r.data.results;
        return _categoriesCache;
      })
      .catch((err) => {
        _categoriesPromise = null;
        throw err;
      });
    return _categoriesPromise;
  },
};

export default articleService;
