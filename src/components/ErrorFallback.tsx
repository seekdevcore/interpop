/**
 * Fallback editorial para qualquer erro não capturado em qualquer rota.
 * Usado pelo <ErrorBoundary> global em AppRouter.tsx.
 *
 * Sem isso, um throw em renderArticleBody, Recharts, ou qualquer effect
 * derrubava a aplicação inteira pra tela branca. Item F5/C7 do
 * Improvement-system.md §11.1 (priority matrix top-7).
 *
 * Decisão de UX: oferecer 2 ações — "Recarregar" (refresh do React state,
 * resolve a maioria dos casos transitórios) e "Voltar à home" (escape
 * caso a página atual esteja consistentemente quebrada).
 */
import type { FallbackProps } from 'react-error-boundary';
import { Link } from 'react-router-dom';
import './ErrorFallback.css';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  // Log no console em dev — em prod o Sentry pega via onError do boundary.
  // `error` é tipado como `unknown` em react-error-boundary (qualquer throw,
  // não só `new Error(...)`). Narrow com instanceof antes de acessar .message.
  if (import.meta.env.DEV) {
    console.error('ErrorBoundary:', error);
  }

  return (
    <div className="error-fallback" role="alert">
      <div className="error-fallback__content">
        <p className="error-fallback__eyebrow">Algo deu errado</p>
        <h1 className="error-fallback__title">
          Não conseguimos renderizar esta página.
        </h1>
        <p className="error-fallback__lead">
          O erro foi registrado e vamos investigar. Você pode tentar recarregar
          ou voltar para a home.
        </p>
        <div className="error-fallback__actions">
          <button
            type="button"
            className="error-fallback__btn error-fallback__btn--primary"
            onClick={resetErrorBoundary}
          >
            Tentar de novo
          </button>
          <Link
            to="/"
            className="error-fallback__btn error-fallback__btn--ghost"
            onClick={resetErrorBoundary}
          >
            Voltar à home
          </Link>
        </div>
        {import.meta.env.DEV && error instanceof Error && (
          <details className="error-fallback__details">
            <summary>Detalhes do erro (apenas em dev)</summary>
            <pre>{error.message}</pre>
            {error.stack && <pre>{error.stack}</pre>}
          </details>
        )}
      </div>
    </div>
  );
}
