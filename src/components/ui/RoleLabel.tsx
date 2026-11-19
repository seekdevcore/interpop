import { ROLE_META, type Role } from './roleMeta';

/** Ícone + nome do cargo, para dentro de um selo. O ícone é decorativo. */
export function RoleLabel({ role, size = 12 }: { role: Role; size?: number }) {
  const { label, Icon } = ROLE_META[role];
  return (
    <>
      <Icon size={size} />
      {label}
    </>
  );
}
