/**
 * Ícones do menu do usuário (Navbar).
 *
 * Regressão: os itens e o selo de cargo usavam emoji (👤 🛡️ ↪ 🛠️ ✍️). No
 * selo, o emoji ficava dentro do texto e o leitor de tela anunciava
 * "martelo e chave inglesa, Dev". Agora os ícones vêm do lucide-react, como
 * SVG com aria-hidden, e o texto acessível fica limpo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiUser } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { NavbarUserMenu } from '../NavbarUserMenu';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

// Emoji e as setas/glifos que serviam de ícone.
const GLYPH = /\p{Extended_Pictographic}|[←↪✕]/u;

type Role = ApiUser['role'];

function mockAuth(role: Role) {
  const currentUser: ApiUser = {
    id: '1',
    username: 'ana',
    full_name: 'Ana Souza',
    first_name: 'Ana',
    last_name: 'Souza',
    email: 'ana@example.com',
    role,
    bio: '',
    avatar: null,
    avatar_initial: 'A',
    date_joined: '2026-01-01T00:00:00Z',
    is_banned: false,
  };
  const isDev = role === 'dev';
  const isAdmin = isDev || role === 'admin';
  vi.mocked(useAuth).mockReturnValue({
    currentUser,
    isDev,
    isAdmin,
    canPublish: isAdmin || role === 'editor',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <NavbarUserMenu />
    </MemoryRouter>,
  );
}

describe('NavbarUserMenu — ícones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('itens têm nome acessível sem emoji e um SVG decorativo cada', () => {
    mockAuth('admin');
    renderMenu();

    for (const name of ['Meu perfil', 'Painel administrativo', 'Sair']) {
      const item = screen.getByRole('menuitem', { name });
      expect(item.textContent).not.toMatch(GLYPH);
      const svg = item.querySelector('svg');
      expect(svg, `${name} sem ícone SVG`).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it.each([
    ['dev', 'Dev'],
    ['admin', 'Admin'],
    ['editor', 'Editor'],
  ] as const)('selo de %s mostra "%s" sem emoji, com ícone', (role, label) => {
    mockAuth(role);
    renderMenu();

    const menu = screen.getByRole('menu');
    const badge = within(menu).getByText(label);
    expect(badge.textContent?.trim()).toBe(label);
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('editor vê o Painel administrativo; leitor não vê painel nem selo', () => {
    mockAuth('editor');
    const { unmount } = renderMenu();
    expect(
      screen.getByRole('menuitem', { name: 'Painel administrativo' }),
    ).toBeInTheDocument();
    unmount();

    mockAuth('user');
    renderMenu();
    expect(
      screen.queryByRole('menuitem', { name: 'Painel administrativo' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Leitor')).not.toBeInTheDocument();
  });
});
