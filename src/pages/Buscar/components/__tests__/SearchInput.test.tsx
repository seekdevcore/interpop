/**
 * Spec: T30.1.15 + T30.1.X8 (Bug 5 — APG combobox antipattern).
 *
 * Regras duras:
 *   - Form usa `role="search"` (ARIA landmark — landmark único, anuncia
 *     "região de busca" para SR).
 *   - Input usa `type="search"` semântico, SEM `role="combobox"` e SEM
 *     `aria-expanded` (combobox exige listbox controlado; não temos).
 *   - URL é SSOT — digitar atualiza `?q=` via replace (não polui histórico).
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchInput } from '../SearchInput';

function CurrentQ() {
  const [sp] = useSearchParams();
  return <span data-testid="current-q">{sp.get('q') ?? ''}</span>;
}

function renderInput(initialUrl = '/buscar') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="/buscar"
          element={
            <>
              <SearchInput />
              <CurrentQ />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchInput — semântica APG (T30.1.X8 / ADR-028)', () => {
  it('renderiza <form role="search">', () => {
    renderInput();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('input é <input type="search"> SEM role="combobox" nem aria-expanded', () => {
    renderInput();
    const input = screen.getByRole('searchbox', { name: /buscar artigos/i });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).not.toHaveAttribute('role', 'combobox');
    expect(input).not.toHaveAttribute('aria-expanded');
  });

  it('tem rótulo acessível (sr-only label associado)', () => {
    renderInput();
    expect(screen.getByLabelText(/buscar artigos/i)).toBeInTheDocument();
  });

  it('possui enterKeyHint="search" (teclado mobile)', () => {
    renderInput();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
  });

  it('digitar atualiza ?q= na URL (SSOT)', async () => {
    renderInput();
    const user = userEvent.setup();
    const input = screen.getByRole('searchbox');
    await user.type(input, 'kpop');
    expect(screen.getByTestId('current-q')).toHaveTextContent('kpop');
  });

  it('pré-popula com ?q= existente na URL', () => {
    renderInput('/buscar?q=beyonce');
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    expect(input.value).toBe('beyonce');
  });

  it('botão "Limpar" aparece quando há valor e remove ?q=', async () => {
    renderInput('/buscar?q=kpop');
    const user = userEvent.setup();
    const clear = screen.getByRole('button', { name: /limpar busca/i });
    await user.click(clear);
    expect(screen.getByTestId('current-q')).toHaveTextContent('');
  });
});
