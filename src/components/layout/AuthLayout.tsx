import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DevelopedBy } from '../ui/DevelopedBy';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LegalContent } from '@/pages/Legal/LegalContent';
import { AboutContent } from '@/pages/About/AboutContent';
import interpopLogo from '@/assets/interpop-logo.svg';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: ReactNode;
  heading: string;
  subheading: string;
}

/** Qual painel está aberto no footer de auth — `null` = todos fechados. */
type AuthDoc = null | 'sobre' | 'privacidade' | 'termos';

export function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  // Modal trigger state — abre Sobre/Privacidade/Termos *inline* sem fazer
  // o usuário sair da tela de login/cadastro (perderia os dados do form).
  const [openDoc, setOpenDoc] = useState<AuthDoc>(null);
  const close = () => setOpenDoc(null);

  return (
    <div className="auth-layout">
      {/* Brand panel */}
      <div className="auth-layout__brand" aria-hidden="true">
        <div className="auth-layout__brand-inner">
          <Link
            to="/"
            className="auth-layout__logo"
            aria-label="Interpop — início"
          >
            <img src={interpopLogo} alt="Interpop" />
          </Link>
          <blockquote className="auth-layout__tagline">
            "O mundo acontece aqui."
          </blockquote>
          <div className="auth-layout__brand-bottom">
            <div className="auth-layout__dots">
              <span />
              <span />
              <span />
            </div>
            <DevelopedBy />
          </div>
        </div>
        <div className="auth-layout__brand-overlay" />
        <img
          src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900&q=75"
          alt=""
          loading="lazy"
          decoding="async"
          className="auth-layout__brand-img"
        />
      </div>

      {/* Form panel */}
      <div className="auth-layout__form-panel">
        <div className="auth-layout__form-wrapper">
          <Link to="/" className="auth-layout__back">
            ← Voltar ao início
          </Link>
          <div className="auth-layout__header">
            <h1>{heading}</h1>
            <p>{subheading}</p>
          </div>
          {children}
        </div>

        <footer className="auth-layout__footer">
          {/* Footer triggers → abrem modais inline em vez de navegar (evita
              perder os dados do formulário de login/cadastro). */}
          <button
            type="button"
            className="auth-layout__footer-btn"
            onClick={() => setOpenDoc('sobre')}
          >
            Sobre
          </button>
          <button
            type="button"
            className="auth-layout__footer-btn"
            onClick={() => setOpenDoc('privacidade')}
          >
            Privacidade
          </button>
          <button
            type="button"
            className="auth-layout__footer-btn"
            onClick={() => setOpenDoc('termos')}
          >
            Termos
          </button>
          <span>© {new Date().getFullYear()} Interpop</span>
        </footer>
      </div>

      {/* ── Modais inline (Sobre / Privacidade / Termos) ── */}
      <Modal
        open={openDoc === 'sobre'}
        onClose={close}
        title="Sobre o Interpop"
        size="lg"
        footer={
          <Button variant="primary" onClick={close}>
            Fechar
          </Button>
        }
      >
        <AboutContent onNavigate={close} />
      </Modal>

      <Modal
        open={openDoc === 'privacidade'}
        onClose={close}
        title="Política de privacidade"
        size="lg"
        footer={
          <Button variant="primary" onClick={close}>
            Fechar
          </Button>
        }
      >
        <LegalContent type="privacidade" />
      </Modal>

      <Modal
        open={openDoc === 'termos'}
        onClose={close}
        title="Termos de uso"
        size="lg"
        footer={
          <Button variant="primary" onClick={close}>
            Fechar
          </Button>
        }
      >
        <LegalContent type="termos" />
      </Modal>
    </div>
  );
}
