import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { NavbarUserMenu } from './NavbarUserMenu';
import interpopLogo from '@/assets/interpop-logo.svg';
import './Navbar.css';

/**
 * Editorial-minimalist top nav (Option A from the ecossistemas_ui_ux audit).
 * The 5 categories live as filter chips inside /noticias and in the footer
 * Editorias column — surfacing them here too would be triple-redundant and
 * push the nav over Miller's Law (7±2).
 *
 * References: The Atlantic, Substack — minimal nav, content discovery
 * delegated to dedicated archive/explore pages.
 */
export function Navbar() {
  const navigate = useNavigate();
  const { currentUser, canPublish, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate('/login');
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'navbar__link navbar__link--active' : 'navbar__link';
  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'navbar__mobile-link navbar__mobile-link--active'
      : 'navbar__mobile-link';

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link
          to="/"
          className="navbar__logo"
          aria-label="Interpop — Página inicial"
        >
          {/* alt="" porque o <Link> pai já tem aria-label="Interpop — Página
              inicial". Imagem dentro de link com label deve ser decorativa pra
              leitor de tela não anunciar 2x. WAVE Redundant alt. */}
          <img src={interpopLogo} alt="" className="navbar__logo-img" />
        </Link>

        <nav className="navbar__nav" aria-label="Navegação principal">
          <NavLink to="/" end className={linkClass}>
            Início
          </NavLink>
          <NavLink to="/noticias" className={linkClass}>
            Notícias
          </NavLink>
          <NavLink to="/newsletter" className={linkClass}>
            Newsletter
          </NavLink>
          <NavLink to="/sobre" className={linkClass}>
            Sobre
          </NavLink>
          {canPublish && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive
                  ? 'navbar__link navbar__link--admin navbar__link--active'
                  : 'navbar__link navbar__link--admin'
              }
            >
              Painel Admin
            </NavLink>
          )}
        </nav>

        <div className="navbar__actions">
          {currentUser ? (
            <NavbarUserMenu />
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
              >
                Entrar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/cadastro')}
              >
                Criar conta
              </Button>
            </>
          )}
        </div>

        <button
          className="navbar__burger"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="navbar__mobile" role="dialog" aria-label="Menu mobile">
          <NavLink
            to="/"
            end
            onClick={() => setMenuOpen(false)}
            className={mobileLinkClass}
          >
            Início
          </NavLink>
          <NavLink
            to="/noticias"
            onClick={() => setMenuOpen(false)}
            className={mobileLinkClass}
          >
            Notícias
          </NavLink>
          <NavLink
            to="/newsletter"
            onClick={() => setMenuOpen(false)}
            className={mobileLinkClass}
          >
            Newsletter
          </NavLink>
          <NavLink
            to="/sobre"
            onClick={() => setMenuOpen(false)}
            className={mobileLinkClass}
          >
            Sobre
          </NavLink>
          {canPublish && (
            <NavLink
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="navbar__mobile-link navbar__mobile-link--admin"
            >
              Painel Admin
            </NavLink>
          )}
          <div className="navbar__mobile-actions">
            {currentUser ? (
              <Button variant="outline" fullWidth onClick={handleLogout}>
                Sair ({currentUser.first_name})
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    navigate('/login');
                    setMenuOpen(false);
                  }}
                >
                  Entrar
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    navigate('/cadastro');
                    setMenuOpen(false);
                  }}
                >
                  Criar conta
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
