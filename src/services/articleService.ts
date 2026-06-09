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
   *  view (`GET /api/v1/articles/<slug>/`), não na listagem — evita inflar payload. */
  cover_caption?: string;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar: string | null;
    avatar_initial: string;
    role: 'dev' | 'admin' | 'editor' | 'user';
    bio: string;
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

// ApiComment vive em commentService.ts (versão completa com replies, likes,
// is_liked, etc.). Versão simplificada que existia aqui era dead code —
// nada importava dela. Removida em F2 do Improvement-system.md §11.3.

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
// (News, CreatePost) refazer GET /api/v1/categories/ a cada montagem, mantemos
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
    api.get<{ results: ApiArticle[]; count: number }>('/api/v1/articles/', {
      params,
    }),

  get: (slug: string) => api.get<ApiArticle>(`/api/v1/articles/${slug}/`),

  create: (payload: ArticleWritePayload) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v as string | Blob);
    });
    return api.post<ApiArticle>('/api/v1/articles/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (slug: string, payload: Partial<ArticleWritePayload>) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v as string | Blob);
    });
    return api.patch<ApiArticle>(`/api/v1/articles/${slug}/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  remove: (slug: string) => api.delete(`/api/v1/articles/${slug}/`),

  recordView: (slug: string) => api.post(`/api/v1/articles/${slug}/view/`),

  listCategories: () =>
    api.get<{ results: ApiCategory[]; count: number }>('/api/v1/categories/'),

  /** Versão cacheada — usar nas páginas que só precisam do array de categorias.
   *  Primeira chamada faz request, subsequentes resolvem com o cache em memória.
   *  Requests paralelos compartilham a mesma Promise (sem N requests simultâneos). */
  getCachedCategories(): Promise<ApiCategory[]> {
    if (_categoriesCache) return Promise.resolve(_categoriesCache);
    if (_categoriesPromise) return _categoriesPromise;
    _categoriesPromise = api
      .get<{ results: ApiCategory[]; count: number }>('/api/v1/categories/')
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
