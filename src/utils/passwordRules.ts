/**
 * Regras de complexidade de senha — fonte única do checklist do frontend.
 *
 * Espelha o `PasswordComplexityValidator` do backend
 * (`apps/users/validators.py`): o mesmo conjunto de especiais (@$!%*?&#) e as
 * mesmas classes (maiúscula, minúscula, dígito). Front e back recusam/aceitam
 * pelos MESMOS critérios — senha válida na UI nunca é barrada pela API.
 */
export interface PasswordRule {
  id: 'len' | 'upper' | 'lower' | 'digit' | 'special';
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_SPECIAL_CHARS = '@$!%*?&#';

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'len', label: 'Mínimo 8 caracteres', test: (pw) => pw.length >= 8 },
  {
    id: 'upper',
    label: 'Contém letra MAIÚSCULA',
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: 'lower',
    label: 'Contém letra minúscula',
    test: (pw) => /[a-z]/.test(pw),
  },
  { id: 'digit', label: 'Contém número', test: (pw) => /\d/.test(pw) },
  {
    id: 'special',
    label: `Contém caractere especial (${PASSWORD_SPECIAL_CHARS})`,
    test: (pw) => /[@$!%*?&#]/.test(pw),
  },
];

export function isPasswordStrong(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}
