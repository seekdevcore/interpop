import api from './api';

export interface ApiUser {
  id: string;
  username: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email?: string;
  /** dev = dono/criador (admin++ imune a ban) · admin = poder total · editor = publica + solicita ban · user = leitor */
  role: 'dev' | 'admin' | 'editor' | 'user';
  bio: string;
  avatar: string | null;
  avatar_initial: string;
  date_joined: string;
  is_banned: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  password2: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<ApiUser>('/api/auth/login/', payload),

  logout: () => api.post('/api/auth/logout/'),

  register: (payload: RegisterPayload) =>
    api.post<ApiUser>('/api/auth/register/', payload),

  me: () => api.get<ApiUser>('/api/auth/me/'),

  /** PATCH parcial. Backend aceita: first_name, last_name, bio, avatar.
   *  `email` e `username` NÃO são editáveis aqui — exigem fluxo separado
   *  com confirmação por email (fora do MVP). */
  updateProfile: (
    payload: Partial<{
      first_name: string;
      last_name: string;
      bio: string;
      avatar: File | null;
    }>,
  ) => {
    // Se há arquivo, precisa ser multipart/form-data
    if (payload.avatar instanceof File) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          fd.append(k, v as string | Blob);
        }
      });
      return api.patch<ApiUser>('/api/auth/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.patch<ApiUser>('/api/auth/me/', payload);
  },

  changePassword: (old_password: string, new_password: string) =>
    api.post('/api/auth/me/password/', { old_password, new_password }),

  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>('/api/auth/password-reset/', { email }),

  confirmPasswordReset: (token: string, new_password: string) =>
    api.post<{ detail: string }>('/api/auth/password-reset/confirm/', {
      token,
      new_password,
    }),
};
