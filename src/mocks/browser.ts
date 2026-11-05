/**
 * Service Worker do MSW no navegador.
 *
 * - `npm run dev`: só a busca é mockada (`handlers`); `?msw=off` desliga.
 * - `--mode demo` (site do Render para o design): a API inteira
 *   (`demoHandlers`), sem backend.
 * - Build de produção: este arquivo nem entra no bundle (main.tsx só o
 *   importa em DEV ou demo; `scripts/check-msw-bundle.mjs` confere no CI).
 *
 * `public/mockServiceWorker.js` vem de `npx msw init public/ --save`.
 */
import { setupWorker } from 'msw/browser';
import { demoHandlers, handlers } from './handlers';

export const worker = setupWorker(
  ...(import.meta.env.MODE === 'demo' ? demoHandlers : handlers),
);
