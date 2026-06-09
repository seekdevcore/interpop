/**
 * Service Worker MSW para dev local (fix BLOQUEIO-1 do REVIEW-PHASE-3).
 *
 * Estratégia:
 *   - Em PROD, este arquivo NÃO é importado (main.tsx faz dynamic import
 *     só sob `import.meta.env.DEV`).
 *   - Em DEV, o worker intercepta `fetch` em nível de browser — funciona
 *     com axios sem nenhuma config (axios usa `fetch` ou `XMLHttpRequest`,
 *     ambos passam pelo SW).
 *   - `onUnhandledRequest: 'bypass'` deixa requests não-mockados (HMR,
 *     fonts, etc.) passarem direto. Útil enquanto migramos endpoints
 *     gradualmente para mock.
 *
 * Pré-requisito de instalação: rodar `npx msw init public/ --save` UMA
 * vez para gerar `public/mockServiceWorker.js`. Documentado em
 * `src/pages/Buscar/README.md`.
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
