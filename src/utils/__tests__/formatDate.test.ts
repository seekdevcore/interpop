/**
 * Tests para src/utils/formatDate.ts (D5 do reorganization-proposal).
 *
 * 3 formatadores: formatDateShort, formatDateLong, formatDateTime.
 * Todos lidam com null/undefined/inválido sem levantar.
 */
import { describe, it, expect } from 'vitest';
import {
  formatDateShort,
  formatDateLong,
  formatDateTime,
} from '@/utils/formatDate';

describe('formatDateShort', () => {
  it('formata data ISO no padrão pt-BR (ex: "15 de jun. de 2026")', () => {
    const result = formatDateShort('2026-06-15T14:30:00Z');
    // Intl pt-BR rende "DD de MMM. de YYYY" — checa elementos principais
    expect(result).toMatch(/\d{2}/); // tem dia
    expect(result).toMatch(/\w+/); // tem mês (palavra)
    expect(result).toMatch(/2026/); // tem ano
  });

  it('retorna string vazia para null', () => {
    expect(formatDateShort(null)).toBe('');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
  });

  it('retorna string vazia para data inválida', () => {
    expect(formatDateShort('not-a-date')).toBe('');
  });

  it('retorna string vazia para string vazia', () => {
    expect(formatDateShort('')).toBe('');
  });
});

describe('formatDateLong', () => {
  it('formata data ISO com mês por extenso pt-BR', () => {
    const result = formatDateLong('2026-06-15T14:30:00Z');
    // "month: 'long'" pt-BR rende mês por extenso (junho, julho, etc.)
    expect(result).toMatch(/\d{2}\s+de\s+\w+\s+de\s+2026/);
    // E mês deve ter pelo menos 4 letras (junho, julho, agosto...)
    const monthMatch = result.match(/de\s+(\w+)\s+de/);
    expect(monthMatch?.[1].length).toBeGreaterThanOrEqual(4);
  });

  it('retorna string vazia para null/undefined', () => {
    expect(formatDateLong(null)).toBe('');
    expect(formatDateLong(undefined)).toBe('');
  });
});

describe('formatDateTime', () => {
  it('inclui hora e minuto no formato', () => {
    const result = formatDateTime('2026-06-15T14:30:00Z');
    // Deve ter HH:MM em algum lugar (timezone-aware)
    expect(result).toMatch(/\d{2}:\d{2}/);
    // E também o ano
    expect(result).toMatch(/2026/);
  });

  it('retorna string vazia para input inválido', () => {
    expect(formatDateTime('garbage')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });
});
