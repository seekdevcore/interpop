import { useDeferredValue } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import {
  fetchSearch,
  SEARCH_STALE_TIME,
  SEARCH_GC_TIME,
} from '../services/searchService';
import type { SearchResultPage } from '../types';
import { useDebouncedValue } from './useDebouncedValue';
import { useSearchParamsState } from './useSearchParamsState';

/**
 * Hook principal da busca (DESIGN-v3 §2.5 / ADR-027).
 *
 * Camadas de defesa contra spam de request:
 *   1. `useDebouncedValue(250)` segura o termo digitado.
 *   2. `useDeferredValue` adia o render sob carga sem onerar a rede.
 *   3. `enabled: q.length >= 2` bloqueia request com termo insuficiente
 *      (CA01 obriga ≥ 2 caracteres).
 *   4. `staleTime: 60_000` casa com `Cache-Control: max-age=60` do
 *      backend (ADR-023): se o usuário voltar à mesma query em 60s,
 *      zero request.
 *
 * Bug 6 fix (T30.1.X7): `getNextPageParam` faz `?? undefined`. Sem isso,
 * `null` é tratado como cursor válido vazio pelo TanStack → fetch
 * infinito quando o backend sinaliza fim de paginação.
 */

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/** Constrói a chave canônica do TanStack — chaves vazias não fragmentam o cache. */
function canonicalKey(input: {
  q: string;
  author?: string;
  category?: number;
  de?: string;
  ate?: string;
}) {
  return {
    q: input.q,
    ...(input.author && { author: input.author }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.de && { de: input.de }),
    ...(input.ate && { ate: input.ate }),
  };
}

function getNextPageParam(last: SearchResultPage): string | undefined {
  // Bug 6 (DESIGN-v3 §2.5): TanStack trata `null` como cursor válido →
  // fetch infinito. `?? undefined` sinaliza "fim" corretamente.
  return last.next_cursor ?? undefined;
}

function shouldRetry(count: number, err: unknown): boolean {
  const status = (err as AxiosError | undefined)?.response?.status ?? 0;
  // 4xx (incluindo 429) é "user error" — não retenta.
  // 5xx retenta 1 vez. Não retenta mais para não saturar o backend
  // se ele estiver degradado.
  if (status >= 400 && status < 500) return false;
  return count < 1;
}

export function useSearch() {
  const { state } = useSearchParamsState();
  const debouncedQ = useDebouncedValue(state.q, DEBOUNCE_MS);
  const deferredQ = useDeferredValue(debouncedQ);

  const enabled = deferredQ.length >= MIN_QUERY_LENGTH;
  const key = canonicalKey({
    q: deferredQ,
    author: state.author,
    category: state.category,
    de: state.de,
    ate: state.ate,
  });

  const query = useInfiniteQuery({
    queryKey: ['search', 'articles', key],
    queryFn: ({ pageParam, signal }) =>
      fetchSearch(
        {
          q: deferredQ,
          author: state.author,
          category: state.category,
          de: state.de,
          ate: state.ate,
          cursor: pageParam,
        },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
    // SSOT em searchService (fix H-02): centraliza staleTime/gcTime.
    // Coincide com o default do QueryClient em main.tsx; mantemos override
    // local explícito para deixar a intenção visível no hook.
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: shouldRetry,
    enabled,
  });

  return {
    ...query,
    /** Útil para anunciar "buscando «kpop»…" no aria-live region. */
    debouncedQ,
    deferredQ,
    /** UI usa isso para diferenciar empty state inicial vs "0 resultados". */
    isEnabled: enabled,
  };
}

/** Exporta internals apenas para testes unitários (Bug 6 + retry policy). */
export const _internals = { getNextPageParam, shouldRetry, canonicalKey };
