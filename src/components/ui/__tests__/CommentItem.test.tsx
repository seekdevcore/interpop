/**
 * Testes de feedback de erro em CommentItem.
 *
 * Regressão: curtir / responder / excluir engoliam o erro num catch vazio —
 * o usuário clicava e nada acontecia, sem nenhuma pista do porquê. Agora cada
 * falha popula uma região role="alert" visível.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CommentItem } from '../CommentItem';
import type { ApiComment } from '@/services/commentService';
import commentService from '@/services/commentService';

vi.mock('@/services/commentService', () => ({
  default: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'reader-1', full_name: 'Leitor' },
    isAdmin: false,
  }),
}));

function makeComment(): ApiComment {
  return {
    id: 'c1',
    author: {
      id: 'author-1',
      full_name: 'Autor',
      avatar: null,
      avatar_initial: 'A',
    },
    content: 'comentário de teste',
    parent_id: null,
    created_at: '2026-05-28T00:00:00Z',
    likes_count: 0,
    is_liked: false,
    replies_count: 0,
    replies: [],
  };
}

const noop = () => {};

function renderItem() {
  return render(
    <ul>
      <CommentItem
        comment={makeComment()}
        articleSlug="artigo-teste"
        onDelete={noop}
        onReplyAdded={noop}
        onLikeToggled={noop}
      />
    </ul>,
  );
}

describe('CommentItem — feedback de erro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra alerta quando curtir falha', async () => {
    vi.mocked(commentService.toggleLike).mockRejectedValueOnce(
      new Error('boom'),
    );

    renderItem();
    fireEvent.click(screen.getByRole('button', { name: /curtir coment/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível registrar a curtida/i,
    );
  });

  it('mostra alerta quando enviar resposta falha', async () => {
    // Objeto vazio (sem response/message) → extractApiError cai no fallback.
    vi.mocked(commentService.add).mockRejectedValueOnce({});

    renderItem();
    // Botão "Responder" que abre o form (tem aria-expanded).
    fireEvent.click(
      screen.getByRole('button', { name: /responder/i, expanded: false }),
    );
    fireEvent.change(screen.getByLabelText(/escrever resposta/i), {
      target: { value: 'minha resposta' },
    });
    // Há 2 botões "Responder" (toggle + submit). O submit é o último no DOM.
    const replyButtons = screen.getAllByRole('button', {
      name: /^responder$/i,
    });
    fireEvent.click(replyButtons[replyButtons.length - 1]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível enviar a resposta/i,
    );
  });

  it('não mostra alerta no estado inicial', () => {
    renderItem();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('limpa o alerta quando uma nova curtida tem sucesso', async () => {
    vi.mocked(commentService.toggleLike)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        data: { liked: true, likes_count: 1 },
      } as Awaited<ReturnType<typeof commentService.toggleLike>>);

    renderItem();
    const likeBtn = screen.getByRole('button', { name: /curtir coment/i });

    fireEvent.click(likeBtn);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(likeBtn);
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
});
