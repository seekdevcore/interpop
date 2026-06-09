/**
 * Re-export central dos handlers MSW para `setupWorker` em `browser.ts`.
 * Mantém a lista de handlers em um único lugar — adicionar novo recurso
 * = adicionar um novo `*Handlers` aqui.
 */
import { searchHandlers } from './search';

export const handlers = [...searchHandlers];
