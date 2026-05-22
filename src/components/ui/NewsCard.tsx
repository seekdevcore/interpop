import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { categoryVariant } from '../../utils/categoryVariant';
import { formatDateShort } from '../../utils/formatDate';
import type { ApiArticle } from '../../services/articleService';
import './NewsCard.css';

interface NewsCardProps {
  article: ApiArticle;
  variant?: 'default' | 'featured' | 'compact';
}

export function NewsCard({ article, variant = 'default' }: NewsCardProps) {
  const PLACEHOLDER =
    'https://placehold.co/800x450/1a1a1a/ffffff?text=Interpop';
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
        <img src={article.cover_image ?? PLACEHOLDER} alt="" loading="lazy" />
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
