import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/global.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';

// US30.1 — TanStack Query client.
// staleTime 60s casa com `Cache-Control: max-age=60` do backend (ADR-023):
// enquanto o backend ainda considera fresco, TanStack não revalida.
// gcTime 5min é `stale-while-revalidate=300` no client (mantém payload
// em memória para back-forward instantâneo). refetchOnWindowFocus=false
// é deliberado: busca editorial não é "live", e refocus dispararia
// re-fetch sem benefício real, mordendo o rate limit de 30/min.
// retry=1 é overridable por hook (useSearch desativa retry em 4xx).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
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
