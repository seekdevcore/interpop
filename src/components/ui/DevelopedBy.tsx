import seekLogo from '@/assets/seek-white.svg';
import './DevelopedBy.css';

interface DevelopedByProps {
  /** Optional href — when provided, renders as a link to the studio site. */
  href?: string;
}

/**
 * Credit line "Desenvolvido por [Seek]" — used on dark surfaces only
 * (main footer, auth brand panel). Both surfaces are dark navy, so a single
 * white SVG variant covers all cases.
 */
export function DevelopedBy({ href }: DevelopedByProps) {
  const logo = (
    <img
      src={seekLogo}
      alt="Seek"
      width="44"
      height="20"
      className="developed-by__logo"
    />
  );

  return (
    <span className="developed-by">
      <span className="developed-by__label">Desenvolvido por</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="developed-by__link"
          aria-label="Seek — site externo"
        >
          {logo}
        </a>
      ) : (
        logo
      )}
    </span>
  );
}
