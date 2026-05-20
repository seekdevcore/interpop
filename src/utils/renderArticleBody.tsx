/**
 * Parser markdown leve para o corpo dos artigos do Interpop.
 *
 * Sintaxe (no início do parágrafo):
 *   > texto    → blockquote (citação em destaque, atribui ao autor)
 *   ## texto   → h2 (subtítulo de seção)
 *   (sem)      → parágrafo normal
 *
 * Bônus: 1º parágrafo (sem prefixo) ganha capitular (dropcap) automática.
 *
 * Reutilizado em duas superfícies para garantir paridade visual entre
 * o que o editor vê no preview do CreatePost e o que o leitor vê no /noticia:
 *   - src/pages/Article.tsx          (render final)
 *   - src/pages/CreatePost/index.tsx (preview ao vivo enquanto edita)
 *
 * Separadores: blocos = `\n\n` (linha em branco), seguindo convenção
 * markdown clássica.
 */
import type { ReactNode } from 'react';

export function renderArticleBody(
  body: string,
  authorName?: string,
): ReactNode[] {
  // Aceita CRLF (Windows), LF (Unix) e linhas "em branco" com espaços/tabs:
  // sem isso, copy-paste do Word/notepad gerava UM único parágrafo no preview.
  const paragraphs = body
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((para, i) => {
    // Citação em destaque
    if (para.startsWith('> ')) {
      const text = para.slice(2).trim();
      return (
        <blockquote key={i} className="article-quote">
          <p>"{text}"</p>
          {authorName && <cite>— {authorName}</cite>}
        </blockquote>
      );
    }
    // Subtítulo h2
    if (para.startsWith('## ')) {
      return (
        <h2 key={i} className="article-section-title">
          {para.slice(3).trim()}
        </h2>
      );
    }
    // Capitular automática no primeiro parágrafo
    if (i === 0 && para.length > 0) {
      return (
        <p key={i}>
          <span className="article-dropcap">{para[0]}</span>
          {para.slice(1)}
        </p>
      );
    }
    return <p key={i}>{para}</p>;
  });
}
