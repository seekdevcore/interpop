/**
 * Card de um resultado de busca — thumb-LEFT 120×80 (ADR-030-UI).
 *
 * Por que thumb-left e não full-bleed (SECRP-04 §3.1):
 *   NYT, Folha, Substack reader, ZEIT — SERPs editoriais densas usam
 *   thumb-left para caber 8-10 cards no viewport. Full-bleed empurra
 *   tudo abaixo da dobra. Aqui o thumb é informacional (reconhecimento
 *   editoria) mas o título é o landmark — por isso `alt=""`.
 *
 * Anti-CLS (ADR-030-UI):
 *   - <img width="120" height="80"> declarados como atributos HTML;
 *     o browser reserva a caixa antes do download e a imagem entra sem
 *     pushar o título. Sem isso, o card "saltaria" 80px ao carregar.
 *   - O wrapper `.result-card__thumb` também tem `width: 120px` fixo
 *     para o caso sem cover (placeholder renderiza um <span>).
 *   - Mobile (<=640px): thumb encolhe para 80×60 via media query (CSS).
 *
 * Hierarquia ARIA:
 *   - Imagem é decorativa (`alt=""`) — o `<a>` do título já é o link
 *     anunciado pelo screen reader.
 *   - `<time datetime>` permite SR ler "vinte de maio de 2026".
 */
import { Link } from 'react-router-dom';
import type { SearchResultItem } from '../types';
import { formatDateShort } from '@/utils/formatDate';
import { HighlightedText } from './HighlightedText';

interface ResultCardProps {
  item: SearchResultItem;
  /** `query_terms_expanded` do payload — passado ao HighlightedText. */
  terms: string[] | undefined;
}

/** Letra inicial da editoria, ou '?' como último recurso. */
function placeholderLetter(item: SearchResultItem): string {
  const name = item.category?.name?.trim();
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export function ResultCard({ item, terms }: ResultCardProps) {
  const dateLabel = formatDateShort(item.published_at);

  return (
    <article
      className="result-card"
      // Fix H-04 do REVIEW-PHASE-3: data-variant no wrapper permite que CSS
      // colora tanto o placeholder do thumb quanto o badge `.result-card__category`
      // com o token editorial correspondente (--clr-cat-musica/moda/cinema/
      // literatura/cultura-digital). Default usa --clr-primary.
      data-variant={item.category?.slug ?? 'default'}
    >
      <div className="result-card__thumb">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            width={120}
            height={80}
            // Não usamos fetchpriority="low" porque o axe reclama, e o
            // browser já trata <img loading=lazy> abaixo da dobra com
            // baixa prioridade na prática.
          />
        ) : (
          <span
            data-testid="result-card-placeholder"
            className="result-card__placeholder"
            aria-hidden="true"
          >
            {placeholderLetter(item)}
          </span>
        )}
      </div>

      <div className="result-card__body">
        <h3 className="result-card__title">
          <Link to={`/noticia/${item.slug}`}>
            <HighlightedText text={item.title} terms={terms} />
          </Link>
        </h3>

        <p className="result-card__excerpt">
          <HighlightedText text={item.excerpt} terms={terms} />
        </p>

        <footer className="result-card__meta">
          <span className="result-card__author">{item.author.name}</span>
          {item.category && (
            <>
              <span aria-hidden="true">·</span>
              <span className="result-card__category">
                {item.category.name}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={item.published_at} className="result-card__date">
            {dateLabel}
          </time>
        </footer>
      </div>
    </article>
  );
}
