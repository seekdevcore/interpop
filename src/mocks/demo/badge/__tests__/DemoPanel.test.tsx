/**
 * Painel do modo demo (só existe no build `--mode demo`, publicado no
 * Render para o design). Troca de conta, logout e reset do banco local.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';
import { createDemoDb, DEMO_ACCOUNTS } from '@/mocks/demo/db';
import { DemoPanel } from '@/mocks/demo/badge/DemoPanel';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

expect.extend({ toHaveNoViolations });

function setup({ loggedAs }: { loggedAs?: string } = {}) {
  const db = createDemoDb({ storage: null });
  if (loggedAs) db.setSession(db.findUserByEmail(loggedAs)!.id);
  const reload = vi.fn();
  const confirm = vi.fn(() => true);
  const user = userEvent.setup();
  const view = render(<DemoPanel db={db} reload={reload} confirm={confirm} />);
  return { db, reload, confirm, user, ...view };
}

const toggle = () => screen.getByRole('button', { name: /modo demo/i });

describe('<DemoPanel>', () => {
  it('começa recolhido, com o botão ligado ao painel por aria-controls', () => {
    setup();
    const btn = toggle();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(btn.getAttribute('aria-controls')!);
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
  });

  it('abre e fecha pelo botão; Esc fecha e devolve o foco ao botão', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/sem login/i)).toBeVisible();

    await user.keyboard('{Escape}');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveFocus();
  });

  it('acompanha login/logout feitos fora do painel (formulário do app)', () => {
    const { db } = setup();
    expect(toggle()).not.toHaveTextContent(/admin/i);
    act(() => db.setSession(db.findUserByEmail('admin@example.com')!.id));
    expect(toggle()).toHaveTextContent(/admin/i);
    act(() => db.setSession(null));
    expect(toggle()).not.toHaveTextContent(/admin/i);
  });

  it('mostra no botão o papel da conta logada', () => {
    setup({ loggedAs: 'editor@example.com' });
    expect(toggle()).toHaveTextContent(/editora/i);
  });

  it('"Entrar como" grava a sessão da conta e recarrega a página', async () => {
    const { db, reload, user } = setup();
    await user.click(toggle());
    const account = DEMO_ACCOUNTS.find((a) => a.role === 'admin')!;
    await user.click(
      screen.getByRole('button', { name: new RegExp(account.name, 'i') }),
    );
    expect(db.currentUser()?.email).toBe(account.email);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('oferece as 4 contas e desabilita a que já está logada', async () => {
    const { user } = setup({ loggedAs: 'dev@example.com' });
    await user.click(toggle());
    const buttons = DEMO_ACCOUNTS.map((a) =>
      screen.getByRole('button', { name: new RegExp(a.name, 'i') }),
    );
    expect(buttons).toHaveLength(4);
    const dev = DEMO_ACCOUNTS.findIndex((a) => a.role === 'dev');
    expect(buttons[dev]).toBeDisabled();
    expect(
      buttons.filter((b) => !(b as HTMLButtonElement).disabled),
    ).toHaveLength(3);
  });

  it('"Sair" só aparece logado, limpa a sessão e recarrega', async () => {
    const { db, reload, user } = setup({ loggedAs: 'leitor@example.com' });
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: /^sair$/i }));
    expect(db.currentUser()).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('esconde "Sair" sem login', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(screen.queryByRole('button', { name: /^sair$/i })).toBeNull();
  });

  it('"Resetar dados" pede confirmação e volta ao seed', async () => {
    const { db, reload, confirm, user } = setup({
      loggedAs: 'admin@example.com',
    });
    db.state.articles.length = 0;
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: /resetar dados/i }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(db.state.articles.length).toBeGreaterThan(0);
    expect(db.currentUser()).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('cancelar a confirmação não apaga nada', async () => {
    const { db, reload, confirm, user } = setup();
    confirm.mockReturnValueOnce(false);
    db.state.articles.length = 0;
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: /resetar dados/i }));
    expect(db.state.articles).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('não tem violações de acessibilidade (axe), fechado e aberto', async () => {
    const { container, user } = setup({ loggedAs: 'admin@example.com' });
    expect(await axe(container)).toHaveNoViolations();
    await user.click(toggle());
    expect(await axe(container)).toHaveNoViolations();
  });
});
