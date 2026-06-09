/**
 * Pequena fachada sobre `useSearchParams` para tratar a URL como SSOT
 * (DESIGN-v3 §2.5 / ADR-027). Compatível com Sprint 5 (filtros) sem
 * mudar API pública.
 *
 * Por que existe (vs usar `useSearchParams` direto):
 *   - Centraliza set/get para sempre passar `replace: true` quando o
 *     usuário ainda está digitando (debounce), evitando entupir o
 *     histórico do browser com 1 entrada por keystroke.
 *   - Apaga o param quando o valor é vazio (cleaner URLs: `/buscar`
 *     em vez de `/buscar?q=`).
 *   - Mantém `q` na position 0 (estável para debug + deep-link estético).
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface SearchState {
  q: string;
  author?: string;
  category?: number;
  de?: string;
  ate?: string;
}

export function useSearchParamsState(): {
  state: SearchState;
  setQ: (value: string, opts?: { push?: boolean }) => void;
} {
  const [params, setParams] = useSearchParams();

  const state = useMemo<SearchState>(() => {
    const categoryRaw = params.get('category');
    const categoryNum = categoryRaw ? Number(categoryRaw) : NaN;
    return {
      q: params.get('q') ?? '',
      author: params.get('author') ?? undefined,
      category: Number.isFinite(categoryNum) ? categoryNum : undefined,
      de: params.get('de') ?? undefined,
      ate: params.get('ate') ?? undefined,
    };
  }, [params]);

  const setQ = useCallback(
    (value: string, opts: { push?: boolean } = {}) => {
      const next = new URLSearchParams(params);
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        next.delete('q');
      } else {
        next.set('q', value);
      }
      // Default: replace — não polui histórico em search-as-you-type.
      // Caller pode opt-in para push quando o usuário pressionar Enter.
      setParams(next, { replace: !opts.push });
    },
    [params, setParams],
  );

  return { state, setQ };
}
