/**
 * Smoke test integrado da pagina /buscar.
 *
 * Renderiza Buscar com QueryClient + MemoryRouter reais. Validamos:
 *   - h1 "Buscar" presente (landmark editorial visivel).
 *   - SearchInput renderiza no DOM (role=search + role=searchbox).
 *   - FilterChips shell aparece com "Sem filtros ativos".
 *   - SearchResults aparece em EmptyState quando ?q nao existe.
 *   - Sem role="combobox" em nenhum lugar (ADR-028).
 */
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { Buscar } from '../Buscar';

function wrap(node: ReactNode, url = '/buscar') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Buscar — montagem da pagina (DESIGN-v3 §2.5)', () => {
  it('renderiza h1 "Buscar" (landmark editorial)', () => {
    wrap(<Buscar />);
    expect(
      screen.getByRole('heading', { level: 1, name: /buscar/i }),
    ).toBeDefined();
  });

  it('renderiza form role="search" com input type="search"', () => {
    wrap(<Buscar />);
    expect(screen.getByRole('search')).toBeDefined();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('type', 'search');
  });

  it('renderiza FilterChips shell vazia ("Sem filtros ativos")', () => {
    wrap(<Buscar />);
    expect(screen.getByText(/sem filtros ativos/i)).toBeDefined();
  });

  it('renderiza EmptyState quando nao ha ?q na URL', () => {
    wrap(<Buscar />);
    // Texto específico do EmptyState (SearchInput tem prompt similar mas com "Resultados aparecem abaixo")
    expect(
      screen.getByText(/digite ao menos 2 caracteres para buscar artigos/i),
    ).toBeDefined();
  });

  it('NAO renderiza nenhum role="combobox" (ADR-028)', () => {
    const { container } = wrap(<Buscar />);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('quando ?q presente, ainda renderiza o input pre-populado', () => {
    wrap(<Buscar />, '/buscar?q=kpop');
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    expect(input.value).toBe('kpop');
  });
});
