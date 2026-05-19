/**
 * AuthContext — real API-backed authentication.
 *
 * Strategy:
 *  - On mount, calls GET /api/auth/me/ to restore session from the httpOnly JWT cookie.
 *  - login() posts credentials → sets cookie server-side → stores user in state.
 *  - logout() calls the backend to blacklist the refresh token, then clears state.
 *  - The axios interceptor (api.ts) silently refreshes expired access tokens.
 *  - When refresh fails the 'auth:logout' CustomEvent is fired and we clear state.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authService, type ApiUser } from '../services/authService';

interface AuthContextValue {
  currentUser: ApiUser | null;
  isAdmin: boolean;
  /** Admin OU editor — pode publicar artigos e acessar /admin (UI adapta). */
  canPublish: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  // Restore session on mount
  useEffect(() => {
    authService.me()
      .then(r => setCurrentUser(r.data))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for forced-logout events from the axios interceptor
  useEffect(() => {
    const handler = () => setCurrentUser(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authService.login({ email, password });
    setCurrentUser(data);
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* ignore network errors */ }
    setCurrentUser(null);
  }, []);

  const isAdmin    = currentUser?.role === 'admin';
  const canPublish = isAdmin || currentUser?.role === 'editor';

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, canPublish, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
