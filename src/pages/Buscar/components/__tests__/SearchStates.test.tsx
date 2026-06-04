/**
 * Cobertura dos 4 estados de UI da busca.
 *
 * Foco TDD:
 *   - EmptyState: texto inicial pt-BR + role="status".
 *   - EmptyResults: mostra a query buscada entre aspas.
 *   - RateLimitedState: countdown reativo + retry desabilitado até zerar.
 *   - SearchErrorFallback: role="alert", botão chama resetErrorBoundary.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmptyState } from '../EmptyState';
import { EmptyResults } from '../EmptyResults';
import { RateLimitedState } from '../RateLimitedState';
import { SearchErrorFallback } from '../SearchErrorFallback';

describe('EmptyState', () => {
  it('renderiza prompt inicial em pt-BR', () => {
    render(<EmptyState />);
    expect(
      screen.getByText(/digite ao menos 2 caracteres/i),
    ).toBeInTheDocument();
  });

  it('é exposto como role="status" para SR (sem interromper foco)', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('EmptyResults', () => {
  it('mostra a query buscada entre aspas no headline', () => {
    render(<EmptyResults query="qzxzqzx" />);
    expect(screen.getByText(/nada encontrado para .qzxzqzx./i)).toBeDefined();
  });

  it('inclui sugestão acionável (termos mais gerais)', () => {
    render(<EmptyResults query="kpop 4ª geração" />);
    expect(screen.getByText(/termos mais gerais/i)).toBeInTheDocument();
  });
});

describe('RateLimitedState — countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza segundos restantes inicialmente', () => {
    render(<RateLimitedState retryAfterSeconds={23} onRetry={() => {}} />);
    expect(screen.getByText(/aguarde 23s/i)).toBeInTheDocument();
  });

  it('decrementa a cada segundo', () => {
    render(<RateLimitedState retryAfterSeconds={3} onRetry={() => {}} />);
    expect(screen.getByText(/aguarde 3s/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/aguarde 2s/i)).toBeInTheDocument();
  });

  it('quando zera, libera o botão Tentar agora', () => {
    render(<RateLimitedState retryAfterSeconds={1} onRetry={() => {}} />);
    const button = screen.getByRole('button', { name: /tentar agora/i });
    expect(button).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(button).not.toBeDisabled();
    expect(screen.getByText(/pode tentar de novo/i)).toBeInTheDocument();
  });

  it('default 30s quando retryAfterSeconds é undefined', () => {
    render(<RateLimitedState onRetry={() => {}} />);
    expect(screen.getByText(/aguarde 30s/i)).toBeInTheDocument();
  });
});

describe('SearchErrorFallback', () => {
  it('renderiza role="alert" com a mensagem do erro', () => {
    render(
      <SearchErrorFallback
        error={new Error('Timeout do servidor')}
        resetErrorBoundary={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/timeout do servidor/i)).toBeInTheDocument();
  });

  it('botão Tentar novamente chama resetErrorBoundary', async () => {
    const reset = vi.fn();
    render(
      <SearchErrorFallback error={new Error('x')} resetErrorBoundary={reset} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
