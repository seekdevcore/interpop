import { useEffect, useState } from 'react';

/**
 * Segura `value` por `delayMs` antes de propagá-lo.
 *
 * Por que existir (DESIGN-v3 §2.5 Bug 4, ADR-027):
 *   `useDeferredValue` do React 19 NÃO é debounce — ele adia o render
 *   sob carga, mas não tem delay configurável e pode disparar 5 requests
 *   em 5 keystrokes. Aqui converte 5 keystrokes em 200ms num único
 *   update após 250ms, alinhado ao rate limit 30/min do backend
 *   (ADR-024). A pilha completa do hook `useSearch` é:
 *
 *     inputQ ─(useDebouncedValue 250ms)→ debouncedQ
 *            ─(useDeferredValue)→ deferredQ ─→ queryKey
 *
 *   debounce reduz REQUESTS; deferredValue mantém o input fluido durante
 *   render de listas grandes.
 *
 * Implementação intencionalmente mínima (15 LoC, zero-dep):
 *   - 1 useState para o valor "atrasado"
 *   - 1 useEffect que (re)agenda setTimeout a cada mudança em value/delay
 *   - cleanup chama clearTimeout — sem leak de state após unmount nem
 *     update do valor para o último digitado quando o usuário ainda está
 *     digitando rápido
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
