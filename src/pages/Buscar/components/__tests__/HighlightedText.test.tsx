/**
 * Spec: T30.1.X10 (HighlightedText) + ADR-022 (highlight client-side).
 *
 * Foco TDD:
 *   - Sem termos → renderiza texto puro, zero mutação no DOM.
 *   - Match: stems `query_terms_expanded` viram <mark> ao redor do match.
 *   - XSS hardening: termo malicioso `<script>` NÃO injeta nó <script>;
 *     mark.js escapa porque opera via Range + Node.splitText (refs DOM,
 *     não innerHTML). Esta é a razão de existir do componente — testado
 *     explicitamente.
 *   - Reativo: trocar `terms` re-aplica highlights.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { HighlightedText } from '../HighlightedText';

describe('HighlightedText — render base', () => {
  it('renderiza o texto puro quando terms está vazio', () => {
    const { container } = render(
      <HighlightedText text="Como o kpop reinventou a indústria" terms={[]} />,
    );
    expect(container.textContent).toBe('Como o kpop reinventou a indústria');
    expect(container.querySelectorAll('mark').length).toBe(0);
  });

  it('renderiza o texto puro quando terms é undefined', () => {
    const { container } = render(
      <HighlightedText text="texto qualquer" terms={undefined} />,
    );
    expect(container.textContent).toBe('texto qualquer');
    expect(container.querySelectorAll('mark').length).toBe(0);
  });
});

describe('HighlightedText — match + <mark>', () => {
  it('envolve match em <mark> quando termo é igual', async () => {
    const { container } = render(
      <HighlightedText text="o cantor brilhou" terms={['cantor']} />,
    );
    // mark.js é async (varre DOM em microtasks); aguarda 1 tick.
    await new Promise((r) => setTimeout(r, 0));
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent?.toLowerCase()).toContain('cantor');
  });

  it('aplica accuracy=complementary (stems pt-BR casam prefixo)', async () => {
    // accuracy 'complementary' permite match parcial — stem 'cantor' casa
    // 'cantora', 'cantores', 'cantando'. Isto é o que torna o highlight
    // útil com `query_terms_expanded` (ts_lexize, Invariant #11).
    const { container } = render(
      <HighlightedText text="As cantoras se uniram" terms={['cantor']} />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
  });
});

describe('HighlightedText — XSS hardening (ADR-022)', () => {
  it('termo malicioso "<script>" NÃO insere <script> no DOM', async () => {
    const { container } = render(
      <HighlightedText
        text="texto inofensivo aqui"
        terms={['<script>alert(1)</script>']}
      />,
    );
    await new Promise((r) => setTimeout(r, 0));
    // mark.js opera em nós de texto via Range.surroundContents — não há
    // como o termo virar tag executável. Sanity check definitivo:
    expect(container.querySelector('script')).toBeNull();
  });

  it('texto com markup-like NÃO é interpretado como HTML', async () => {
    const { container } = render(
      <HighlightedText
        text="<img onerror=alert(1)> kpop é arte"
        terms={['kpop']}
      />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('img')).toBeNull();
    // O texto inteiro continua presente, exatamente como string.
    expect(container.textContent).toContain('<img onerror=alert(1)>');
  });
});

describe('HighlightedText — semântica de acessibilidade', () => {
  it('renderiza um <span> raíz (inline, não quebra layout do título)', () => {
    render(
      <HighlightedText text="hello" terms={['hello']} data-testid="ht-root" />,
    );
    const root = screen.getByTestId('ht-root');
    expect(root.tagName).toBe('SPAN');
  });
});
