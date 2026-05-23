/**
 * Setup global do Vitest — roda antes de cada arquivo de teste.
 *
 * - Carrega matchers do jest-dom (`toBeInTheDocument`, `toHaveAttribute`, etc.).
 * - Limpa o DOM e timers entre testes (evita vazamento de state).
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
