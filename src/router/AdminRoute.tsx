import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Gate para rotas do painel editorial (/admin, /criar-publicacao).
 *
 * Permite acesso a quem pode publicar — admin OU editor. A UI dentro de
 * /admin adapta-se ao role: editor vê "Solicitar banimento", admin vê
 * "Banir" + aba de Solicitações com botões aprovar/rejeitar.
 *
 * Usuários comuns (role=user) são redirecionados para a home.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { canPublish } = useAuth();
  return canPublish ? <>{children}</> : <Navigate to="/" replace />;
}
