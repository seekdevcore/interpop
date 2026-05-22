/**
 * Página 404 editorial — voz Interpop (não "Oops!" genérico de template).
 *
 * F16 do Improvement-system §11.3. Atinge:
 * - SEO honesto: <title> indica 404 (sem chumbar status="200" no HTML).
 * - UX editorial: tom de revista (não tech), CTA pra Home + busca de notícias.
 * - A11y: <main> com role="main", h1 único, contraste WCAG AA já vem do brand.
 */
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import './NotFound.css';

export function NotFound() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Title indica 404 explicitamente — search engines respeitam, e
    // analytics consegue isolar bounces de 404 dos demais.
    const original = document.title;
    document.title = '404 — Página não encontrada | Interpop';
    return () => {
      document.title = original;
    };
  }, []);

  return (
    <PageLayout>
      <main className="not-found" role="main">
        <div className="container-sm not-found__inner">
          <p className="not-found__eyebrow">Erro 404</p>
          <h1 className="not-found__title">Essa página saiu de circulação.</h1>
          <p className="not-found__lede">
            O endereço <code className="not-found__path">{pathname}</code> não
            existe — pode ser um link antigo, um typo, ou um artigo
            despublicado. Não tem perda: a redação está logo ali.
          </p>

          <div className="not-found__actions">
            <Link to="/" className="btn btn--primary btn--lg">
              Ir para a home
            </Link>
            <Link to="/noticias" className="btn btn--outline btn--lg">
              Ver todas as notícias
            </Link>
          </div>

          <hr className="not-found__divider" />

          <p className="not-found__footnote">
            Se você chegou aqui por um link interno quebrado,{' '}
            <Link to="/sobre" className="not-found__link">
              avise a redação
            </Link>{' '}
            — a gente prefere consertar antes do próximo leitor tropeçar.
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
