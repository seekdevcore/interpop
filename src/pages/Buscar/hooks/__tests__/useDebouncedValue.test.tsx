/**
 * Spec: T30.1.X6 (DESIGN-v3 §2.5 / ADR-027).
 *
 * `useDebouncedValue` é um hook de 15 LoC, zero-dep, que segura um
 * valor por N ms antes de propagar. É a peça que CONVERTE 5 keystrokes
 * em 200ms em 1 update (e portanto 1 request à busca), respeitando o
 * rate limit anônimo (30/min — ADR-024).
 *
 * Bug 4 do refino v3: `useDeferredValue` NÃO é debounce — não tem
 * delay configurável. Não pode substituir este hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna o valor inicial imediatamente (sem delay no primeiro render)', () => {
    const { result } = renderHook(() => useDebouncedValue('inicial', 250));
    expect(result.current).toBe('inicial');
  });

  it('propaga o novo valor apenas após `delayMs`', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    expect(result.current).toBe('a'); // ainda não propagou

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('a'); // ainda não — falta 1ms

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab'); // agora sim
  });

  it('3 keystrokes em 200ms → 1 update após 250ms (rate-limit-friendly)', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'k' } },
    );

    // 3 keystrokes rapidos: k → kp → kpo (espaçados ~80ms)
    rerender({ value: 'kp' });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    rerender({ value: 'kpo' });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    rerender({ value: 'kpop' });

    // total ~160ms decorridos, ainda dentro do debounce → valor antigo
    expect(result.current).toBe('k');

    // espera o debounce completar
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('kpop');
  });

  it('limpa o timeout no unmount (sem state-leak warning)', () => {
    const { unmount } = renderHook(() => useDebouncedValue('x', 250));
    // Se o cleanup não chama clearTimeout, advanceTimersByTime após unmount
    // dispara setState em componente desmontado. Vitest reporta como erro.
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Sem expect: o test passa se nenhum warning/erro é emitido.
  });

  it('respeita mudança de delayMs (cancela timer antigo, agenda novo)', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 500 } },
    );
    rerender({ value: 'b', delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('b');
  });
});
