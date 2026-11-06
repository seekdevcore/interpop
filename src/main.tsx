import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/global.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import {
  SEARCH_STALE_TIME,
  SEARCH_GC_TIME,
} from './pages/Buscar/services/searchService.ts';

// US30.1 — TanStack Query client.
// staleTime/gcTime importados de searchService (SSOT — fix H-02 do
// REVIEW-PHASE-3). refetchOnWindowFocus=false é deliberado: busca
// editorial não é "live", e refocus dispararia re-fetch sem benefício
// real, mordendo o rate limit de 30/min. retry=1 é overridable por hook
// (useSearch desativa retry em 4xx).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: SEARCH_STALE_TIME,
      gcTime: SEARCH_GC_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// MSW (T30.1.X12 / fix BLOQUEIO-1), três modos:
// - DEV: só a busca é mockada (o Django local não liga a busca);
//   `?msw=off` desliga o worker.
// - demo (`--mode demo`, site do Render): a API /api/v1/* inteira é
//   mockada no navegador, mais o painel "Entrar como / Resetar dados".
// - produção: `DEV` e `MODE` viram constantes no build, o ramo inteiro é
//   código morto e o tree-shaking tira `msw` do bundle (o CI confere com
//   scripts/check-msw-bundle.mjs).
const DEMO = import.meta.env.MODE === 'demo';

async function enableMocks() {
  if (!import.meta.env.DEV && !DEMO) return;
  if (!DEMO && new URLSearchParams(window.location.search).get('msw') === 'off')
    return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: DEMO,
  });
  if (DEMO) {
    const { mountDemoPanel } = await import('./mocks/demo/badge/mount');
    mountDemoPanel();
  }
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
