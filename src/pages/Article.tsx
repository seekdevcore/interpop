import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ArticleShareBar } from '../components/article/ArticleShareBar';
import { ArticleAdminActions } from '../components/article/ArticleAdminActions';
import { formatDateLong } from '../utils/formatDate';
import { ArticleComments } from '../components/article/ArticleComments';
import { useAuth } from '../contexts/AuthContext';
import articleService, { type ApiArticle } from '../services/articleService';
import { renderArticleBody } from '../utils/renderArticleBody';
import '../styles/article-body.css';
import './Article.css';

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function Article() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();

  const [article, setArticle] = useState<ApiArticle | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [loadingArticle, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const viewedRef = useRef(false);

  // Reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (el.scrollTop / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load article
  useEffect(() => {
    if (!slug) {
      navigate('/');
      return;
    }
    setLoading(true);
    setLoadError('');
    articleService
      .get(slug)
      .then((r) => setArticle(r.data))
      .catch((err: unknown) => {
        const e = err as {
          response?: { status?: number; data?: { detail?: string } };
          request?: unknown;
        };
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;
        if (status === 404) {
          setLoadError('Artigo não encontrado.');
        } else if (status) {
          setLoadError(
            detail ?? `Erro inesperado do servidor (HTTP ${status}).`,
          );
        } else if (e?.request) {
          setLoadError(
            'Não foi possível alcançar o servidor. Verifique se o backend está rodando.',
          );
        } else {
          setLoadError('Erro inesperado ao carregar o artigo.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  // Record view once
  useEffect(() => {
    if (article && !viewedRef.current) {
      viewedRef.current = true;
      articleService.recordView(article.slug).catch(() => {});
    }
  }, [article]);

  if (loadingArticle) {
    return (
      <PageLayout>
        <div
          className="article-loading"
          role="status"
          aria-label="Carregando artigo"
        >
          <div className="article-loading__spinner" />
        </div>
      </PageLayout>
    );
  }

  if (loadError || !article) {
    return (
      <PageLayout>
        <div
          className="container-sm"
          style={{ padding: '4rem 0', textAlign: 'center' }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2rem',
              marginBottom: '1rem',
            }}
          >
            {loadError
              ? 'Não foi possível abrir o artigo'
              : 'Artigo indisponível'}
          </h1>
          <p style={{ color: 'var(--clr-muted)', marginBottom: '2rem' }}>
            {loadError || 'Tente novamente em instantes.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        </div>
      </PageLayout>
    );
  }

  const canEditArticle =
    !!currentUser && (isAdmin || currentUser.id === article.author.id);

  return (
    <PageLayout>
      <div
        className="article-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso de leitura"
      >
        <div
          className="article-progress__fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <article className="article-page">
        <div className="container-sm">
          <nav className="article-breadcrumb" aria-label="Localização atual">
            <Link to="/">Início</Link>
            <span aria-hidden="true">›</span>
            {article.category && <Link to="/">{article.category.name}</Link>}
            {article.category && <span aria-hidden="true">›</span>}
            <span aria-current="page">Artigo</span>
          </nav>

          <header className="article-header">
            {article.category && (
              <Badge variant="subtle">{article.category.name}</Badge>
            )}
            <h1 className="article-title">{article.title}</h1>
            <p className="article-excerpt">{article.excerpt}</p>

            <div className="article-byline">
              <div className="article-author">
                <Avatar
                  src={article.author.avatar}
                  initial={article.author.avatar_initial}
                  className="article-author__avatar"
                />
                <div className="article-author__info">
                  <strong>{article.author.full_name}</strong>
                  <span>
                    {article.author.role === 'admin' ||
                    article.author.role === 'dev'
                      ? 'Editor'
                      : 'Colaborador'}
                  </span>
                </div>
              </div>
              <div className="article-meta">
                {article.published_at && (
                  <time dateTime={article.published_at}>
                    {formatDateLong(article.published_at)}
                  </time>
                )}
                <span aria-hidden="true">·</span>
                <span>{readingTime(article.body ?? '')} min de leitura</span>
              </div>
            </div>

            <ArticleShareBar title={article.title} />

            {canEditArticle && <ArticleAdminActions slug={article.slug} />}
          </header>
        </div>

        {article.cover_image && (
          <figure className="article-cover">
            {/* P2: width/height hint para o browser reservar área antes do
                load (anti-CLS). Aspect-ratio do container (16:9) e o CSS
                aplicam object-fit: cover — atributos NÃO travam o tamanho
                renderizado, só dão a proporção. */}
            <img
              src={article.cover_image}
              alt={article.title}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={1600}
              height={900}
            />
            {article.cover_caption && (
              <figcaption className="article-cover__caption">
                {article.cover_caption}
              </figcaption>
            )}
          </figure>
        )}

        <div className="container-sm">
          <div className="article-body">
            {renderArticleBody(article.body ?? '', article.author.full_name)}
          </div>

          <hr className="article-divider" />

          <div className="article-author-card">
            <Avatar
              src={article.author.avatar}
              initial={article.author.avatar_initial}
              className="article-author-card__avatar"
            />
            <div>
              <p className="article-author-card__name">
                {article.author.full_name}
              </p>
              <p className="article-author-card__role">
                {article.author.role === 'admin' ||
                article.author.role === 'dev'
                  ? 'Editor'
                  : 'Colaborador'}
              </p>
              {article.author.bio && (
                <p className="article-author-card__bio">{article.author.bio}</p>
              )}
            </div>
          </div>

          <hr className="article-divider" />

          <ArticleComments slug={article.slug} currentUser={currentUser} />
        </div>
      </article>
    </PageLayout>
  );
}
