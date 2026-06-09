/**
 * Spec: T30.1.X (FilterChips shell) + ADR-030-UI (radius-md).
 *
 * Sprint 4 (MVP) NÃO implementa filtros funcionais — só infra visual:
 *   - Quando URL não tem nenhum filtro, anuncia "Sem filtros ativos".
 *   - Quando URL tem `author=`, `category=`, `de=` ou `ate=`, renderiza
 *     um chip por valor, com botão "Remover filtro X" que NÃO faz nada
 *     útil ainda (Sprint 5 plugará a ação real).
 *   - aria-pressed reflete o estado (visualmente).
 *   - radius-md (ADR-030-UI) — NÃO pílula full-rounded.
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { FilterChips } from '../FilterChips';

function renderChips(url = '/buscar') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FilterChips />
    </MemoryRouter>,
  );
}

describe('FilterChips — estado vazio', () => {
  it('sem filtros na URL, anuncia "Sem filtros ativos"', () => {
    renderChips();
    expect(screen.getByText(/sem filtros ativos/i)).toBeInTheDocument();
  });
});

describe('FilterChips — render por filtro presente', () => {
  it('renderiza chip para author=joao-silva', () => {
    renderChips('/buscar?q=kpop&author=joao-silva');
    expect(screen.getByText(/autor: joao-silva/i)).toBeInTheDocument();
  });

  it('renderiza chip para category=1', () => {
    renderChips('/buscar?q=kpop&category=1');
    expect(screen.getByText(/editoria: 1/i)).toBeInTheDocument();
  });

  it('renderiza chip para de + ate (range de datas)', () => {
    renderChips('/buscar?q=kpop&de=2026-01-01&ate=2026-05-01');
    expect(
      screen.getByText(/de 2026-01-01 ate 2026-05-01/i),
    ).toBeInTheDocument();
  });

  it('renderiza vários chips simultaneamente', () => {
    renderChips('/buscar?q=kpop&author=ana&category=2');
    const chips = screen.getAllByRole('button', { name: /remover/i });
    expect(chips.length).toBe(2);
  });
});

describe('FilterChips — semântica radius-md (ADR-030-UI)', () => {
  it('chips usam classe `.filter-chip` (radius-md, não full-rounded)', () => {
    const { container } = renderChips('/buscar?q=k&author=x');
    const chip = container.querySelector('.filter-chip');
    expect(chip).not.toBeNull();
  });
});
