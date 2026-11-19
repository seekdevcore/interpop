/**
 * Ícones do editor de publicação.
 *
 * Regressão: "← Painel Admin", "✏️ Editar", "👁 Prévia", o 🖼️ da área de
 * upload e o ✕ de remover capa eram glifos no texto. A seta e os emojis
 * entravam no nome acessível dos botões. Agora são SVG do lucide-react com
 * aria-hidden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import articleService from '@/services/articleService';
import { CreatePost } from '../index';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/articleService', () => ({
  default: {
    getCachedCategories: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const GLYPH = /\p{Extended_Pictographic}|[←↪✕]/u;

function expectDecorativeSvg(el: Element | null, what: string) {
  const svg = el?.querySelector('svg');
  expect(svg, `${what} sem ícone SVG`).not.toBeNull();
  expect(svg).toHaveAttribute('aria-hidden', 'true');
}

function renderPage(editingSlug?: string) {
  return render(
    <MemoryRouter>
      <CreatePost editingSlug={editingSlug} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    currentUser: { full_name: 'Ana Souza', role: 'editor' },
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(articleService.getCachedCategories).mockResolvedValue([
    { id: 1, name: 'Música', slug: 'musica' },
  ] as never);
});

describe('CreatePost — ícones', () => {
  it('voltar ao painel tem nome "Painel Admin" e ícone SVG', async () => {
    renderPage();
    const back = await screen.findByRole('button', { name: 'Painel Admin' });
    expect(back.textContent).not.toMatch(GLYPH);
    expectDecorativeSvg(back, 'Painel Admin');
  });

  it('alternância Prévia/Editar sem emoji, com ícone nos dois estados', async () => {
    renderPage();
    const toPreview = await screen.findByRole('button', { name: 'Prévia' });
    expectDecorativeSvg(toPreview, 'Prévia');

    fireEvent.click(toPreview);
    const toEdit = screen.getByRole('button', { name: 'Editar' });
    expectDecorativeSvg(toEdit, 'Editar');
  });

  it('área de upload da capa usa ícone SVG, sem o emoji 🖼️', async () => {
    renderPage();
    const dropzone = await screen.findByRole('button', {
      name: /arraste uma imagem/,
    });
    expect(dropzone.textContent).not.toMatch(GLYPH);
    expectDecorativeSvg(dropzone, 'dropzone');
  });

  it('remover capa mantém o aria-label e troca o ✕ por ícone SVG', async () => {
    vi.mocked(articleService.get).mockResolvedValue({
      data: {
        title: 'Título',
        excerpt: 'Resumo',
        body: 'Corpo',
        category: { id: 1, name: 'Música', slug: 'musica' },
        cover_caption: 'Legenda',
        is_featured: false,
        cover_image: 'https://example.com/capa.jpg',
      },
    } as never);
    renderPage('um-artigo');

    const remove = await screen.findByRole('button', {
      name: 'Remover imagem de capa',
    });
    expect(remove.textContent).not.toMatch(GLYPH);
    expectDecorativeSvg(remove, 'remover capa');
  });
});
