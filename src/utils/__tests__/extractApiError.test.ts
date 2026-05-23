/**
 * Tests para src/utils/extractApiError.ts (D4 do reorganization-proposal).
 *
 * Cobre os 9 fallbacks em ordem de prioridade — qualquer regressão aqui
 * volta a fragmentação que tínhamos antes (6 cópias divergentes).
 */
import { describe, it, expect } from 'vitest';
import { extractApiError } from '@/utils/extractApiError';

describe('extractApiError', () => {
  // ── 1. HTTP 401 ─────────────────────────────────────────────────────────
  it('retorna mensagem de sessão expirada para HTTP 401', () => {
    const err = { response: { status: 401 } };
    expect(extractApiError(err, 'fallback')).toBe(
      'Sua sessão expirou. Faça login novamente para continuar.',
    );
  });

  it('mensagem de 401 tem prioridade sobre data.detail', () => {
    const err = {
      response: { status: 401, data: { detail: 'outra coisa' } },
    };
    expect(extractApiError(err, 'fallback')).toContain('sessão expirou');
  });

  // ── 2. response.data string direta ──────────────────────────────────────
  it('retorna response.data quando é string não-vazia', () => {
    const err = { response: { data: 'Erro literal do backend' } };
    expect(extractApiError(err, 'fallback')).toBe('Erro literal do backend');
  });

  it('ignora string vazia ou só whitespace e segue pra próximo fallback', () => {
    const err = { response: { status: 500, data: '   ' } };
    expect(extractApiError(err, 'fallback')).toContain('HTTP 500');
  });

  // ── 3. response.data.detail (DRF APIException) ──────────────────────────
  it('retorna data.detail quando string presente', () => {
    const err = { response: { data: { detail: 'Recurso não encontrado.' } } };
    expect(extractApiError(err, 'fallback')).toBe('Recurso não encontrado.');
  });

  // ── 4. response.data.non_field_errors ──────────────────────────────────
  it('retorna primeiro non_field_errors quando array com items', () => {
    const err = {
      response: { data: { non_field_errors: ['Credenciais inválidas.'] } },
    };
    expect(extractApiError(err, 'fallback')).toBe('Credenciais inválidas.');
  });

  it('detail tem prioridade sobre non_field_errors', () => {
    const err = {
      response: {
        data: {
          detail: 'detail wins',
          non_field_errors: ['nfe loses'],
        },
      },
    };
    expect(extractApiError(err, 'fallback')).toBe('detail wins');
  });

  // ── 5. primeiro field-level error ──────────────────────────────────────
  it('extrai primeiro valor de dict de erros field-level (array)', () => {
    const err = {
      response: { data: { email: ['Email já cadastrado.'] } },
    };
    expect(extractApiError(err, 'fallback')).toBe('Email já cadastrado.');
  });

  it('extrai primeiro valor field-level quando string direta', () => {
    const err = {
      response: { data: { password: 'Senha muito curta.' } },
    };
    expect(extractApiError(err, 'fallback')).toBe('Senha muito curta.');
  });

  // ── 6. HTTP status sem corpo parseável ─────────────────────────────────
  it('retorna mensagem genérica de HTTP quando status presente sem data útil', () => {
    const err = { response: { status: 500 } };
    expect(extractApiError(err, 'fallback')).toContain('HTTP 500');
    expect(extractApiError(err, 'fallback')).toContain('servidor');
  });

  // ── 7. request sem response (network/CORS) ─────────────────────────────
  it('retorna mensagem de rede quando request enviado mas sem response', () => {
    const err = { request: {} };
    const msg = extractApiError(err, 'fallback');
    expect(msg).toContain('Não foi possível alcançar o servidor');
  });

  // ── 8. err.message ─────────────────────────────────────────────────────
  it('retorna err.message quando presente e nenhum dos casos acima', () => {
    const err = { message: 'TypeError: Cannot read property' };
    expect(extractApiError(err, 'fallback')).toBe(
      'TypeError: Cannot read property',
    );
  });

  // ── 9. fallback ────────────────────────────────────────────────────────
  it('retorna fallback quando err é null/undefined/{}', () => {
    expect(extractApiError(null, 'fallback msg')).toBe('fallback msg');
    expect(extractApiError(undefined, 'fallback msg')).toBe('fallback msg');
    expect(extractApiError({}, 'fallback msg')).toBe('fallback msg');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────
  it('lida com objeto inteiramente vazio em response.data', () => {
    const err = { response: { status: 200, data: {} } };
    // data={} → não tem detail/non_field/field → cai pra status genérico
    expect(extractApiError(err, 'fallback')).toContain('HTTP 200');
  });

  it('lida com array vazio em non_field_errors', () => {
    const err = {
      response: { status: 400, data: { non_field_errors: [] } },
    };
    // array vazio → não retorna [0], cai pro status genérico
    expect(extractApiError(err, 'fallback')).toContain('HTTP 400');
  });
});
