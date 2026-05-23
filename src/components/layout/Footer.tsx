import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { DevelopedBy } from '../ui/DevelopedBy';
import newsletterService from '@/services/newsletterService';
import interpopLogo from '@/assets/interpop-logo.svg';
import './Footer.css';

// Single contact mailbox for the project — kept in one place so it can be
// updated without hunting the codebase.
const CONTACT_EMAIL = 'interpop.cc@gmail.com';

type LinkSpec = {
  label: string;
  to: string;
  /** External link (mailto: or http) — rendered as plain <a>. */
  external?: boolean;
  /** Opcional: aria-label distinto do texto visível.
   *  Usado quando o mesmo destino aparece em outro lugar da página (ex.:
   *  Entrar/Criar conta também ficam no Navbar) — WAVE flagga como
   *  "Redundant link" se accessible name + href forem idênticos. */
  ariaLabel?: string;
};

const NAV_COLUMNS: { heading: string; links: LinkSpec[] }[] = [
  {
    heading: 'Editorias',
    links: [
      { label: 'Música', to: '/noticias?categoria=música' },
      { label: 'Moda', to: '/noticias?categoria=moda' },
      { label: 'Cinema', to: '/noticias?categoria=cinema' },
      { label: 'Literatura', to: '/noticias?categoria=literatura' },
      { label: 'Cultura Digital', to: '/noticias?categoria=cultura-digital' },
    ],
  },
  {
    heading: 'Interpop',
    links: [
      { label: 'Sobre nós', to: '/#sobre-o-projeto' },
      {
        label: 'Redação',
        to: `mailto:${CONTACT_EMAIL}?subject=Redação`,
        external: true,
      },
      {
        label: 'Anuncie',
        to: `mailto:${CONTACT_EMAIL}?subject=Publicidade`,
        external: true,
      },
      {
        label: 'Contato',
        to: `mailto:${CONTACT_EMAIL}?subject=Contato`,
        external: true,
      },
    ],
  },
  {
    heading: 'Conta',
    links: [
      { label: 'Entrar', to: '/login', ariaLabel: 'Entrar — link do rodapé' },
      {
        label: 'Criar conta',
        to: '/cadastro',
        ariaLabel: 'Criar conta — link do rodapé',
      },
      { label: 'Recuperar senha', to: '/recuperar-senha' },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const { data } = await newsletterService.subscribe(email.trim());
      setMessage(data.detail);
      setStatus('success');
      setEmail('');
    } catch {
      setMessage('Não foi possível realizar a inscrição. Tente novamente.');
      setStatus('error');
    }
  };

  return (
    <footer className="footer">
      <div className="footer__top container">
        <div className="footer__newsletter">
          <h3>Fique por dentro</h3>
          <p>As melhores histórias do mundo, direto na sua caixa de entrada.</p>

          {status === 'success' ? (
            <p className="footer__newsletter-success" role="status">
              {message}
            </p>
          ) : (
            <form
              className="footer__newsletter-form"
              onSubmit={handleSubscribe}
              noValidate
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                aria-label="Endereço de e-mail para newsletter"
                required
                disabled={status === 'loading'}
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Inscrevendo…' : 'Inscrever'}
              </Button>
            </form>
          )}

          {status === 'error' && (
            <p className="footer__newsletter-error" role="alert">
              {message}
            </p>
          )}
        </div>

        <nav className="footer__links" aria-label="Links do rodapé">
          {NAV_COLUMNS.map((col) => (
            <div key={col.heading} className="footer__col">
              <h4>{col.heading}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.to} aria-label={l.ariaLabel}>
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.to} aria-label={l.ariaLabel}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="footer__bottom container">
        <Link
          to="/"
          className="footer__logo"
          aria-label="Interpop — voltar ao início"
        >
          {/* alt="" porque o <Link> pai já tem aria-label. WAVE Redundant alt. */}
          <img src={interpopLogo} alt="" />
        </Link>
        <p className="footer__copy">
          © {new Date().getFullYear()} Interpop. Todos os direitos reservados.
        </p>
        <div className="footer__bottom-right">
          <div className="footer__legal">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/termos">Termos de uso</Link>
          </div>
          <DevelopedBy />
        </div>
      </div>
    </footer>
  );
}
