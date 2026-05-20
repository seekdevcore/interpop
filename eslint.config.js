import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'backend']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // `set-state-in-effect` é error por padrão no React Hooks v7 / React Compiler,
      // mas o projeto usa o idiom "refetch quando filtros mudam" (URL params →
      // useEffect → setLoading(true) → fetch). Documentado em Admin/index.tsx:85-94.
      // Rebaixado para warning para não bloquear o pre-commit hook em código já
      // estável. Quando refatorarmos para TanStack Query (Sprint 4 do roadmap),
      // o problema some e a rule volta para error.
      'react-hooks/set-state-in-effect': 'warn',
      // `only-export-components` quebra com padrão React Context comum (hook
      // `useAuth` + component `AuthProvider` no mesmo arquivo). Quebrar em 2
      // arquivos é overkill — rebaixado para warn. Dev hot reload continua
      // funcionando, só dispara full reload em vez de fast refresh.
      'react-refresh/only-export-components': 'warn',
    },
  },
  // `prettier` por último: desabilita regras do ESLint que conflitam com a
  // formatação aplicada pelo Prettier. Evita lint warnings sobre coisa que
  // o Prettier já corrigiu (semi, indent, quotes etc.).
  prettier,
]);
