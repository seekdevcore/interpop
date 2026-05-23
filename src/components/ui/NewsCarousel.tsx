import { useCallback, useEffect, useRef, useState } from 'react';
import { NewsCard } from './NewsCard';
import type { ApiArticle } from '@/services/articleService';
import './NewsCarousel.css';

interface NewsCarouselProps {
  articles: ApiArticle[];
  /** Auto-rotate interval in ms. Default 5000. */
  autoRotateMs?: number;
  /** Aria label for the carousel region. */
  label?: string;
}

/**
 * Editorial news carousel — auto-rotating with WCAG 2.2 compliance.
 *
 * Design references (ecossistemas_ui_ux):
 *   - Native scroll-snap (HIG, Material): browser handles snapping/momentum,
 *     keyboard arrows just work, screen readers narrate scroll position.
 *   - Auto-rotate (default 5s) with pause-on-hover, pause-on-focus, pause
 *     button (WCAG 2.2.2 mandatory for >5s moving content).
 *   - Honors prefers-reduced-motion: no auto-rotate (WCAG 2.3.3).
 *   - Arrow buttons advance by 1 card (NYT pattern, not full-viewport).
 *   - Indicator dots show position without claiming false precision.
 *
 * IMPLEMENTAÇÃO — anti stale-closure:
 *   Toda a lógica de "qual slide está visível agora" lê DIRETO do DOM
 *   (`track.scrollLeft` + posição dos children). NÃO depende do `activeIndex`
 *   useState, que pode atrasar em rajadas de clique ou ficar fora de sync
 *   com o scroll real. `activeIndex` só serve pra acender o indicator dot.
 *   Resultado: setas não travam, auto-rotate não reseta a cada mudança de
 *   slide, e a fonte da verdade é sempre o scroll real.
 */
