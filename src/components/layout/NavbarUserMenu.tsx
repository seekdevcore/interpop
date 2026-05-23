/**
 * Dropdown do usuário logado no Navbar.
 *
 * UX:
 *   - Hover ABRE em desktop (CSS via :hover no container).
 *   - Click no botão também abre/fecha (acessibilidade + mobile que não
 *     tem hover real).
 *   - Esc ou click fora fecha.
 *   - Foco volta para o trigger ao fechar (a11y).
 *
 * 3 itens: Meu Perfil · (se canPublish) Painel Admin · Sair.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '../ui/Avatar';

interface NavbarUserMenuProps {
  onAfterAction?: () => void;
}

export function NavbarUserMenu({ onAfterAction }: NavbarUserMenuProps = {}) {
  const navigate = useNavigate();
  const { currentUser, canPublish, isDev, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Click fora fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!currentUser) return null;

  async function handleLogout() {
    await logout();
    setOpen(false);
    onAfterAction?.();
    navigate('/login');
  }

  // Badge de role pequeno no dropdown header. Dev e Admin têm visual distinto;
  // editor/user ficam sem badge (visual mais limpo para leitor comum).
  const roleBadge = isDev
    ? { label: '🛠️ Dev', cls: 'navbar-menu__role-badge--dev' }
    : isAdmin
      ? { label: '🛡️ Admin', cls: 'navbar-menu__role-badge--admin' }
      : currentUser.role === 'editor'
        ? { label: '✍️ Redator', cls: 'navbar-menu__role-badge--editor' }
        : null;

  return (
    <div
      className={`navbar-menu ${open ? 'navbar-menu--open' : ''}`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        className="navbar-menu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu do usuário ${currentUser.first_name}`}
      >
        <Avatar
          src={currentUser.avatar}
          initial={currentUser.avatar_initial}
          className="navbar-menu__avatar"
        />
        <span className="navbar-menu__name">{currentUser.first_name}</span>
        <svg
          className="navbar-menu__chevron"
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden="true"
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="navbar-menu__dropdown" role="menu" aria-label="Menu">
        <div className="navbar-menu__header">
          <p className="navbar-menu__header-name">
            {currentUser.first_name} {currentUser.last_name}
          </p>
          {currentUser.email && (
            <p className="navbar-menu__header-email">{currentUser.email}</p>
          )}
          {roleBadge && (
            <span className={`navbar-menu__role-badge ${roleBadge.cls}`}>
              {roleBadge.label}
            </span>
          )}
        </div>

        <div className="navbar-menu__divider" />

        <Link
          to="/perfil"
          className="navbar-menu__item"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden="true">👤</span>
          Meu perfil
        </Link>

        {canPublish && (
          <Link
            to="/admin"
            className="navbar-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">🛡️</span>
            Painel administrativo
          </Link>
        )}

        <div className="navbar-menu__divider" />

        <button
          type="button"
          className="navbar-menu__item navbar-menu__item--danger"
          role="menuitem"
          onClick={handleLogout}
        >
          <span aria-hidden="true">↪</span>
          Sair
        </button>
      </div>
    </div>
  );
}
