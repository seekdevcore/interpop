/**
 * Monta o painel demo numa raiz React própria, fora do <App>: não depende
 * do router nem dos providers e não altera a árvore que o design avalia.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { demoDb } from '@/mocks/demo/db';
import { DemoPanel } from './DemoPanel';

export function mountDemoPanel() {
  const host = document.createElement('div');
  host.id = 'demo-panel-root';
  document.body.appendChild(host);
  createRoot(host).render(
    <StrictMode>
      <DemoPanel db={demoDb} />
    </StrictMode>,
  );
}
