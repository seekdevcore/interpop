/**
 * Estado inicial — antes do usuário digitar (q < 2 chars).
 *
 * NÃO é "nenhum resultado encontrado" (esse é EmptyResults). Aqui o
 * propósito é orientar: "como uso essa página?". Texto curto em pt-BR,
 * sem ilustração pesada — busca editorial é ferramenta, não cerimônia.
 */
export function EmptyState() {
  return (
    <div className="search-state search-state--empty" role="status">
      <p className="search-state__headline">
        Digite ao menos 2 caracteres para buscar artigos.
      </p>
      <p className="search-state__hint">
        Procure por artistas, álbuns, filmes, livros ou conceitos — encontramos
        no acervo Interpop.
      </p>
    </div>
  );
}
