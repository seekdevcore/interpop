/**
 * Painel de Publicações — listagem com filtros para a equipe editorial.
 *
 * Segue o padrão `referencias_dashboards` (CLAUDE.md):
 *  - Cartões de resumo no topo (Total, Publicados, Rascunhos)
 *  - Filtros sempre visíveis (busca, categoria, status) — nunca em modal
 *  - Tabela com hierarquia vertical (capa+título à esquerda → ações à direita)
 *  - Paleta restrita (admin já estabelecida)
 *
 * Regras de permissão:
 *  - Admin pode editar/excluir QUALQUER publicação
 *  - Editor pode editar/excluir apenas as PRÓPRIAS
 *  - A listagem mostra todos os artigos (drafts + publicados) para a
 *    equipe editorial — convenção CMS (WordPress/Ghost): visibilidade
 *    total para colaboração, edição restrita por autoria.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import articleService, {
  type ApiArticle,
  type ApiCategory,
} from '@/services/articleService';
import type { ApiUser } from '@/services/authService';
import { extractApiError } from '@/utils/extractApiError';
import { formatDateShort } from '@/utils/formatDate';

type StatusFilter = 'all' | 'published' | 'draft';

interface AdminPostsProps {
  currentUser: ApiUser | null;
  isAdmin: boolean;
}

export function AdminPosts({ currentUser, isAdmin }: AdminPostsProps) {
  const navigate = useNavigate();

  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros — refletem a UI imediatamente; busca é debounced.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Confirmação de exclusão inline (sem modal) — mesma UX do Article.tsx.
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState('');
  const [deletingSlug, setDeletingSlug] = useState('');

  // Debounce da busca (300ms) para não disparar request a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Carrega categorias uma vez (cacheado in-module no service).
  useEffect(() => {
    articleService
      .getCachedCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch reutilizável — setLoading(true) MORA aqui (dentro do async, não no
  // body do useEffect). Isso evita o lint `react-hooks/set-state-in-effect`
  // que pega setState síncrono no corpo do effect. Padrão simétrico ao
  // Admin/index.tsx (fetchUsers/fetchBans começam com setLoadingX(true)).
  const fetchArticles = useCallback(
    async (searchVal: string, categoryVal: string, statusVal: StatusFilter) => {
      setLoading(true);
      const params: Record<string, string> = { page: '1' };
      if (searchVal) params.search = searchVal;
      if (categoryVal) params.category__slug = categoryVal;
      if (statusVal !== 'all') params.status = statusVal;

      try {
        const { data } = await articleService.list(params);
        setArticles(data.results);
        setTotalCount(data.count);
        setError('');
      } catch {
        setError('Não foi possível carregar as publicações.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Re-fetch a cada mudança de filtro (busca debounced + categoria + status).
  useEffect(() => {
    fetchArticles(search, categorySlug, statusFilter);
  }, [search, categorySlug, statusFilter, fetchArticles]);

  // Stats derivadas — calcular a partir da lista filtrada já é suficiente,
  // mas para dar contagem fiel de TODOS preciso de uma view sem filtro.
  // Solução pragmática: usar totalCount do response (reflete filtros atuais)
  // + contar locais para published/draft visíveis. Para evitar request extra
  // ao montar, deixo published/draft refletindo a lista atual também.
  const stats = useMemo(() => {
    const published = articles.filter((a) => a.status === 'published').length;
    const drafts = articles.filter((a) => a.status === 'draft').length;
    return { total: totalCount, published, drafts };
  }, [articles, totalCount]);

  const canEdit = useCallback(
    (article: ApiArticle): boolean =>
      isAdmin || (!!currentUser && currentUser.id === article.author.id),
    [currentUser, isAdmin],
  );

  const handleDelete = useCallback(
    async (slug: string) => {
      setDeletingSlug(slug);
      setError('');
      try {
        await articleService.remove(slug);
        setConfirmDeleteSlug('');
        // Re-fetch usando filtros atuais — mantém a página consistente.
        await fetchArticles(search, categorySlug, statusFilter);
      } catch (err: unknown) {
        setError(
          extractApiError(err, 'Não foi possível excluir a publicação.'),
        );
      } finally {
        setDeletingSlug('');
      }
    },
    [fetchArticles, search, categorySlug, statusFilter],
  );

  return (
    <section
      className="admin__section admin-posts"
      aria-labelledby="posts-heading"
    >
      <h2 id="posts-heading" className="admin__section-title">
        <span>Publicações</span>
      </h2>

      {/* Cartões de resumo — padrão referencias_dashboards: agregados no topo */}
      <div className="admin-posts__stats">
        <div className="admin-posts__stat">
          <p className="admin-posts__stat-value">{stats.total}</p>
          <p className="admin-posts__stat-label">No filtro atual</p>
        </div>
        <div className="admin-posts__stat">
          <p className="admin-posts__stat-value">{stats.published}</p>
          <p className="admin-posts__stat-label">Publicados (página)</p>
        </div>
        <div className="admin-posts__stat">
          <p className="admin-posts__stat-value">{stats.drafts}</p>
          <p className="admin-posts__stat-label">Rascunhos (página)</p>
        </div>
      </div>

      {/* Barra de filtros — sempre visível, nunca em modal */}
      <div className="admin-posts__filters" role="search">
        <div className="admin-posts__search">
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
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
            placeholder="Buscar por título, conteúdo ou autor..."
            aria-label="Buscar publicações"
          />
        </div>

        <div className="admin-posts__filter-group">
          <label
            htmlFor="filter-category"
            className="admin-posts__filter-label"
          >
            Categoria
          </label>
          <select
            id="filter-category"
            className="admin-posts__select"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="admin-posts__status-segmented"
          role="group"
          aria-label="Filtrar por status"
        >
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'published', label: 'Publicados' },
              { key: 'draft', label: 'Rascunhos' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`admin-posts__seg-btn ${statusFilter === key ? 'admin-posts__seg-btn--active' : ''}`}
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="admin__api-error" role="alert">
          {error}
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <div className="admin__empty">Carregando…</div>
      ) : articles.length === 0 ? (
        <div className="admin__empty">
          <p style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
            Nenhuma publicação encontrada
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-muted)' }}>
            {search || categorySlug || statusFilter !== 'all'
              ? 'Tente ajustar os filtros acima.'
              : 'Crie sua primeira publicação para começar.'}
          </p>
          {(search || categorySlug || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setCategorySlug('');
                setStatusFilter('all');
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="admin__table-wrapper">
          <table className="admin__table admin-posts__table">
            <thead>
              <tr>
                <th>Publicação</th>
                <th>Autor</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Data</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const isConfirming = confirmDeleteSlug === article.slug;
                const isDeleting = deletingSlug === article.slug;
                const editable = canEdit(article);

                return (
                  <tr key={article.id}>
                    <td>
                      <div className="admin-posts__title-cell">
                        {article.cover_image ? (
                          <img
                            src={article.cover_image}
                            alt=""
                            className="admin-posts__thumb"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div
                            className="admin-posts__thumb admin-posts__thumb--placeholder"
                            aria-hidden="true"
                          >
                            ▤
                          </div>
                        )}
                        <div className="admin-posts__title-meta">
                          <Link
                            to={`/noticia/${article.slug}`}
                            className="admin-posts__title-link"
                          >
                            {article.title}
                          </Link>
                          {article.excerpt && (
                            <p className="admin-posts__excerpt">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin__user-cell">
                        <Avatar
                          src={article.author.avatar}
                          initial={article.author.avatar_initial}
                          className="admin__avatar admin__avatar--sm"
                        />
                        <p className="admin__user-cell-name">
                          {article.author.full_name}
                        </p>
                      </div>
                    </td>
                    <td>
                      {article.category ? (
                        <span className="admin-posts__cat-badge">
                          {article.category.name}
                        </span>
                      ) : (
                        <span className="admin__cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-posts__status admin-posts__status--${article.status}`}
                      >
                        {article.status === 'published'
                          ? '● Publicado'
                          : '○ Rascunho'}
                      </span>
                    </td>
                    <td className="admin__cell-muted admin__cell-nowrap">
                      {formatDateShort(
                        article.published_at ?? article.created_at,
                      ) || '—'}
                    </td>
                    <td>
                      {editable ? (
                        <div className="admin-posts__actions">
                          {!isConfirming ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(`/editar-publicacao/${article.slug}`)
                                }
                              >
                                Editar
                              </Button>
                              <button
                                type="button"
                                className="admin-posts__delete-btn"
                                onClick={() =>
                                  setConfirmDeleteSlug(article.slug)
                                }
                                disabled={!!deletingSlug}
                              >
                                Excluir
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="admin-posts__delete-btn admin-posts__delete-btn--confirm"
                                onClick={() => handleDelete(article.slug)}
                                disabled={isDeleting}
                              >
                                {isDeleting ? 'Excluindo…' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                className="admin-posts__cancel-btn"
                                onClick={() => setConfirmDeleteSlug('')}
                                disabled={isDeleting}
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="admin__cell-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
