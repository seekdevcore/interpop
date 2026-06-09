/**
 * Campo de busca — `role="search"` no form, `<input type="search">` no
 * controle. NÃO usa `role="combobox"` (Bug 5 / ADR-028 / APG):
 * combobox exige listbox controlado, e a busca editorial é "input + lista
 * in-page", não overlay com sugestões.
 *
 * URL é SSOT (DESIGN-v3 §2.5): cada keystroke atualiza `?q=` via
 * `replace: true` (sem entupir histórico). O debounce vive no hook
 * `useSearch`, então este componente é controlado e sincronizado com a
 * URL imediatamente — sem state local intermediário.
 */
import { useEffect, useRef } from 'react';
import { useSearchParamsState } from '../hooks/useSearchParamsState';
import './SearchInput.css';

interface SearchInputProps {
  /**
   * Auto-foca no mount (default: true). Usuário entrando direto em
   * `/buscar?q=` ainda recebe foco no input (preserva expectativa).
   * Desativar quando o foco precisa ficar em outro elemento (ex.: testes).
   */
  autoFocus?: boolean;
}

export function SearchInput({ autoFocus = true }: SearchInputProps) {
  const { state, setQ } = useSearchParamsState();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Enter no input commit-a com `push: true` — entrada no histórico
    // para o usuário poder voltar à busca anterior via back-button.
    event.preventDefault();
    setQ(state.q, { push: true });
  };

  const hasValue = state.q.length > 0;

  return (
    <form
      role="search"
      className="search-input"
      onSubmit={handleSubmit}
      // action/method para fallback no-JS (RR7 não navega, mas degrada).
      action="/buscar"
      method="get"
    >
      <label htmlFor="search-q" className="search-input__label">
        Buscar artigos
      </label>
      <div className="search-input__field">
        <span aria-hidden="true" className="search-input__icon">
          {/* SVG inline pequeno; sem dep externa. */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          ref={inputRef}
          id="search-q"
          name="q"
          type="search"
          // SEM role="combobox", SEM aria-expanded — ADR-028.
          autoComplete="off"
          spellCheck
          enterKeyHint="search"
          aria-describedby="search-q-help"
          placeholder="Buscar artigos…"
          value={state.q}
          onChange={(e) => setQ(e.target.value)}
          className="search-input__control"
        />
        {hasValue && (
          <button
            type="button"
            className="search-input__clear"
            onClick={() => setQ('')}
            aria-label="Limpar busca"
          >
            ×
          </button>
        )}
      </div>
      <span id="search-q-help" className="search-input__hint">
        Digite ao menos 2 caracteres. Resultados aparecem abaixo.
      </span>
    </form>
  );
}
