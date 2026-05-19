import api from './api';

export interface ApiUser {
  id: string;
  username: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email?: string;
  /** admin = poder total · editor = publica + solicita ban · user = leitor */
  role: 'admin' | 'editor' | 'user';
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

  logout: () =>
    api.post('/api/auth/logout/'),

  register: (payload: RegisterPayload) =>
    api.post<ApiUser>('/api/auth/register/', payload),

  me: () =>
    api.get<ApiUser>('/api/auth/me/'),

  changePassword: (old_password: string, new_password: string) =>
    api.post('/api/auth/me/password/', { old_password, new_password }),

  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>('/api/auth/password-reset/', { email }),

  confirmPasswordReset: (token: string, new_password: string) =>
    api.post<{ detail: string }>('/api/auth/password-reset/confirm/', { token, new_password }),
};
