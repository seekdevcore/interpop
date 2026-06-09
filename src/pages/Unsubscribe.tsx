import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import newsletterService from '@/services/newsletterService';
import { extractApiError } from '@/utils/extractApiError';

/**
 * Página de cancelamento de inscrição da newsletter.
 *
 * Os emails (welcome + article notification) linkam para
 * `{SITE_URL}/newsletter/cancelar/{token}`. Antes esta rota NÃO existia →
 * o link caía no 404 e o leitor não conseguia descadastrar (violação
 * LGPD/CAN-SPAM). Esta página extrai o token do path e chama o endpoint
 * POST /newsletter/unsubscribe/ automaticamente ao montar.
 */
type State = 'loading' | 'success' | 'error';

export function Unsubscribe() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');
  // StrictMode (dev) monta o effect 2x; o ref evita disparar o POST duas vezes.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    if (!token) {
      setState('error');
      setMessage('Link de cancelamento inválido (token ausente).');
      return;
    }
    newsletterService
      .unsubscribe(token)
      .then(({ data }) => {
        setMessage(data.detail || 'Inscrição cancelada com sucesso.');
        setState('success');
      })
      .catch((err: unknown) => {
        setMessage(
          extractApiError(
            err,
            'Não foi possível cancelar — o link pode já ter sido usado ou expirado.',
          ),
        );
        setState('error');
      });
  }, [token]);

  return (
    <PageLayout>
      <main
        className="container-sm"
        style={{ padding: '4rem 0', minHeight: '50vh' }}
      >
        {state === 'loading' && (
          <p role="status" style={{ color: 'var(--clr-muted)' }}>
            Processando cancelamento…
          </p>
        )}

        {state === 'success' && (
          <div role="status">
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                marginBottom: '1rem',
              }}
            >
              Inscrição cancelada
            </h1>
            <p style={{ color: 'var(--clr-muted)', marginBottom: '2rem' }}>
              {message} Você não receberá mais emails da newsletter do Interpop.
              Sentiremos sua falta — pode voltar quando quiser.
            </p>
            <Link to="/" className="btn btn--primary btn--lg">
              Voltar ao início
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div role="alert">
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                marginBottom: '1rem',
              }}
            >
              Não foi possível cancelar
            </h1>
            <p style={{ color: 'var(--clr-muted)', marginBottom: '2rem' }}>
              {message}
            </p>
            <Link to="/" className="btn btn--outline btn--lg">
              Voltar ao início
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
