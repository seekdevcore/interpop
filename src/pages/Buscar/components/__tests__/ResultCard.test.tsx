/**
 * Spec: T30.1.17 (ResultCard thumb-left 120×80) + ADR-030-UI.
 *
 * Foco TDD:
 *   - Dimensões explícitas no <img> (width/height attrs) — anti-CLS.
 *   - Sem cover: placeholder por letra inicial da editoria.
 *   - <time dateTime={iso}> com texto formatado pt-BR.
 *   - Title é um <a href="/noticia/:slug"> (landmark do card).
 *   - Highlight de title e excerpt usa `query_terms_expanded`.
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { ResultCard } from '../ResultCard';
import type { SearchResultItem } from '../../types';

const baseItem: SearchResultItem = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Como o kpop reinventou a indústria',
  slug: 'kpop-industria',
  excerpt: 'O kpop hoje move mais playlists que muitas gravadoras locais.',
  published_at: '2026-05-20T10:00:00Z',
  author: { id: 'a1', name: 'João Silva' },
  category: { id: 1, name: 'Música', slug: 'musica' },
  cover_url: 'https://cdn.interpop.com/article-1.webp',
  score: 0.42,
};

function renderCard(item = baseItem, terms: string[] = ['kpop']) {
  return render(
    <MemoryRouter>
      <ResultCard item={item} terms={terms} />
    </MemoryRouter>,
  );
}

describe('ResultCard — thumb-left 120×80 (ADR-030-UI)', () => {
  it('renderiza <img> com width=120 height=80 (anti-CLS)', () => {
    const { container } = renderCard();
    // alt="" remove a img da accessibility tree (presentational), por isso
    // não usamos getByRole — buscamos diretamente o nó HTML para verificar
    // as dimensões reservadas anti-layout-shift.
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('width', '120');
    expect(img).toHaveAttribute('height', '80');
  });

  it('<img> tem loading="lazy" e alt="" (decorativo; título é o landmark)', () => {
    const { container } = renderCard();
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', '');
  });

  it('sem cover_url renderiza placeholder com letra inicial da editoria', () => {
    const { container } = renderCard({ ...baseItem, cover_url: null });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('result-card-placeholder')).toHaveTextContent(
      'M',
    );
  });

  it('sem cover E sem category renderiza letra "?" como último recurso', () => {
    renderCard({ ...baseItem, cover_url: null, category: null });
    expect(screen.getByTestId('result-card-placeholder')).toHaveTextContent(
      '?',
    );
  });
});

describe('ResultCard — link e metadados', () => {
  it('título envolve link para /noticia/:slug', () => {
    renderCard();
    const link = screen.getByRole('link', { name: /kpop reinventou/i });
    expect(link).toHaveAttribute('href', '/noticia/kpop-industria');
  });

  it('renderiza <time dateTime={iso}> com data pt-BR', () => {
    renderCard();
    const time = screen.getByText(/2026/i, { selector: 'time' });
    expect(time).toHaveAttribute('datetime', '2026-05-20T10:00:00Z');
  });

  it('exibe autor e editoria no rodapé do card', () => {
    renderCard();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Música')).toBeInTheDocument();
  });

  it('elide editoria quando ausente (category === null)', () => {
    renderCard({ ...baseItem, category: null });
    // Não deve render "Música" nem similar.
    expect(screen.queryByText('Música')).toBeNull();
  });
});

describe('ResultCard — highlight integrado', () => {
  it('passa terms para HighlightedText do título', async () => {
    const { container } = renderCard(baseItem, ['kpop']);
    await new Promise((r) => setTimeout(r, 0));
    // mark.js insere <mark> dentro do título.
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
  });
});
