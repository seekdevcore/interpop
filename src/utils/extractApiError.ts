/**
 * extractApiError — extrai mensagem amigável de erros axios/HTTP.
 *
 * Consolida 6+ implementações ad-hoc espalhadas pelas pages (Login, Perfil,
 * Article, ArticleComments, CreatePost, Admin, Newsletter) — cada uma com
 * pequenas variações (algumas tratavam 401, outras não; algumas pegavam
 * non_field_errors, outras só detail; etc.).
 *
 * Ordem de prioridade (caso esperado → fallback):
 *  1. HTTP 401 → mensagem de sessão expirada (interceptor axios já vai
 *     redirecionar pra /login via `auth:logout` event; copy aqui é UX).
 *  2. `response.data` string direta → retorna como veio.
 *  3. `response.data.detail` (formato canônico do DRF APIException).
 *  4. `response.data.non_field_errors[0]` (formato Serializer non-field).
 *  5. Primeiro valor de `response.data` dict (formato Serializer field-level —
 *     ex: `{email: ["Já cadastrado"]}` → "Já cadastrado").
 *  6. `response.status` sem body parseável → mensagem genérica HTTP.
 *  7. `request` sem `response` → backend offline / CORS / rede.
 *  8. `err.message` → último recurso antes do fallback.
 *  9. Fallback fornecido pelo caller.
 */

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: Record<string, unknown> | string | null;
  };
  request?: unknown;
  message?: string;
};

export function extractApiError(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;

  // 1. 401 — sessão expirou (axios interceptor já disparou auth:logout)
  if (e?.response?.status === 401) {
    return 'Sua sessão expirou. Faça login novamente para continuar.';
  }

  const data = e?.response?.data;

  // 2. response.data string direta (alguns endpoints legacy retornam plain text)
  if (typeof data === 'string' && data.trim()) return data;

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // 3. .detail (DRF APIException padrão)
    const detail = obj.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;

    // 4. .non_field_errors (Serializer non-field validation)
    const nonField = obj.non_field_errors;
    if (Array.isArray(nonField) && nonField.length > 0) {
      return String(nonField[0]);
    }

    // 5. Primeiro field-level error (ex: {email: ["Já cadastrado."]})
    const entries = Object.entries(obj);
    if (entries.length > 0) {
      const [, v] = entries[0];
      if (Array.isArray(v) && v.length > 0) return String(v[0]);
      if (typeof v === 'string' && v.trim()) return v;
    }
  }

  // 6. HTTP status sem corpo parseável
  if (e?.response?.status) {
    return `Erro inesperado do servidor (HTTP ${e.response.status}). Tente novamente.`;
  }

  // 7. Sem response — backend offline / CORS / rede
  if (e?.request) {
    return 'Não foi possível alcançar o servidor. Verifique sua conexão e tente novamente.';
  }

  // 8. message do Error/axios
  if (e?.message) return e.message;

  // 9. Fallback do caller
  return fallback;
}
