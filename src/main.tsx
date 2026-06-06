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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
