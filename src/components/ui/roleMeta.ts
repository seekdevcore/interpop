import { BookOpen, Code, PenLine, Shield, type LucideIcon } from 'lucide-react';
import type { ApiUser } from '@/services/authService';

export type Role = ApiUser['role'];

/**
 * Rótulo e ícone de cada cargo. Fonte única para os selos (menu do usuário,
 * tabela do admin) e para o cargo no rodapé da sidebar do admin.
 */
export const ROLE_META: Record<Role, { label: string; Icon: LucideIcon }> = {
  dev: { label: 'Dev', Icon: Code },
  admin: { label: 'Admin', Icon: Shield },
  editor: { label: 'Editor', Icon: PenLine },
  user: { label: 'Leitor', Icon: BookOpen },
};
