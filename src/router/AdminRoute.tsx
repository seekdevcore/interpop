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
  const { canPublish, isLoading } = useAuth();

  // Enquanto o /auth/me/ inicial não resolve, currentUser é null e canPublish
  // é false. SEM este guard, um reload duro de /admin redirecionava o
  // admin/editor pra home antes da sessão carregar. Espera o auth resolver.
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Carregando"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--clr-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Carregando…
      </div>
    );
  }

  return canPublish ? <>{children}</> : <Navigate to="/" replace />;
}
