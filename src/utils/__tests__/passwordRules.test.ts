import { describe, it, expect } from 'vitest';
import { PASSWORD_RULES, isPasswordStrong } from '../passwordRules';

describe('passwordRules', () => {
  it('aceita senha que cumpre todas as 5 regras', () => {
    expect(isPasswordStrong('Senha123#')).toBe(true);
  });

  it.each([
    ['Cur1#aB', 'Mínimo 8 (7 chars)'],
    ['senha123#', 'maiúscula'],
    ['SENHA123#', 'minúscula'],
    ['SenhaAbc#', 'número'],
    ['Senha1234', 'especial'],
  ])('rejeita %s (falta %s)', (pw) => {
    expect(isPasswordStrong(pw)).toBe(false);
  });

  it('cada caractere do conjunto @$!%*?&# satisfaz a regra de especial', () => {
    const especial = PASSWORD_RULES.find((r) => r.id === 'special')!;
    for (const ch of '@$!%*?&#') {
      expect(especial.test(`Senha12${ch}`)).toBe(true);
    }
  });

  it('expõe exatamente 5 regras na ordem do checklist', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
      'len',
      'upper',
      'lower',
      'digit',
      'special',
    ]);
  });
});
