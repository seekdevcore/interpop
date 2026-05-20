import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Global scroll behaviour for client-side navigation.
 *
 * React Router 7's <BrowserRouter> ships with NO automatic scroll
 * restoration, so a cross-route navigation will keep whatever scrollY the
 * previous page left behind. That breaks two flows:
 *
 *   1. Navigating from /noticia/<slug> to / leaves you scrolled deep down
 *      the home page instead of landing at the top.
 *   2. Anchor links like /#sobre-o-projeto don't scroll to the element
 *      because no full page load happens.
 *
 * Strategy:
 *   - No hash → window.scrollTo({top:0}).
 *   - With hash → find #id and scrollIntoView, but RE-RUN the scroll at
 *     several checkpoints after navigation (rAF, 80ms, 250ms, 600ms) so
 *     layout shifts from async data loading (article skeletons swapping
 *     for real cards, fonts loading, images filling boxes) can't leave
 *     the target visually offset.
 *   - Cross-page nav uses instant scroll (predictable, no race with
 *     subsequent re-layouts). Same-page hash change uses smooth.
 *   - prefers-reduced-motion is always honored — WCAG 2.3.3.
 *
 * Mount this once, inside <BrowserRouter>. It renders nothing.
 */
export function ScrollToHashOrTop() {
  const { pathname, hash, key } = useLocation();
  const prevPathnameRef = useRef<string>(pathname);

  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const samePage = prevPathname === pathname;
    prevPathnameRef.current = pathname;

    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Cross-page → instant; same-page hash → smooth (unless user opts out).
    const behavior: ScrollBehavior =
      prefersReduced || !samePage ? 'auto' : 'smooth';

    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    const timers: number[] = [];
    let cancelled = false;

    const scrollOnce = () => {
      if (cancelled) return;
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior, block: 'start' });
    };

    // First attempt: next frame, after the new route has rendered.
    const raf = requestAnimationFrame(scrollOnce);
    // Defensive re-scrolls — absorb async layout shifts (article list
    // skeletons swapping in, hero font load, etc). Each one is a no-op
    // if the target is already pinned at the top.
    timers.push(window.setTimeout(scrollOnce, 80));
    timers.push(window.setTimeout(scrollOnce, 250));
    timers.push(window.setTimeout(scrollOnce, 600));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // `key` changes on every navigation so re-clicking the same link
    // re-triggers the effect.
  }, [pathname, hash, key]);

  return null;
}
