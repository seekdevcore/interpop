import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { NewsCard } from '../components/ui/NewsCard';
import { Button } from '../components/ui/Button';
import { categoryVariant } from '../utils/categoryVariant';
import articleService, {
  type ApiArticle,
  type ApiCategory,
} from '../services/articleService';
import './News.css';

/**
 * Dedicated news archive — wired to the navbar "Notícias" link and the
 * per-category footer/navbar shortcuts (e.g. /noticias?categoria=música).
 *
 * Differs from Home (which is an editorial showcase with hero + featured):
 *   - No hero, no featured callout; archive density up front.
 *   - URL is the source of truth for category + search, so deep-links
 *     from navbar/footer roundtrip cleanly and the active chip syncs.
 *   - Page size follows the backend default (DRF PAGE_SIZE=20). "Ver mais"
 *     button paginates incrementally — keyboard- and screen-reader-friendly
 *     (preferred over infinite scroll per WCAG 2.4.5).
 */
export function News() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('categoria') ?? '';
  const urlSearch = searchParams.get('busca') ?? '';

  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState(urlCategory);
  const [search, setSearch] = useState(urlSearch);
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Keep state in sync with URL changes coming from the navbar/footer.
  useEffect(() => {
    setActiveCategory(urlCategory);
  }, [urlCategory]);
  useEffect(() => {
    setSearch(urlSearch);
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    // Cache em memória — primeira página/montagem busca; demais reusam.
    articleService
      .getCachedCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const fetchArticles = useCallback(
    async (
      pageNum: number,
      searchVal: string,
      categorySlug: string,
      append: boolean,
    ) => {
      const params: Record<string, string> = {
        status: 'published',
        page: String(pageNum),
      };
      if (searchVal) params.search = searchVal;
      if (categorySlug) params.category__slug = categorySlug;

      try {
        const { data } = await articleService.list(params);
        if (append) setArticles((prev) => [...prev, ...data.results]);
        else setArticles(data.results);
        setTotalCount(data.count);
      } catch {
        // silent — keeping existing list is the least-disruptive failure
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchArticles(1, search, activeCategory, false).finally(() =>
      setLoading(false),
    );
  }, [search, activeCategory, fetchArticles]);

  const handleLoadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    await fetchArticles(next, search, activeCategory, true);
    setPage(next);
    setLoadingMore(false);
  };

  const updateUrl = (cat: string, srch: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (cat) next.set('categoria', cat);
        else next.delete('categoria');
        if (srch) next.set('busca', srch);
        else next.delete('busca');
        return next;
      },
      { replace: true },
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    updateUrl(activeCategory, searchInput);
  };

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    setSearch('');
    setSearchInput('');
    updateUrl(slug, '');
  };

  const hasMore = articles.length < totalCount;
  const activeCategoryName =
    categories.find((c) => c.slug === activeCategory)?.name ?? '';

  return (
    <PageLayout>
      <section className="news-page" aria-labelledby="news-page-title">
        <div className="container">
          <header className="news-page__header">
            <p className="news-page__eyebrow">Arquivo</p>
            <h1 id="news-page-title" className="news-page__title">
              {activeCategoryName ? activeCategoryName : 'Notícias'}
            </h1>
            <p className="news-page__count">
              {loading
                ? 'Carregando…'
                : `${totalCount} artigo${totalCount !== 1 ? 's' : ''}${
                    activeCategoryName && !loading ? '' : ''
                  }`}
            </p>
          </header>

          <div className="home-filters" role="search">
            <form
              className="home-filters__search"
              onSubmit={handleSearchSubmit}
            >
              <svg
                className="home-filters__icon"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M13 13l3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar notícias..."
                aria-label="Buscar notícias"
              />
            </form>

            <div
              className="home-filters__categories"
              role="group"
              aria-label="Filtrar por categoria"
            >
              <button
                onClick={() => handleCategoryChange('')}
                className={`home-filters__cat ${activeCategory === '' ? 'home-filters__cat--active' : ''}`}
                aria-pressed={activeCategory === ''}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={`home-filters__cat ${activeCategory === cat.slug ? 'home-filters__cat--active' : ''}`}
                  data-category={categoryVariant(cat.slug)}
                  aria-pressed={activeCategory === cat.slug}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div
              className="home-loading"
              role="status"
              aria-label="Carregando artigos"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="home-skeleton" />
              ))}
            </div>
          ) : articles.length > 0 ? (
            <div className="home-grid">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} titleAs="h2" />
              ))}
            </div>
          ) : (
            <div className="home-empty" role="status">
              <p>
                {search ? (
                  <>
                    Nenhum artigo encontrado para "<strong>{search}</strong>".
                  </>
                ) : activeCategoryName ? (
                  <>
                    Nenhum artigo em <strong>{activeCategoryName}</strong>{' '}
                    ainda.
                  </>
                ) : (
                  'Nenhum artigo disponível no momento.'
                )}
              </p>
              {(search || activeCategory) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSearchInput('');
                    handleCategoryChange('');
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          {!loading && hasMore && (
            <div className="home-load-more">
              <Button
                variant="outline"
                size="lg"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Carregando…' : 'Ver mais notícias'}
              </Button>
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
