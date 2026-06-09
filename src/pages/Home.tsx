import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { NewsCard } from '../components/ui/NewsCard';
import { NewsCarousel } from '../components/ui/NewsCarousel';
import articleService, { type ApiArticle } from '../services/articleService';
import interpopLogo from '../assets/interpop-logo.svg';
import './Home.css';

/**
 * Editorial showcase home page.
 *
 * Structure follows the Atlantic / Substack / NYT "front" pattern:
 *   1. Hero — the project manifesto.
 *   2. Featured — a single hand-picked article (if any).
 *   3. Latest — auto-rotating carousel of the most recent stories.
 *   4. CTA → /noticias for the full archive.
 *
 * Filters and search live in /noticias (the archive). Home is intentionally
 * pull-driven: we show curated entry points, not a discovery surface.
 */
const CAROUSEL_SIZE = 9;

export function Home() {
  const [carouselArticles, setCarouselArticles] = useState<ApiArticle[]>([]);
  const [featured, setFeatured] = useState<ApiArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    articleService
      .list({ status: 'published', page: '1' })
      .then(({ data }) => {
        // Híbrido (padrão NYT/Substack): usa o artigo marcado como destaque
        // pela curadoria; se NENHUM estiver marcado (esquecimento comum em
        // equipe pequena), cai pro mais recente publicado — a home nunca fica
        // sem hero. results já vem ordenado por -published_at do backend.
        const feat =
          data.results.find((a) => a.is_featured) ?? data.results[0] ?? null;
        setFeatured(feat);
        // Carousel shows the latest N non-featured articles. The featured
        // article already has its own dedicated section, so excluding it
        // avoids visual duplication.
        const rest = data.results.filter((a) => a.id !== feat?.id);
        setCarouselArticles(rest.slice(0, CAROUSEL_SIZE));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      {/* Editorial hero */}
      <section
        id="sobre-o-projeto"
        className="home-hero"
        aria-labelledby="hero-manifesto"
      >
        <div className="container">
          <div className="home-hero__grid">
            <div className="home-hero__text">
              <p className="home-hero__tag">Sobre o projeto</p>
              <h1 id="hero-manifesto" className="home-hero__manifesto">
                O <em>Interpop</em> é um projeto independente que busca analisar
                criticamente o <em>Soft Power</em> e seu papel na manutenção da
                hegemonia global.
              </h1>
              <p className="home-hero__lede">
                Nesse sentido, a partir da cultura pop e das dinâmicas
                midiáticas, o projeto investiga como determinados Atores exercem
                influência política de forma indireta no sistema internacional.
              </p>
            </div>
            <div className="home-hero__visual" aria-hidden="true">
              <div className="home-hero__visual-pattern" />
              <img
                src={interpopLogo}
                alt=""
                className="home-hero__visual-mark"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="home-featured" aria-labelledby="featured-heading">
          <div className="container">
            {/* h2 (não div): dá heading real à seção e evita o salto h1→h3 do
                título do card destaque (WAVE: "skipped heading level"). */}
            <h2 className="home-featured__label" id="featured-heading">
              <span className="home-featured__dot" />
              Destaque
            </h2>
            <NewsCard article={featured} variant="featured" />
          </div>
        </section>
      )}

      {/* Latest news — carousel */}
      <section className="home-news" aria-labelledby="news-heading">
        <div className="container">
          <div className="home-news__header">
            <h2 id="news-heading">Últimas Notícias</h2>
            {/* aria-label diferente do botão "Ver todas as notícias" abaixo
                — ambos apontam pra /noticias mas WAVE flagga como Redundant
                link se accessible name for igual. Texto visual fica curto pra
                o header, leitor de tela ouve o contexto da seção. */}
            <Link
              to="/noticias"
              className="home-news__see-all"
              aria-label="Ver todas as notícias do header"
            >
              Ver todas →
            </Link>
          </div>

          {loading ? (
            <div
              className="home-loading"
              role="status"
              aria-label="Carregando artigos"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="home-skeleton" />
              ))}
            </div>
          ) : carouselArticles.length > 0 ? (
            <NewsCarousel
              articles={carouselArticles}
              label="Últimas notícias"
            />
          ) : (
            <div className="home-empty" role="status">
              <p>Nenhum artigo disponível no momento.</p>
            </div>
          )}

          <div className="home-load-more">
            {/* F12: button>a é HTML inválido. Como o destino é navegação,
                usar <Link> estilizado com classes do Button — semântica
                correta (a11y screen-reader anuncia "link", não "button"). */}
            <Link to="/noticias" className="btn btn--outline btn--lg">
              Ver todas as notícias
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
