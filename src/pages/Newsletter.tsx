import { useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import newsletterService from '../services/newsletterService';
import { extractApiError } from '../utils/extractApiError';
import './Newsletter.css';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const { data } = await newsletterService.subscribe(email.trim());
      setMessage(data.detail);
      setStatus('success');
      setEmail('');
    } catch (err: unknown) {
      setMessage(
        extractApiError(
          err,
          'Não foi possível concluir a inscrição. Tente novamente.',
        ),
      );
      setStatus('error');
    }
  };

  return (
    <PageLayout>
      <article className="newsletter-page">
        <div className="container-sm">
          <header className="newsletter-page__header">
            <p className="newsletter-page__eyebrow">Newsletter</p>
            <h1 className="newsletter-page__title">
              Análise crítica de <em>Soft Power</em>, direto no seu e-mail.
            </h1>
            <p className="newsletter-page__lede">
              Toda semana, uma seleção dos textos publicados aqui sobre cultura
              pop, mídia e disputas geopolíticas — sem ruído, sem clickbait.
            </p>
          </header>

          {status === 'success' ? (
            <div className="newsletter-page__success" role="status">
              <div className="newsletter-page__success-icon" aria-hidden="true">
                ✓
              </div>
              <h2>{message || 'Inscrição confirmada.'}</h2>
              <p>
                Você receberá um e-mail de boas-vindas em instantes. Se não
                chegar, confira a pasta de spam e marque como "não é spam" para
                garantir as próximas edições.
              </p>
            </div>
          ) : (
            <form
              className="newsletter-page__form"
              onSubmit={handleSubmit}
              noValidate
            >
              <label
                htmlFor="newsletter-email"
                className="newsletter-page__label"
              >
                Seu e-mail
              </label>
              <div className="newsletter-page__field">
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  aria-describedby={
                    status === 'error' ? 'newsletter-error' : undefined
                  }
                  required
                  disabled={status === 'loading'}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Inscrevendo…' : 'Assinar'}
                </Button>
              </div>
              {status === 'error' && (
                <p
                  id="newsletter-error"
                  className="newsletter-page__error"
                  role="alert"
                >
                  {message}
                </p>
              )}
              <p className="newsletter-page__privacy">
                Usamos seu e-mail só para enviar a newsletter. Você pode
                cancelar a qualquer momento — o link de cancelamento vai em cada
                edição.
              </p>
            </form>
          )}

          <section className="newsletter-page__what">
            <h2>O que você vai receber</h2>
            <ul>
              <li>
                <strong>Edições semanais</strong> com análises sobre Música,
                Moda, Cinema, Literatura e Cultura Digital.
              </li>
              <li>
                <strong>Recomendações editoriais</strong> — leituras e produções
                relevantes para entender o contexto.
              </li>
              <li>
                <strong>Sem promoções</strong>, sem rastreamento de cliques, sem
                spam. E-mail é canal de leitura, não de marketing.
              </li>
            </ul>
          </section>
        </div>
      </article>
    </PageLayout>
  );
}
