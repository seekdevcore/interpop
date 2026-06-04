/**
 * 429 com `Retry-After` — backend está esfriando o rate limit.
 *
 * Mostra um countdown reativo. `retryAfterSeconds` vem do header HTTP ou
 * do body `{ retry_after: number }`. Se nada veio, fallback 30s (default
 * mais comum do DRF throttle).
 *
 * UX: NÃO escondemos a query — o usuário ainda vê o que digitou. Botão
 * "Tentar agora" só fica enabled quando o contador zera. Antes disso,
 * fica desabilitado com o texto do countdown — sem trapacear.
 */
import { useEffect, useState } from 'react';

interface RateLimitedStateProps {
  /** Segundos para liberar. Pode ser undefined → default 30. */
  retryAfterSeconds?: number;
  onRetry: () => void;
}

const DEFAULT_RETRY_AFTER = 30;

export function RateLimitedState({
  retryAfterSeconds,
  onRetry,
}: RateLimitedStateProps) {
  const initial = retryAfterSeconds ?? DEFAULT_RETRY_AFTER;
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    setRemaining(retryAfterSeconds ?? DEFAULT_RETRY_AFTER);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const canRetry = remaining <= 0;

  return (
    <div
      className="search-state search-state--rate-limited"
      role="status"
      aria-live="polite"
    >
      <p className="search-state__headline">Muitas buscas em pouco tempo.</p>
      <p className="search-state__hint">
        {canRetry
          ? 'Pronto, pode tentar de novo.'
          : `Aguarde ${remaining}s para uma nova tentativa.`}
      </p>
      <button
        type="button"
        className="search-state__retry"
        onClick={onRetry}
        disabled={!canRetry}
      >
        Tentar agora
      </button>
    </div>
  );
}
