/**
 * Testes do fluxo de paginação ("Ver mais comentários") de ArticleComments.
 *
 * Regressão: a API serve 20 comentários de topo por página, mas o componente
 * só carregava a 1ª página — o resto ficava inacessível. Estes testes cobrem:
 *  - botão "Ver mais" aparece só quando há próxima página (campo `next`);
 *  - clicar carrega a página seguinte e ANEXA os novos itens;
 *  - dedup por id: publicar um comentário desloca o offset do servidor, então
 *    a página seguinte pode repetir um item já em tela — não pode duplicar;
 *  - botão some quando `next` é null (fim da lista).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticleComments } from '../ArticleComments';
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

// Stub do CommentItem: evita arrastar suas deps (auth, like service). Só
// precisamos enxergar o conteúdo renderizado para asserções.
vi.mock('../../ui/CommentItem', () => ({
  CommentItem: ({ comment }: { comment: ApiComment }) => (
    <li data-testid="comment">{comment.content}</li>
  ),
}));

function makeComment(id: string, content: string): ApiComment {
  return {
    id,
    author: { id: 'u1', full_name: 'Autor', avatar: null, avatar_initial: 'A' },
    content,
    parent_id: null,
    created_at: '2026-05-28T00:00:00Z',
    likes_count: 0,
    is_liked: false,
    replies_count: 0,
    replies: [],
  };
}

const mockedList = vi.mocked(commentService.list);

function renderComments() {
  return render(
    <MemoryRouter>
      <ArticleComments slug="artigo-teste" currentUser={null} />
    </MemoryRouter>,
  );
}

describe('ArticleComments — paginação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra "Ver mais" quando a API indica próxima página', async () => {
    mockedList.mockResolvedValueOnce({
      data: {
        count: 3,
        next: 'http://x/?page=2',
        previous: null,
        results: [makeComment('a', 'comentário A')],
      },
    } as Awaited<ReturnType<typeof commentService.list>>);

    renderComments();

    expect(await screen.findByText('comentário A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ver mais coment/i }),
    ).toBeInTheDocument();
  });

  it('não mostra "Ver mais" quando next é null', async () => {
    mockedList.mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [makeComment('a', 'único')],
      },
    } as Awaited<ReturnType<typeof commentService.list>>);

    renderComments();

    expect(await screen.findByText('único')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ver mais coment/i }),
    ).not.toBeInTheDocument();
  });

  it('clicar em "Ver mais" anexa a próxima página com dedup por id', async () => {
    mockedList
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: 'http://x/?page=2',
          previous: null,
          results: [makeComment('a', 'A'), makeComment('b', 'B')],
        },
      } as Awaited<ReturnType<typeof commentService.list>>)
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: 'http://x/?page=1',
          // 'B' repetido (offset deslocado) + 'C' novo
          results: [makeComment('b', 'B'), makeComment('c', 'C')],
        },
      } as Awaited<ReturnType<typeof commentService.list>>);

    renderComments();

    await screen.findByText('A');
    fireEvent.click(screen.getByRole('button', { name: /ver mais coment/i }));

    // 'C' chega; 'B' não duplica; botão some (next=null na pág. 2)
    expect(await screen.findByText('C')).toBeInTheDocument();
    expect(screen.getAllByText('B')).toHaveLength(1);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /ver mais coment/i }),
      ).not.toBeInTheDocument(),
    );

    // Página 2 foi pedida com page=2
    expect(mockedList).toHaveBeenNthCalledWith(2, 'artigo-teste', {
      page: '2',
    });
  });
});
