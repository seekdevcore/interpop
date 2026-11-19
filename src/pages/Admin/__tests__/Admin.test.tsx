/**
 * Ícones e rodapé da sidebar do painel administrativo.
 *
 * Regressões cobertas:
 *   - "← Voltar ao site": a seta fazia parte do nome acessível.
 *   - Rodapé escrevia "Administrador" para qualquer pessoa, mas dev e editor
 *     também entram no painel. O cargo agora vem de currentUser.role.
 *   - Selos de cargo, cards de KPI e aviso do modal de banir usavam emoji.
 *     Agora são SVG do lucide-react com aria-hidden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiUser } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import moderationService from '@/services/moderationService';
import { Admin } from '../index';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/moderationService', () => ({
  default: {
    listUsers: vi.fn(),
    listBans: vi.fn(),
    listBanRequests: vi.fn(),
  },
}));
vi.mock('@/services/metricsService', () => ({ default: { get: vi.fn() } }));

const GLYPH = /\p{Extended_Pictographic}|[←↪✕]/u;

type Role = ApiUser['role'];

function makeUser(id: string, role: Role, fullName: string): ApiUser {
  const [first, last] = fullName.split(' ');
  return {
    id,
    username: first.toLowerCase(),
    full_name: fullName,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}@example.com`,
    role,
    bio: '',
    avatar: null,
    avatar_initial: first[0],
    date_joined: '2026-01-01T00:00:00Z',
    is_banned: false,
  };
}

const USERS = [
  makeUser('10', 'dev', 'Diego Lima'),
  makeUser('11', 'admin', 'Bruna Reis'),
  makeUser('12', 'editor', 'Caio Melo'),
  makeUser('13', 'user', 'Lia Prado'),
];

function mockAuth(role: Role) {
  const isDev = role === 'dev';
  const isAdmin = isDev || role === 'admin';
  vi.mocked(useAuth).mockReturnValue({
    currentUser: makeUser('1', role, 'Ana Souza'),
    isDev,
    isAdmin,
    canPublish: isAdmin || role === 'editor',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

function expectDecorativeSvg(el: Element | null, what: string) {
  const svg = el?.querySelector('svg');
  expect(svg, `${what} sem ícone SVG`).not.toBeNull();
  expect(svg).toHaveAttribute('aria-hidden', 'true');
}

beforeEach(() => {
  vi.clearAllMocks();
  const page = <T,>(results: T[]) =>
    Promise.resolve({ data: { results } }) as never;
  vi.mocked(moderationService.listUsers).mockReturnValue(page(USERS));
  vi.mocked(moderationService.listBans).mockReturnValue(page([]));
  vi.mocked(moderationService.listBanRequests).mockReturnValue(page([]));
});

describe('Admin — rodapé da sidebar', () => {
  it('"Voltar ao site" e "Sair" têm nome limpo e ícone SVG', async () => {
    mockAuth('admin');
    renderAdmin();
    await screen.findByRole('table');

    const aside = screen.getByRole('complementary');
    const back = within(aside).getByRole('button', { name: 'Voltar ao site' });
    expect(back.textContent).not.toMatch(GLYPH);
    expectDecorativeSvg(back, 'Voltar ao site');

    const logout = within(aside).getByRole('button', { name: 'Sair' });
    expectDecorativeSvg(logout, 'Sair');
  });

  it.each([
    ['dev', 'Dev'],
    ['admin', 'Admin'],
    ['editor', 'Editor'],
  ] as const)('pessoa com cargo %s vê "%s" no rodapé', async (role, label) => {
    mockAuth(role);
    renderAdmin();
    await screen.findByRole('table');

    const aside = screen.getByRole('complementary');
    const userBlock = within(aside).getByText('Ana Souza').parentElement!;
    expect(within(userBlock).getByText(label)).toBeInTheDocument();
    expect(within(aside).queryByText('Administrador')).not.toBeInTheDocument();
  });
});

describe('Admin — aba Usuários', () => {
  it('selos de cargo da tabela mostram só o texto, com ícone SVG', async () => {
    mockAuth('admin');
    renderAdmin();
    const table = await screen.findByRole('table');

    for (const label of ['Dev', 'Admin', 'Editor', 'Leitor']) {
      const badge = within(table).getByText(label);
      expect(badge.textContent?.trim()).toBe(label);
      expectDecorativeSvg(badge, `selo ${label}`);
    }
  });

  it('os quatro cards de KPI usam ícone SVG, sem emoji', async () => {
    mockAuth('admin');
    const { container } = renderAdmin();
    await screen.findByRole('table');

    const cards = container.querySelectorAll('.admin__stat-card');
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      expect(card.textContent).not.toMatch(GLYPH);
      expectDecorativeSvg(card, 'card de KPI');
    });
  });

  it('aviso do modal de banir usa ícone SVG, sem o emoji ⚠️', async () => {
    mockAuth('admin');
    renderAdmin();
    await screen.findByRole('table');

    fireEvent.click(screen.getAllByRole('button', { name: 'Banir' })[0]);
    const warning = screen.getByText(/perderá acesso imediato/);
    expect(warning.textContent).not.toMatch(GLYPH);
    expectDecorativeSvg(warning, 'aviso de banimento');
  });
});
