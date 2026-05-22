import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import moderationService, {
  type ApiBan,
  type ApiBanRequest,
} from '../../services/moderationService';
import metricsService, {
  type AdminMetricsResponse,
  type MetricsPeriod,
} from '../../services/metricsService';
import { MetricsDashboard } from './MetricsDashboard';
import { AdminPosts } from './AdminPosts';
import type { ApiUser as ModerationUser } from '../../services/authService';
import { extractApiError } from '../../utils/extractApiError';
import interpopLogo from '../../assets/interpop-logo.svg';
import './Admin.css';

type Tab = 'usuarios' | 'publicacoes' | 'banimentos' | 'metricas';
type BanSubTab = 'ativos' | 'solicitacoes';
type MetricsView = 'simples' | 'dashboard';

const PERIOD_LABELS: { key: MetricsPeriod; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
];

interface BanModalState {
  open: boolean;
  user: ModerationUser | null;
  reason: string;
  triggerMessage: string;
}

interface UnbanModalState {
  open: boolean;
  ban: ApiBan | null;
}

export function Admin() {
  // `isAdmin` vem do AuthContext e já trata dev como admin++ (dono/criador).
  // NÃO recomputar localmente — antes recomputava só `role === 'admin'` e o
  // dev perdia tab Métricas, ações de ban etc.
  const { currentUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('usuarios');
  const [search, setSearch] = useState('');

  const [users, setUsers] = useState<ModerationUser[]>([]);
  const [bans, setBans] = useState<ApiBan[]>([]);
  const [banRequests, setBanRequests] = useState<ApiBanRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingBans, setLoadingBans] = useState(true);
  const [loadingBanReqs, setLoadingBanReqs] = useState(true);

  // ── Banimentos sub-tabs ──
  // Editor não vê sub-tab "Usuários banidos" (admin-only endpoint), então
  // inicia direto em 'solicitacoes' — única que ele consegue ver.
  const [banTab, setBanTab] = useState<BanSubTab>(
    isAdmin ? 'ativos' : 'solicitacoes',
  );

  // ── Métricas ──
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('week');
  const [metricsView, setMetricsView] = useState<MetricsView>('simples');
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [banModal, setBanModal] = useState<BanModalState>({
    open: false,
    user: null,
    reason: '',
    triggerMessage: '',
  });
  const [unbanModal, setUnbanModal] = useState<UnbanModalState>({
    open: false,
    ban: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────
  //
  // Pattern: setState dentro de useEffect dispara cascading renders
  // (eslint-plugin-react-hooks v7 / React Compiler). Por isso:
  //
  //   1. O fetch inicial (montagem) NÃO chama setLoadingX(true) — o useState
  //      já é inicializado em `true`. Apenas o `.finally` flipa para `false`.
  //   2. Os fetchers reusáveis (fetchUsers, fetchBans, loadMetrics) são
  //      chamados de event handlers / callbacks de mutação, nunca de effects.
  //   3. A flag `cancelled` evita setState após desmontagem.

  const fetchUsers = useCallback(() => {
    setLoadingUsers(true);
    moderationService
      .listUsers()
      .then((r) => setUsers(r.data.results))
      .catch(() => setApiError('Erro ao carregar usuários.'))
      .finally(() => setLoadingUsers(false));
  }, []);

  const fetchBans = useCallback(() => {
    setLoadingBans(true);
    moderationService
      .listBans()
      .then((r) => setBans(r.data.results))
      .catch(() => setApiError('Erro ao carregar banimentos.'))
      .finally(() => setLoadingBans(false));
  }, []);

  const fetchBanRequests = useCallback(() => {
    setLoadingBanReqs(true);
    moderationService
      .listBanRequests({ status: 'pending' })
      .then((r) => setBanRequests(r.data.results))
      .catch(() => setApiError('Erro ao carregar solicitações de banimento.'))
      .finally(() => setLoadingBanReqs(false));
  }, []);

  const loadMetrics = useCallback((period: MetricsPeriod) => {
    setLoadingMetrics(true);
    metricsService
      .get(period)
      .then((r) => setMetrics(r.data))
      .catch(() => setApiError('Erro ao carregar métricas.'))
      .finally(() => setLoadingMetrics(false));
  }, []);

  // Mount-only initial fetch. Não chama fetchUsers/fetchBans para evitar o
  // setLoadingX(true) síncrono dentro do effect — o estado inicial já é true.
  useEffect(() => {
    let cancelled = false;

    moderationService
      .listUsers()
      .then((r) => {
        if (!cancelled) setUsers(r.data.results);
      })
      .catch(() => {
        if (!cancelled) setApiError('Erro ao carregar usuários.');
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    // Bans (lista de banidos atuais) é admin-only no backend (IsAdminUser).
    // Editor não precisa ver — pula o fetch pra evitar 403 ruidoso no console.
    if (isAdmin) {
      moderationService
        .listBans()
        .then((r) => {
          if (!cancelled) setBans(r.data.results);
        })
        .catch(() => {
          if (!cancelled) setApiError('Erro ao carregar banimentos.');
        })
        .finally(() => {
          if (!cancelled) setLoadingBans(false);
        });
    } else {
      setLoadingBans(false);
    }

    moderationService
      .listBanRequests({ status: 'pending' })
      .then((r) => {
        if (!cancelled) setBanRequests(r.data.results);
      })
      .catch(() => {
        if (!cancelled) setApiError('Erro ao carregar solicitações.');
      })
      .finally(() => {
        if (!cancelled) setLoadingBanReqs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // ── Derived state ────────────────────────────────────────────────────────

  const bannedIds = new Set(bans.map((b) => b.user.id));
  const activeUsers = users.filter((u) => !bannedIds.has(u.id) && !u.is_banned);

  const filteredUsers = activeUsers.filter((u) =>
    `${u.full_name} ${u.email ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const filteredBans = bans.filter((b) =>
    `${b.user.full_name} ${b.user.email ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const stats = [
    { label: 'Total de usuários', value: users.length, icon: '👥' },
    { label: 'Usuários ativos', value: activeUsers.length, icon: '✅' },
    { label: 'Banidos', value: bans.length, icon: '🚫', highlight: true },
    // Dev + Admin contam juntos no card "Staff" (hierarquia interna), mas o badge
    // visual na coluna CARGO diferencia (🛠️ Dev vs 🛡️ Admin).
    {
      label: 'Staff (Dev + Admin)',
      value: users.filter((u) => u.role === 'admin' || u.role === 'dev').length,
      icon: '🛡️',
    },
  ];

  // ── Actions ──────────────────────────────────────────────────────────────

  async function confirmBan() {
    if (!banModal.user || !banModal.reason.trim()) return;
    setSubmitting(true);
    setApiError('');
    try {
      if (isAdmin) {
        // Admin bana direto
        await moderationService.ban({
          user_id: banModal.user.id,
          reason: banModal.reason.trim(),
          trigger_message: banModal.triggerMessage.trim(),
        });
        fetchBans();
      } else {
        // Redator: só consegue solicitar (admin aprova depois)
        await moderationService.createBanRequest({
          target_id: banModal.user.id,
          reason: banModal.reason.trim(),
          trigger_message: banModal.triggerMessage.trim(),
        });
        fetchBanRequests();
      }
      setBanModal({ open: false, user: null, reason: '', triggerMessage: '' });
      fetchUsers();
    } catch (err: unknown) {
      // extractApiError surfa detail global OU primeiro field-error
      // (user_id pra ban direto, target_id pra solicitação, etc.).
      setApiError(
        extractApiError(
          err,
          isAdmin ? 'Erro ao banir usuário.' : 'Erro ao enviar solicitação.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function decideBanRequest(
    req: ApiBanRequest,
    action: 'approve' | 'reject',
  ) {
    setSubmitting(true);
    setApiError('');
    try {
      await moderationService.decideBanRequest(req.id, { action });
      fetchBanRequests();
      if (action === 'approve') {
        fetchUsers();
        fetchBans();
      }
    } catch {
      setApiError('Erro ao decidir solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmUnban() {
    if (!unbanModal.ban) return;
    setSubmitting(true);
    try {
      await moderationService.unban(unbanModal.ban.id);
      setUnbanModal({ open: false, ban: null });
      fetchUsers();
      fetchBans();
    } catch {
      setApiError('Erro ao desbanir usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="admin">
      {/* ── Sidebar ── */}
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <img src={interpopLogo} alt="Interpop" className="admin__brand-img" />
          <span className="admin__brand-badge">Admin</span>
        </div>

        <nav className="admin__nav">
          <button
            className={`admin__nav-item ${tab === 'usuarios' ? 'admin__nav-item--active' : ''}`}
            onClick={() => setTab('usuarios')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Usuários
            <span className="admin__nav-badge">{activeUsers.length}</span>
          </button>

          <button
            className={`admin__nav-item ${tab === 'publicacoes' ? 'admin__nav-item--active' : ''}`}
            onClick={() => setTab('publicacoes')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                strokeLinejoin="round"
              />
              <polyline points="14 2 14 8 20 8" strokeLinejoin="round" />
              <line x1="8" y1="13" x2="16" y2="13" strokeLinecap="round" />
              <line x1="8" y1="17" x2="13" y2="17" strokeLinecap="round" />
            </svg>
            Publicações
          </button>

          <button
            className={`admin__nav-item ${tab === 'banimentos' ? 'admin__nav-item--active' : ''}`}
            onClick={() => setTab('banimentos')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            Banimentos
            {bans.length > 0 && (
              <span className="admin__nav-badge admin__nav-badge--danger">
                {bans.length}
              </span>
            )}
          </button>

          {/* Métricas — admin only (endpoint backend IsAdminUser).
              Editor não vê o link nem consegue carregar (skip fetch). */}
          {isAdmin && (
            <button
              className={`admin__nav-item ${tab === 'metricas' ? 'admin__nav-item--active' : ''}`}
              onClick={() => {
                setTab('metricas');
                loadMetrics(metricsPeriod);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="20" x2="18" y2="10" strokeLinecap="round" />
                <line x1="12" y1="20" x2="12" y2="4" strokeLinecap="round" />
                <line x1="6" y1="20" x2="6" y2="14" strokeLinecap="round" />
              </svg>
              Métricas
            </button>
          )}
        </nav>

        <div className="admin__sidebar-footer">
          <div className="admin__current-user">
            <Avatar
              src={currentUser?.avatar ?? null}
              initial={currentUser?.avatar_initial ?? ''}
              className="admin__avatar"
            />
            <div>
              <p className="admin__user-name">{currentUser?.full_name}</p>
              <p className="admin__user-role">Administrador</p>
            </div>
          </div>
          <button className="admin__back-link" onClick={() => navigate('/')}>
            ← Voltar ao site
          </button>
          <button
            className="admin__back-link admin__back-link--danger"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin__main">
        {/* Header */}
        <div className="admin__header">
          <div>
            <h1>Painel Administrativo</h1>
            <p>Gerencie usuários, banimentos e publicações da plataforma.</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/criar-publicacao')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nova publicação
          </Button>
        </div>

        {apiError && (
          <p className="admin__api-error" role="alert">
            {apiError}
          </p>
        )}

        {/* Stats — escondido em Métricas (duplicaria KPIs) e em Publicações
            (a aba tem seu próprio bloco de stats com semântica diferente). */}
        {tab !== 'metricas' && tab !== 'publicacoes' && (
          <div className="admin__stats">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`admin__stat-card ${s.highlight ? 'admin__stat-card--danger' : ''}`}
              >
                <span className="admin__stat-icon" aria-hidden="true">
                  {s.icon}
                </span>
                <div>
                  <p className="admin__stat-value">{s.value}</p>
                  <p className="admin__stat-label">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search — só nas abas de usuários/banimentos (Publicações e Métricas
            têm seus próprios filtros, com semântica diferente). */}
        {tab !== 'metricas' && tab !== 'publicacoes' && (
          <div className="admin__search">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              width="16"
              height="16"
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
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar usuário"
            />
          </div>
        )}

        {/* ── Tab: Usuários ── */}
        {tab === 'usuarios' && (
          <section className="admin__section" aria-labelledby="users-heading">
            <h2 id="users-heading">
              Usuários ativos
              <span>{filteredUsers.length}</span>
            </h2>

            {loadingUsers ? (
              <div className="admin__empty">Carregando…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin__empty">Nenhum usuário encontrado.</div>
            ) : (
              <div className="admin__table-wrapper">
                <table className="admin__table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Cargo</th>
                      <th>Membro desde</th>
                      <th>Publicações</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="admin__user-cell">
                            <Avatar
                              src={user.avatar}
                              initial={user.avatar_initial}
                              className="admin__avatar admin__avatar--sm"
                            />
                            <div>
                              <p className="admin__user-cell-name">
                                {user.full_name}
                              </p>
                              <p className="admin__user-cell-email">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`admin__role-badge admin__role-badge--${user.role}`}
                          >
                            {user.role === 'dev'
                              ? '🛠️ Dev'
                              : user.role === 'admin'
                                ? '🛡️ Admin'
                                : user.role === 'editor'
                                  ? '✍️ Redator'
                                  : '📖 Leitor'}
                          </span>
                        </td>
                        <td className="admin__cell-muted">
                          {new Date(user.date_joined).toLocaleDateString(
                            'pt-BR',
                          )}
                        </td>
                        <td className="admin__cell-muted">—</td>
                        <td>
                          {/* Dev e Admin são imunes a ban (defense-in-depth no backend) */}
                          {user.role !== 'admin' && user.role !== 'dev' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="admin__ban-btn"
                              onClick={() =>
                                setBanModal({
                                  open: true,
                                  user,
                                  reason: '',
                                  triggerMessage: '',
                                })
                              }
                            >
                              {isAdmin ? 'Banir' : 'Solicitar banimento'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Tab: Publicações ── */}
        {tab === 'publicacoes' && (
          <AdminPosts currentUser={currentUser} isAdmin={isAdmin} />
        )}

        {/* ── Tab: Banimentos ── */}
        {tab === 'banimentos' && (
          <section className="admin__section" aria-labelledby="bans-heading">
            <h2 id="bans-heading" className="admin__section-title">
              <span>Banimentos</span>
            </h2>

            {/* Sub-tabs — "Usuários banidos" só pra admin (endpoint /bans/
                é IsAdminUser). Editor vê só Solicitações. */}
            <div
              className="admin__subtabs"
              role="tablist"
              aria-label="Visão de banimentos"
            >
              {isAdmin && (
                <button
                  role="tab"
                  aria-selected={banTab === 'ativos'}
                  className={`admin__subtab ${banTab === 'ativos' ? 'admin__subtab--active' : ''}`}
                  onClick={() => setBanTab('ativos')}
                >
                  Usuários banidos
                  <span className="admin__subtab-count">
                    {filteredBans.length}
                  </span>
                </button>
              )}
              <button
                role="tab"
                aria-selected={banTab === 'solicitacoes'}
                className={`admin__subtab ${banTab === 'solicitacoes' ? 'admin__subtab--active' : ''}`}
                onClick={() => setBanTab('solicitacoes')}
              >
                Solicitações de banimento
                <span className="admin__subtab-count">
                  {banRequests.length}
                </span>
              </button>
            </div>

            {banTab === 'solicitacoes' &&
              (loadingBanReqs ? (
                <div className="admin__empty">Carregando…</div>
              ) : banRequests.length === 0 ? (
                <div className="admin__empty">
                  <p style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
                    Nenhuma solicitação pendente
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--clr-muted)',
                    }}
                  >
                    Redatores podem solicitar banimentos de usuários — aparecem
                    aqui para sua aprovação.
                  </p>
                </div>
              ) : (
                <div className="admin__bans-list">
                  {banRequests.map((r) => (
                    <div key={r.id} className="admin__ban-card">
                      <div className="admin__ban-card-header">
                        <div className="admin__user-cell">
                          <Avatar
                            src={r.target.avatar}
                            initial={r.target.avatar_initial}
                            className="admin__avatar admin__avatar--sm"
                          />
                          <div>
                            <p className="admin__user-cell-name">
                              {r.target.full_name}
                            </p>
                            <p className="admin__user-cell-email">
                              {r.target.email}
                            </p>
                          </div>
                        </div>
                        <div className="admin__ban-card-meta">
                          <p className="admin__cell-muted admin__cell-nowrap">
                            Solicitada em{' '}
                            {new Date(r.created_at).toLocaleString('pt-BR')}
                          </p>
                          <p className="admin__cell-muted">
                            por{' '}
                            <strong>{r.requested_by?.full_name ?? '—'}</strong>
                          </p>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => decideBanRequest(r, 'approve')}
                              disabled={submitting}
                            >
                              Aprovar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => decideBanRequest(r, 'reject')}
                              disabled={submitting}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="admin__ban-card-body">
                        <p className="admin__ban-label">
                          Motivo da solicitação
                        </p>
                        <p className="admin__reason">{r.reason}</p>

                        {r.trigger_message && (
                          <div className="admin__trigger-message" role="note">
                            <p className="admin__trigger-message-label">
                              <svg
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                width="14"
                                height="14"
                                aria-hidden="true"
                              >
                                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.5 4.5a.5.5 0 1 1 1 0v3a.5.5 0 0 1-1 0v-3zm.5 6a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
                              </svg>
                              Mensagem que originou
                            </p>
                            <blockquote className="admin__trigger-message-text">
                              {r.trigger_message}
                            </blockquote>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {banTab === 'ativos' &&
              (loadingBans ? (
                <div className="admin__empty">Carregando…</div>
              ) : filteredBans.length === 0 ? (
                <div className="admin__empty">Nenhum banimento registrado.</div>
              ) : (
                <div className="admin__bans-list">
                  {filteredBans.map((b) => (
                    <div key={b.id} className="admin__ban-card">
                      <div className="admin__ban-card-header">
                        <div className="admin__user-cell">
                          <Avatar
                            src={b.user.avatar}
                            initial={b.user.avatar_initial}
                            className="admin__avatar admin__avatar--sm admin__avatar--banned"
                          />
                          <div>
                            <p className="admin__user-cell-name">
                              {b.user.full_name}
                            </p>
                            <p className="admin__user-cell-email">
                              {b.user.email}
                            </p>
                          </div>
                        </div>
                        <div className="admin__ban-card-meta">
                          <p className="admin__cell-muted admin__cell-nowrap">
                            Banido em{' '}
                            {new Date(b.created_at).toLocaleString('pt-BR')}
                          </p>
                          <p className="admin__cell-muted">
                            por <strong>{b.banned_by.full_name}</strong>
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="admin__unban-btn"
                          onClick={() => setUnbanModal({ open: true, ban: b })}
                        >
                          Desbanir
                        </Button>
                      </div>

                      <div className="admin__ban-card-body">
                        <p className="admin__ban-label">Motivo do banimento</p>
                        <p className="admin__reason">{b.reason}</p>

                        {b.trigger_message && (
                          <div className="admin__trigger-message" role="note">
                            <p className="admin__trigger-message-label">
                              <svg
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                width="14"
                                height="14"
                                aria-hidden="true"
                              >
                                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.5 4.5a.5.5 0 1 1 1 0v3a.5.5 0 0 1-1 0v-3zm.5 6a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
                              </svg>
                              Mensagem que originou o banimento
                            </p>
                            <blockquote className="admin__trigger-message-text">
                              {b.trigger_message}
                            </blockquote>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </section>
        )}

        {/* ── Tab: Métricas ── */}
        {tab === 'metricas' && (
          <section className="metrics" aria-labelledby="metrics-heading">
            <div className="metrics__topbar">
              <div>
                <h2 id="metrics-heading" className="metrics__title">
                  Métricas
                </h2>
                <p className="metrics__subtitle">
                  Visão geral de leitores, engajamento e performance editorial.
                </p>
              </div>

              <div className="metrics__controls">
                {/* View toggle — Simples (cards) vs Dashboard (charts) */}
                <div
                  className="metrics__view-toggle"
                  role="group"
                  aria-label="Modo de visualização"
                >
                  <button
                    type="button"
                    className={`metrics__view-btn ${metricsView === 'simples' ? 'metrics__view-btn--active' : ''}`}
                    aria-pressed={metricsView === 'simples'}
                    onClick={() => setMetricsView('simples')}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <rect x="1.5" y="1.5" width="6" height="6" rx="1" />
                      <rect x="8.5" y="1.5" width="6" height="6" rx="1" />
                      <rect x="1.5" y="8.5" width="6" height="6" rx="1" />
                      <rect x="8.5" y="8.5" width="6" height="6" rx="1" />
                    </svg>
                    Simples
                  </button>
                  <button
                    type="button"
                    className={`metrics__view-btn ${metricsView === 'dashboard' ? 'metrics__view-btn--active' : ''}`}
                    aria-pressed={metricsView === 'dashboard'}
                    onClick={() => setMetricsView('dashboard')}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 13l3-4 3 2 5-7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="2" cy="13" r="0.8" fill="currentColor" />
                      <circle cx="5" cy="9" r="0.8" fill="currentColor" />
                      <circle cx="8" cy="11" r="0.8" fill="currentColor" />
                      <circle cx="13" cy="4" r="0.8" fill="currentColor" />
                    </svg>
                    Dashboard
                  </button>
                </div>

                {/* Linear/Vercel-style segmented period switcher */}
                <div
                  className="metrics__period"
                  role="group"
                  aria-label="Selecionar período"
                >
                  {PERIOD_LABELS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`metrics__period-btn ${metricsPeriod === key ? 'metrics__period-btn--active' : ''}`}
                      aria-pressed={metricsPeriod === key}
                      onClick={() => {
                        setMetricsPeriod(key);
                        loadMetrics(key);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loadingMetrics && !metrics ? (
              <div className="metrics__skeleton-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="metrics__skeleton-card" />
                ))}
              </div>
            ) : metrics ? (
              <>
                {/* Hero KPIs — sempre no topo dos dois modos de visualização.
                    Padrão `referencias_dashboards` em AGENTS.md (Klipfolio):
                    "agregados monetários/percentuais no topo, detalhamentos
                    gráficos logo abaixo". Cada card exibe valor atual, delta
                    vs. período anterior idêntico e contexto em uma linha. */}
                <p className="metrics__section-eyebrow">
                  Visão geral · {periodLabel(metrics.period).toLowerCase()}
                </p>

                <div className="metrics__hero-grid">
                  <HeroKpi
                    label="Assinantes (newsletter)"
                    value={metrics.totals.subscribers}
                    delta={
                      metrics.period_stats.new_subscribers -
                      metrics.previous_period_stats.new_subscribers
                    }
                    deltaSuffix="vs. período anterior"
                  />
                  <HeroKpi
                    label="Visualizações"
                    value={metrics.totals.views}
                    delta={null}
                    deltaSuffix="total acumulado"
                  />
                  <HeroKpi
                    label="Usuários ativos"
                    value={metrics.period_stats.active_users}
                    delta={
                      metrics.period_stats.active_users -
                      metrics.previous_period_stats.active_users
                    }
                    deltaSuffix="comentaram ou curtiram"
                  />
                  <HeroKpi
                    label="Engajamento"
                    value={
                      metrics.period_stats.new_comments +
                      metrics.period_stats.new_likes
                    }
                    delta={
                      metrics.period_stats.new_comments +
                      metrics.period_stats.new_likes -
                      (metrics.previous_period_stats.new_comments +
                        metrics.previous_period_stats.new_likes)
                    }
                    deltaSuffix="comentários + curtidas"
                  />
                </div>

                {metricsView === 'dashboard' ? (
                  <>
                    <p className="metrics__section-eyebrow">
                      Atividade e composição
                    </p>
                    <MetricsDashboard metrics={metrics} />
                  </>
                ) : (
                  <>
                    {/* Secondary grid — context numbers, lifetime + period mix */}
                    <p className="metrics__section-eyebrow">Detalhes</p>
                    <div className="metrics__secondary-grid">
                      <SmallStat
                        label="Usuários cadastrados (total)"
                        value={metrics.totals.users}
                      />
                      <SmallStat
                        label="Publicações (total)"
                        value={metrics.totals.articles}
                      />
                      <SmallStat
                        label="Comentários (total)"
                        value={metrics.totals.comments}
                      />
                      <SmallStat
                        label="Curtidas (total)"
                        value={metrics.totals.likes}
                      />
                      <SmallStat
                        label="Novos usuários no período"
                        value={metrics.period_stats.new_users}
                      />
                      <SmallStat
                        label="Novas publicações no período"
                        value={metrics.period_stats.new_articles}
                      />
                    </div>

                    {/* Per-article ranking with inline bar chart (Plausible/Posthog) */}
                    <p className="metrics__section-eyebrow">
                      Publicações por performance
                    </p>
                    {metrics.per_article.length === 0 ? (
                      <div className="metrics__empty">
                        <p className="metrics__empty-title">
                          Sem publicações ainda
                        </p>
                        <p className="metrics__empty-hint">
                          Crie sua primeira publicação para começar a coletar
                          métricas.
                        </p>
                      </div>
                    ) : (
                      <ArticleRanking articles={metrics.per_article} />
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="metrics__empty">Sem dados disponíveis.</div>
            )}
          </section>
        )}
      </div>

      {/* ── Modal: Banir ── */}
      <Modal
        open={banModal.open}
        onClose={() =>
          setBanModal({
            open: false,
            user: null,
            reason: '',
            triggerMessage: '',
          })
        }
        title={`${isAdmin ? 'Banir' : 'Solicitar banimento de'} ${banModal.user?.full_name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                setBanModal({
                  open: false,
                  user: null,
                  reason: '',
                  triggerMessage: '',
                })
              }
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmBan}
              disabled={!banModal.reason.trim() || submitting}
              className="admin__confirm-ban"
            >
              {submitting
                ? 'Processando…'
                : isAdmin
                  ? 'Confirmar banimento'
                  : 'Enviar solicitação'}
            </Button>
          </>
        }
      >
        <div className="admin__ban-modal-body">
          <div className="admin__ban-modal-user">
            <Avatar
              src={banModal.user?.avatar ?? null}
              initial={banModal.user?.avatar_initial ?? ''}
              className="admin__avatar"
            />
            <div>
              <p className="admin__user-cell-name">
                {banModal.user?.full_name}
              </p>
              <p className="admin__user-cell-email">{banModal.user?.email}</p>
            </div>
          </div>

          <div className="input-field">
            <label htmlFor="ban-reason" className="input-label">
              Motivo do banimento <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="ban-reason"
              className="admin__ban-reason"
              placeholder="Descreva o motivo detalhadamente…"
              value={banModal.reason}
              onChange={(e) =>
                setBanModal((s) => ({ ...s, reason: e.target.value }))
              }
              rows={3}
              required
            />
          </div>

          <div className="input-field">
            <label htmlFor="ban-trigger" className="input-label">
              Mensagem que originou o banimento
              <span className="admin__label-optional"> (opcional)</span>
            </label>
            <textarea
              id="ban-trigger"
              className="admin__ban-reason admin__ban-trigger"
              placeholder="Cole aqui o comentário ou conteúdo ofensivo…"
              value={banModal.triggerMessage}
              onChange={(e) =>
                setBanModal((s) => ({ ...s, triggerMessage: e.target.value }))
              }
              rows={3}
            />
          </div>

          <p className="admin__ban-warning">
            ⚠️ O usuário perderá acesso imediato à plataforma. Esta ação pode
            ser revertida a qualquer momento.
          </p>
        </div>
      </Modal>

      {/* ── Modal: Desbanir ── */}
      <Modal
        open={unbanModal.open}
        onClose={() => setUnbanModal({ open: false, ban: null })}
        title="Confirmar desbanimento"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setUnbanModal({ open: false, ban: null })}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmUnban}
              disabled={submitting}
            >
              {submitting ? 'Processando…' : 'Desbanir usuário'}
            </Button>
          </>
        }
      >
        <div className="admin__ban-modal-body">
          <div className="admin__ban-modal-user">
            <Avatar
              src={unbanModal.ban?.user.avatar ?? null}
              initial={unbanModal.ban?.user.avatar_initial ?? ''}
              className="admin__avatar admin__avatar--banned"
            />
            <div>
              <p className="admin__user-cell-name">
                {unbanModal.ban?.user.full_name}
              </p>
              <p className="admin__user-cell-email">
                {unbanModal.ban?.user.email}
              </p>
            </div>
          </div>
          <p className="admin__unban-info">
            O usuário voltará a ter acesso completo à plataforma após o
            desbanimento.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function periodLabel(p: MetricsPeriod): string {
  switch (p) {
    case 'day':
      return 'Últimas 24h';
    case 'week':
      return 'Últimos 7 dias';
    case 'month':
      return 'Últimos 30 dias';
    case 'year':
      return 'Últimos 365 dias';
  }
}

// ── Metrics sub-components ─────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

interface HeroKpiProps {
  label: string;
  value: number;
  /** Difference vs previous identical window. `null` = not applicable. */
  delta: number | null;
  deltaSuffix: string;
}

/** Big-number KPI card (Linear/Vercel pattern). Shows current value +
 *  signed delta chip vs. previous identical window. */
function HeroKpi({ label, value, delta, deltaSuffix }: HeroKpiProps) {
  const direction =
    delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '·';

  return (
    <div className="metrics__hero-card">
      <p className="metrics__hero-label">{label}</p>
      <p className="metrics__hero-value">{formatNumber(value)}</p>
      <div className="metrics__hero-meta">
        {delta !== null ? (
          <span className={`metrics__delta metrics__delta--${direction}`}>
            <span aria-hidden="true">{arrow}</span>
            {delta > 0 ? '+' : ''}
            {formatNumber(delta)}
          </span>
        ) : (
          <span className="metrics__delta metrics__delta--neutral">—</span>
        )}
        <span className="metrics__hero-context">{deltaSuffix}</span>
      </div>
    </div>
  );
}

interface SmallStatProps {
  label: string;
  value: number;
}

function SmallStat({ label, value }: SmallStatProps) {
  return (
    <div className="metrics__small-card">
      <p className="metrics__small-value">{formatNumber(value)}</p>
      <p className="metrics__small-label">{label}</p>
    </div>
  );
}

interface ArticleRankingProps {
  articles: import('../../services/metricsService').PerArticleMetric[];
}

/** Article ranking table with inline bar chart (Posthog/Plausible).
 *  Each row's background gets a horizontal bar proportional to that
 *  article's view share relative to the top article — gives instant
 *  visual scale without needing a separate chart panel. */
function ArticleRanking({ articles }: ArticleRankingProps) {
  const maxViews = Math.max(...articles.map((a) => a.view_count), 1);

  return (
    <div className="metrics__ranking">
      <div className="metrics__ranking-head">
        <span>Publicação</span>
        <span className="metrics__ranking-col">Views</span>
        <span className="metrics__ranking-col">Coment.</span>
        <span className="metrics__ranking-col">Curtidas</span>
        <span className="metrics__ranking-col">Engaj.</span>
      </div>
      <ol className="metrics__ranking-list">
        {articles.map((a, i) => {
          const widthPct = Math.max(2, (a.view_count / maxViews) * 100);
          const engagementPct = (a.engagement_rate * 100).toFixed(1);
          return (
            <li key={a.slug} className="metrics__ranking-row">
              <div
                className="metrics__ranking-bar"
                style={{ width: `${widthPct}%` }}
                aria-hidden="true"
              />
              <div className="metrics__ranking-content">
                <div className="metrics__ranking-title-cell">
                  <span className="metrics__ranking-index">{i + 1}</span>
                  <div>
                    <p className="metrics__ranking-title">{a.title}</p>
                    {a.published_at && (
                      <p className="metrics__ranking-date">
                        {new Date(a.published_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.view_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.comment_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num">
                  {formatNumber(a.like_count)}
                </span>
                <span className="metrics__ranking-col metrics__ranking-num metrics__ranking-engagement">
                  {engagementPct}%
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
