import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// E7 / A42 do reorganization-proposal. Vitest setup canônico:
// - jsdom para hooks/components que tocam DOM
// - alias @/ espelhado de vite.config.ts (single source of truth do path)
// - setupFiles carrega @testing-library/jest-dom matchers
// - globals: false → import { describe, it, expect } from 'vitest' explícito
//   (mais legível em CI e evita poluir typings)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Frontend ainda em baseline — começa em 30%, sobe gradual conforme
      // política §6.2 do AGENTS.md (subindo 10pp/sprint até 80%).
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
      exclude: [
        'node_modules/',
        'dist/',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.css',
        'src/test/**',
      ],
    },
  },
});
