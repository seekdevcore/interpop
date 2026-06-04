/**
 * FilterChips — shell do MVP (Sprint 4).
 *
 * Hoje: lê filtros da URL (`author`, `category`, `de`, `ate`) e renderiza
 * 1 chip por filtro presente + botão "Remover" que limpa o param. Estado
 * vazio anuncia "Sem filtros ativos" para o usuário ter feedback claro de
 * que a busca não está restringida.
 *
 * Sprint 5 (F-31): plugar popover de seleção (author multiselect, category
 * dropdown, date range picker) e overlay mobile. A infra visual fica
 * pronta aqui — radius-md (ADR-030-UI: NÃO full-rounded), tokens
 * --clr-chip-* dark-mode-ready.
 *
 * Nota de a11y: cada chip é um <button> com aria-pressed; o leitor de
 * tela anuncia "filtro X ativado". Quando os popovers entrarem em S5, o
 * mesmo <button> ganha `aria-haspopup` e `aria-expanded`.
 */
import { useSearchParams } from 'react-router-dom';

type FilterKey = 'author' | 'category' | 'dateRange';

interface ActiveFilter {
  key: FilterKey;
  label: string;
  /** Params da URL que esta chip controla (remover = deletar todos). */
  paramsToClear: string[];
}

function collectActiveFilters(params: URLSearchParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [];

  const author = params.get('author');
  if (author) {
    filters.push({
      key: 'author',
      label: `Autor: ${author}`,
      paramsToClear: ['author'],
    });
  }

  const category = params.get('category');
  if (category) {
    // Sprint 5: resolver `category=1` para "Música" via lookup. MVP só ID.
    filters.push({
      key: 'category',
      label: `Editoria: ${category}`,
      paramsToClear: ['category'],
    });
  }

  const de = params.get('de');
  const ate = params.get('ate');
  if (de || ate) {
    const fromTo =
      de && ate ? `de ${de} ate ${ate}` : de ? `desde ${de}` : `ate ${ate}`;
    filters.push({
      key: 'dateRange',
      label: fromTo,
      // Limpa AMBOS de uma vez — semântica de range único.
      paramsToClear: ['de', 'ate'],
    });
  }

  return filters;
}

export function FilterChips() {
  const [params, setParams] = useSearchParams();
  const active = collectActiveFilters(params);

  const removeFilter = (paramsToClear: string[]) => {
    const next = new URLSearchParams(params);
    paramsToClear.forEach((p) => next.delete(p));
    setParams(next, { replace: true });
  };

  if (active.length === 0) {
    return (
      <div className="filter-chips filter-chips--empty" aria-live="polite">
        <span className="filter-chips__empty-label">Sem filtros ativos</span>
      </div>
    );
  }

  return (
    <ul
      className="filter-chips"
      aria-label="Filtros aplicados"
      // Lista semântica; chips são <li><button>.
    >
      {active.map((f) => (
        <li key={f.key} className="filter-chip-item">
          <button
            type="button"
            className="filter-chip"
            aria-pressed="true"
            aria-label={`Remover filtro: ${f.label}`}
            onClick={() => removeFilter(f.paramsToClear)}
          >
            <span className="filter-chip__label">{f.label}</span>
            <span aria-hidden="true" className="filter-chip__x">
              ×
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
