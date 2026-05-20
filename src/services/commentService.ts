import api from './api';

export interface ApiCommentAuthor {
  id: string;
  full_name: string;
  avatar_initial: string;
}

export interface ApiComment {
  id: string;
  author: ApiCommentAuthor;
  content: string;
  parent_id: string | null;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  replies_count: number;
  replies: ApiComment[];
}

export interface ApiPaginatedComments {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiComment[];
}

const commentService = {
  list: (slug: string, params?: Record<string, string>) =>
    api.get<ApiPaginatedComments>(`/api/articles/${slug}/comments/`, {
      params,
    }),

  add: (slug: string, content: string, parent_id?: string) =>
    api.post<ApiComment>(`/api/articles/${slug}/comments/`, {
      content,
      ...(parent_id ? { parent_id } : {}),
    }),

  remove: (id: string) => api.delete(`/api/comments/${id}/`),

  toggleLike: (id: string) =>
    api.post<{ liked: boolean; likes_count: number }>(
      `/api/comments/${id}/like/`,
    ),
};

export default commentService;
