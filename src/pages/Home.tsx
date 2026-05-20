import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { NewsCard } from '../components/ui/NewsCard';
import { NewsCarousel } from '../components/ui/NewsCarousel';
import { Button } from '../components/ui/Button';
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
        const feat = data.results.find((a) => a.is_featured) ?? null;
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
        <section className="home-featured" aria-label="Destaque">
          <div className="container">
            <div className="home-featured__label">
              <span className="home-featured__dot" />
              Destaque
            </div>
            <NewsCard article={featured} variant="featured" />
          </div>
        </section>
      )}

      {/* Latest news — carousel */}
      <section className="home-news" aria-labelledby="news-heading">
        <div className="container">
          <div className="home-news__header">
            <h2 id="news-heading">Últimas Notícias</h2>
            <Link to="/noticias" className="home-news__see-all">
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
            <Button variant="outline" size="lg">
              <Link to="/noticias" style={{ color: 'inherit' }}>
                Ver todas as notícias
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
