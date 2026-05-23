import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { categoryVariant } from '@/utils/categoryVariant';
import { formatDateShort } from '@/utils/formatDate';
import type { ApiArticle } from '@/services/articleService';
import './NewsCard.css';

interface NewsCardProps {
  article: ApiArticle;
  variant?: 'default' | 'featured' | 'compact';
}

// P3: placeholder SVG inline (data URI) substitui dependência externa
// `placehold.co` — elimina request third-party + indisponibilidade do serviço.
// Atributos width/height match com aspect-ratio 16:9 do container (P2 anti-CLS).
const PLACEHOLDER_SVG =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">' +
      '<rect width="800" height="450" fill="#1a1a1a"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" ' +
      'fill="#ffffff" font-family="serif" font-size="48" font-weight="700">Interpop</text>' +
      '</svg>',
  );

export function NewsCard({ article, variant = 'default' }: NewsCardProps) {
  const catVariant = categoryVariant(
    article.category?.slug ?? article.category?.name,
  );

  return (
    <Link
      to={`/noticia/${article.slug}`}
      className={`news-card news-card--${variant}`}
      data-category={catVariant}
      aria-label={article.title}
    >
      <div className="news-card__image">
        <img
          src={article.cover_image ?? PLACEHOLDER_SVG}
          alt=""
          loading="lazy"
          width={800}
          height={450}
        />
        {article.category && (
          <Badge category={catVariant}>{article.category.name}</Badge>
        )}
      </div>
      <div className="news-card__body">
        <h3 className="news-card__title">{article.title}</h3>
        {variant !== 'compact' && (
          <p className="news-card__excerpt">{article.excerpt}</p>
        )}
        <div className="news-card__meta">
          <div className="news-card__author">
            <Avatar
              src={article.author.avatar}
              initial={article.author.avatar_initial}
              className="news-card__avatar"
            />
            <span>{article.author.full_name}</span>
          </div>
          <div className="news-card__info">
            <span>{formatDateShort(article.published_at)}</span>
            {article.comment_count > 0 && (
              <>
                <span>·</span>
                <span>
                  {article.comment_count} comentário
                  {article.comment_count !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
