/**
 * Listas de handlers MSW usadas por `browser.ts` (e pelos testes).
 *
 * - `handlers` (dev local, `npm run dev`): só a busca. O resto vai para o
 *   Django local de verdade.
 * - `demoHandlers` (site demo, `--mode demo`): a API inteira, sobre o banco
 *   em memória de `src/mocks/demo/db.ts`. Nenhum request vai para servidor.
 *
 * Recurso novo = um `*Handlers` no arquivo do recurso + entrada aqui.
 */
import { articleHandlers } from './articles';
import { authHandlers } from './auth';
import { commentHandlers } from './comments';
import { metricsHandlers } from './metrics';
import { moderationHandlers } from './moderation';
import { newsletterHandlers } from './newsletter';
import { searchHandlers } from './search';

export const handlers = [...searchHandlers];

export const demoHandlers = [
  ...authHandlers,
  ...articleHandlers,
  ...commentHandlers,
  ...moderationHandlers,
  ...newsletterHandlers,
  ...metricsHandlers,
  ...searchHandlers,
];
