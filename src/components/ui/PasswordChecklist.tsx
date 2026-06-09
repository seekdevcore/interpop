import { PASSWORD_RULES } from '@/utils/passwordRules';
import './PasswordChecklist.css';

interface PasswordChecklistProps {
  value: string;
  /** Se true, esconde o checklist com o campo vazio. Default false: ele fica
   *  SEMPRE visível (referência fixa dos requisitos, não só ao digitar). */
  hideWhenEmpty?: boolean;
}

/**
 * Checklist de força de senha ao vivo. Mostra as 5 regras conforme o usuário
 * digita. Usado em Register, ResetPassword e troca de senha no Perfil — mesma
 * fonte de regras do backend (passwordRules.ts ↔ PasswordComplexityValidator).
 *
 * Estados: pendente = neutro/muted com "○" (não é erro, é "ainda falta");
 * cumprido = verde com "✓". O ícone (○/✓) carrega o estado junto da cor (1.4.1).
 */
export function PasswordChecklist({
  value,
  hideWhenEmpty = false,
}: PasswordChecklistProps) {
  if (hideWhenEmpty && value.length === 0) return null;

  return (
    <ul className="pw-checklist" aria-label="Requisitos da senha">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={`pw-checklist__item ${ok ? 'pw-checklist__item--ok' : 'pw-checklist__item--pending'}`}
            aria-label={`${rule.label}: ${ok ? 'cumprido' : 'pendente'}`}
          >
            <span className="pw-checklist__icon" aria-hidden="true">
              {ok ? '✓' : '○'}
            </span>
            <span className="pw-checklist__label" aria-hidden="true">
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