export function NewsCarousel({
  articles,
  autoRotateMs = 5000,
  label = 'Últimas notícias',
}: NewsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Número de "páginas únicas" do carrossel (= maxAlignable + 1). Com 9 slides
   *  e 3 visíveis por vez em desktop, isso é 7 — não 9. Mostrar 9 dots quando
   *  só 7 são alcançáveis é enganoso (Plausible/Posthog/Embla mostram páginas,
   *  não slides individuais). Recomputa em mount e resize. */
  const [numDots, setNumDots] = useState(articles.length);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const shouldAutoRotate = isPlaying && !isHovered && !prefersReducedMotion;

  /** Encontra o slide cuja BORDA ESQUERDA está mais perto do `scrollLeft`.
   *  Casa com `scroll-snap-align: start` — quando o browser snapa em slide N,
   *  `scrollLeft ≈ slide_N.offsetLeft`. Usar o centro do viewport (versão
   *  anterior deste código) detectava o slide ERRADO e travava o carrossel. */
  const findClosestSlide = useCallback((): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const slides = Array.from(track.children) as HTMLElement[];
    const scrollLeft = track.scrollLeft;
    let closest = 0;
    let best = Infinity;
    slides.forEach((s, i) => {
      const dist = Math.abs(s.offsetLeft - scrollLeft);
      if (dist < best) {
        best = dist;
        closest = i;
      }
    });
    return closest;
  }, []);

  /** Maior índice que o browser CONSEGUE alinhar à esquerda do viewport.
   *  Slides além disso (offsetLeft > maxScroll) nunca conseguem ser
   *  "snap-start" — `scrollTo` clampeia silenciosamente. Wrappar para 0
   *  quando ultrapassar é a única forma de manter rotação infinita. */
  const findMaxAlignableIndex = useCallback((): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const slides = Array.from(track.children) as HTMLElement[];
    const maxScroll = track.scrollWidth - track.clientWidth;
    let max = 0;
    for (let i = slides.length - 1; i >= 0; i--) {
      if (slides[i].offsetLeft <= maxScroll + 1) {
        max = i;
        break;
      }
    }
    return max;
  }, []);

  /** Scroll programático para um índice específico (clamped to alignable). */
  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const slides = Array.from(track.children) as HTMLElement[];
      const maxAlignable = findMaxAlignableIndex();
      const clamped = Math.min(Math.max(index, 0), maxAlignable);
      const slide = slides[clamped];
      if (!slide) return;
      track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    },
    [findMaxAlignableIndex],
  );

  /** Avança N posições a partir do scroll atual. Wrap acontece nos LIMITES
   *  ALINHÁVEIS, não no `articles.length` — slides "não alinháveis" no fim
   *  causariam scrollTo silenciosamente clampeado (trava). */
  const advance = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;
      const current = findClosestSlide();
      const maxAlignable = findMaxAlignableIndex();
      let next = current + direction;
      if (next > maxAlignable) next = 0;
      if (next < 0) next = maxAlignable;
      const slide = track.children[next] as HTMLElement | undefined;
      if (!slide) return;
      track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    },
    [findClosestSlide, findMaxAlignableIndex],
  );

  // ── Auto-rotação ────────────────────────────────────────────────────
  // CRITICO: este effect NÃO depende de `activeIndex`. Se dependesse,
  // o interval seria resetado a cada slide (autorotate nunca dispararia).
  useEffect(() => {
    if (!shouldAutoRotate || articles.length <= 1) return;
    const id = window.setInterval(() => advance(1), autoRotateMs);
    return () => window.clearInterval(id);
  }, [shouldAutoRotate, autoRotateMs, articles.length, advance]);

  // ── Sync do indicador (dots) com a posição real do scroll ──────────
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setActiveIndex(findClosestSlide());
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    // Sync inicial
    setActiveIndex(findClosestSlide());
    return () => {
      track.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [findClosestSlide]);

  // ── Atualiza numDots em mount + resize ─────────────────────────────
  // Pages = maxAlignable + 1. Em desktop (3 slides visíveis, 9 totais)
  // → 7 dots. Em tablet (2 visíveis) → 8. Em mobile (1 visível) → 9.
  useEffect(() => {
    const update = () => setNumDots(findMaxAlignableIndex() + 1);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [findMaxAlignableIndex, articles.length]);

  if (articles.length === 0) return null;

  return (
    <section
      className="news-carousel"
      aria-label={label}
      aria-roledescription="carrossel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      /* onFocus/onBlur removidos intencionalmente: bubbling de foco dos
       * botões internos (setas/dots/play) deixava `isHovered=true` grudado
       * depois do primeiro clique, cancelando o auto-rotate permanentemente.
       * WCAG 2.2.2 exige UM mecanismo de pause — o botão de pause dedicado
       * já satisfaz. */
    >
      <div
        ref={trackRef}
        className="news-carousel__track"
        tabIndex={0}
        aria-live={isPlaying ? 'off' : 'polite'}
      >
        {articles.map((article, i) => (
          <div
            key={article.id}
            className="news-carousel__slide"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${articles.length}: ${article.title}`}
          >
            <NewsCard article={article} />
          </div>
        ))}
      </div>

      {/* Controles — visíveis sempre (WCAG 2.2.2). */}
      <div className="news-carousel__controls">
        <button
          type="button"
          className="news-carousel__btn news-carousel__btn--play"
          onClick={() => setIsPlaying((p) => !p)}
          aria-label={
            isPlaying
              ? 'Pausar rotação automática'
              : 'Retomar rotação automática'
          }
          aria-pressed={!isPlaying}
        >
          {isPlaying ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect
                x="3.5"
                y="2.5"
                width="3"
                height="11"
                fill="currentColor"
                rx="0.5"
              />
              <rect
                x="9.5"
                y="2.5"
                width="3"
                height="11"
                fill="currentColor"
                rx="0.5"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div
          className="news-carousel__dots"
          role="tablist"
          aria-label="Selecionar slide"
        >
          {/* numDots = páginas únicas alcançáveis (maxAlignable + 1), não
              total de slides — Plausible/Posthog/Embla pattern. */}
          {Array.from({ length: numDots }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Ir para página ${i + 1} de ${numDots}`}
              className={`news-carousel__dot ${i === activeIndex ? 'news-carousel__dot--active' : ''}`}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>

        <div className="news-carousel__arrows">
          <button
            type="button"
            className="news-carousel__btn news-carousel__btn--arrow"
            onClick={() => advance(-1)}
            aria-label="Slide anterior"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M10 2L4 8l6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="news-carousel__btn news-carousel__btn--arrow"
            onClick={() => advance(1)}
            aria-label="Próximo slide"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M6 2l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
