import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  // E3: alias @/ → src/ — espelha tsconfig paths para resolver em runtime.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    // D11 / P7: bundle visualizer — gera dist/bundle-stats.html (gitignored)
    // só em `npm run build`. Útil pra inspecionar inchaço (Recharts, etc.)
    // e validar code-split (/admin lazy). Não roda em dev (sem overhead).
    visualizer({
      filename: 'dist/bundle-stats.html',
      template: 'treemap', // alternativas: 'sunburst', 'network', 'raw-data'
      gzipSize: true,
      brotliSize: true,
      open: false, // não abre browser automático — pesquisador abre manual
    }),
  ],
});
