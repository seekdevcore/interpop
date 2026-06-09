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
    api.post<ApiUser>('/api/v1/auth/login/', payload),

  logout: () => api.post('/api/v1/auth/logout/'),

  register: (payload: RegisterPayload) =>
    api.post<ApiUser>('/api/v1/auth/register/', payload),

  me: () => api.get<ApiUser>('/api/v1/auth/me/'),

  /** PATCH parcial. Backend aceita: username, first_name, last_name, bio, avatar.
   *  `email` NÃO é editável aqui — exige fluxo separado com confirmação por
   *  email (fora do MVP). */
  updateProfile: (
    payload: Partial<{
      username: string;
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
      return api.patch<ApiUser>('/api/v1/auth/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.patch<ApiUser>('/api/v1/auth/me/', payload);
  },

  changePassword: (old_password: string, new_password: string) =>
    api.post('/api/v1/auth/me/password/', { old_password, new_password }),

  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>('/api/v1/auth/password-reset/', { email }),

  confirmPasswordReset: (token: string, new_password: string) =>
    api.post<{ detail: string }>('/api/v1/auth/password-reset/confirm/', {
      token,
      new_password,
    }),
};
