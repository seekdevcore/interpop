/**
 * Realça stems de `query_terms_expanded` em um trecho de texto editorial.
 *
 * Por que existe (ADR-022): o backend NÃO devolve HTML com <mark>; manda
 * o texto plano + a lista de stems pt-BR (expandidos via `ts_lexize`).
 * O highlight é responsabilidade da UI — assim podemos pintar tanto o
 * título quanto o excerpt com as MESMAS regras sem inflar o payload.
 *
 * Por que mark.js e não regex manual:
 *   - mark.js percorre apenas nós de TEXTO via `Range`/`Node.splitText`.
 *     Como nunca toca `innerHTML`, é impossível um termo virar tag
 *     executável (vide testes `XSS hardening`). Isso fecha o cenário do
 *     SECURITY-REVIEW §3.4.
 *   - `accuracy: 'complementary'` permite que o stem 'cantor' case
 *     'cantores', 'cantoras' etc. — exatamente o que o backend espera
 *     porque os termos vêm pós-`ts_lexize` (Invariant #11).
 *   - `separateWordSearch: false` impede que um termo composto seja
 *     dividido em pedaços e gere matches falsos.
 *
 * Implementação intencionalmente mínima:
 *   - Render um `<span ref>` (inline, não quebra fluxo do título).
 *   - Em cada mudança de `text`/`terms`, faz `unmark` e remarca.
 *     Chave do effect inclui `terms.join('|')` para evitar reaplicar
 *     quando o array é nova referência mas mesmo conteúdo.
 *   - StrictMode roda effect 2× em dev — `unmark` na primeira passagem
 *     garante que não acumulamos <mark> aninhados.
 */
import { useEffect, useRef } from 'react';
import Mark from 'mark.js';

interface HighlightedTextProps {
  /** Texto plano (título, excerpt). */
  text: string;
  /**
   * Stems vindos de `query_terms_expanded` do backend. Pode ser undefined
   * (carregando) ou vazio (sem busca ativa).
   */
  terms: string[] | undefined;
  /** Permite que pais marquem o nó para testes. */
  'data-testid'?: string;
}

export function HighlightedText({
  text,
  terms,
  'data-testid': testId,
}: HighlightedTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // Chave estável do array — evita rodar effect quando pai renderiza
  // novo array com mesmo conteúdo.
  const termsKey = terms?.join('|') ?? '';

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const instance = new Mark(node);
    // Sempre desmarca primeiro: cobre re-render do StrictMode e troca de
    // termos em buscas sucessivas (sem isto, marca dentro de marca).
    instance.unmark({
      done: () => {
        if (!terms || terms.length === 0) return;
        instance.mark(terms, {
          accuracy: 'complementary',
          separateWordSearch: false,
          // ADR-022: mark.js renderiza <mark> nativo; o estilo vem do CSS
          // global (--clr-highlight-bg / --clr-highlight-on) — sem inline.
        });
      },
    });
    // text é dependência explícita: se o trecho mudar (paginação, refetch),
    // remarca em cima do novo conteúdo.
  }, [text, termsKey, terms]);

  return (
    <span ref={ref} data-testid={testId}>
      {text}
    </span>
  );
}
