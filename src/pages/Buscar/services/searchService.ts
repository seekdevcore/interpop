/**
 * Cliente axios para `/api/v1/search/articles/` (ADR-023).
 *
 * Responsabilidades:
 *   1. Montar query string apenas com filtros não-vazios (canonical key).
 *      Isso evita fragmentar o cache do TanStack (`?author=` vazio vira
 *      uma key diferente de sem o param).
 *   2. Aceitar `AbortSignal` do TanStack — quando o usuário digita rápido,
 *      requests obsoletos são cancelados sem onerar o backend.
 *   3. NÃO normalizar erro — propaga o `AxiosError`; o hook `useSearch`
 *      decide retry/UI por status code.
 */
import type { AxiosError } from 'axios';
import api from '@/services/api';
import type {
  FetchSearchInput,
  SearchErrorBody,
  SearchResultPage,
} from '../types';

const ENDPOINT = '/api/v1/search/articles/';

/**
 * Constrói `URLSearchParams` apenas com chaves não-vazias/null/undefined.
 * Mantém ordem estável (q primeiro, filtros depois) — útil para debug e
 * para que o backend computar a mesma chave de cache que o TanStack.
 */
function buildSearchParams(input: FetchSearchInput): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('q', input.q);
  if (input.author) sp.set('author', input.author);
  if (input.category !== undefined && input.category !== null) {
    sp.set('category', String(input.category));
  }
  if (input.de) sp.set('de', input.de);
  if (input.ate) sp.set('ate', input.ate);
  if (input.cursor) sp.set('cursor', input.cursor);
  if (input.per_page) sp.set('per_page', String(input.per_page));
  return sp;
}

export async function fetchSearch(
  input: FetchSearchInput,
  signal?: AbortSignal,
): Promise<SearchResultPage> {
  const response = await api.get<SearchResultPage>(ENDPOINT, {
    params: buildSearchParams(input),
    signal,
  });
  return response.data;
}

/**
 * Type-guard prático para tela de erro: discrimina 429 / 503 / 4xx.
 * Não joga, apenas detecta — quem usa decide qual fallback renderizar.
 */
export function isSearchError(
  err: unknown,
): err is AxiosError<SearchErrorBody> {
  return (
    typeof err === 'object' &&
    err !== null &&
    'isAxiosError' in err &&
    (err as AxiosError).isAxiosError === true
  );
}
