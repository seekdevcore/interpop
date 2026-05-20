/**
 * Barra de compartilhamento social do artigo. Quatro destinos fixos:
 * Twitter/X, LinkedIn, WhatsApp e copiar-link. Cada ícone é SVG inline
 * com `fill="currentColor"` para herdar a cor do botão (hover gratuito).
 *
 * Extraído de Article.tsx (Batch E) para isolar a lista de targets e o
 * handleShare — Article.tsx fica focado em layout/dados, não em
 * particularidades de cada rede social.
 */
import type { ReactNode } from 'react';

interface ShareTarget {
  key: string;
  label: string;
  icon: ReactNode;
}

const SHARE_TARGETS: readonly ShareTarget[] = [
  {
    key: 'Twitter/X',
    label: 'Twitter/X',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: 'LinkedIn',
    label: 'LinkedIn',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
      </svg>
    ),
  },
  {
    key: 'WhatsApp',
    label: 'WhatsApp',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.157 5.335 5.493 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26L3.673 18.78l1.984-.595zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
      </svg>
    ),
  },
  {
    key: 'Copiar link',
    label: 'Copiar link',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
] as const;

interface ArticleShareBarProps {
  title: string;
}

export function ArticleShareBar({ title }: ArticleShareBarProps) {
  const handleShare = (platform: string) => {
    const url = window.location.href;
    const urls: Record<string, string> = {
      'Twitter/X': `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      WhatsApp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    };
    if (platform === 'Copiar link') {
      navigator.clipboard.writeText(url).catch(() => {});
      return;
    }
    if (urls[platform]) window.open(urls[platform], '_blank', 'noopener');
  };

  return (
    <div className="article-share" aria-label="Compartilhar artigo">
      <span>Compartilhar:</span>
      {SHARE_TARGETS.map(({ key, label, icon }) => (
        <button
          key={key}
          className="article-share__btn"
          onClick={() => handleShare(key)}
          aria-label={`Compartilhar no ${label}`}
        >
          <span className="article-share__icon" aria-hidden="true">
            {icon}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
