/**
 * "Banco" do site demo: estado em memória, salvo no localStorage do
 * navegador de quem visita (cada designer tem o seu; nada vai para servidor).
 *
 * - Sobrevive a reload e a nova aba; "Resetar dados" (painel demo) volta ao
 *   seed. Mudança de DATA_VERSION descarta o que estava salvo.
 * - A "sessão" (quem está logado) é um id salvo aqui, no lugar dos cookies
 *   JWT httpOnly do backend real.
 * - Imagens enviadas viram URL `blob:` (só valem até recarregar a página):
 *   guardar o arquivo em base64 estouraria a cota de ~5 MB do localStorage.
 * - Storage indisponível (modo privado, cota cheia) → segue só em memória.
 */
import {
  buildSeed,
  DATA_VERSION,
  type DemoState,
  type DemoUser,
} from './fixtures';

export { DEMO_ACCOUNTS } from './fixtures';

export const DB_KEY = 'interpop-demo:db';
export const SESSION_KEY = 'interpop-demo:session';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Espelho de `django.utils.text.slugify(value, allow_unicode=True)`. */
export function slugify(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function safeGet(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // cota cheia / modo privado: o estado continua valendo em memória
  }
}

function safeRemove(storage: StorageLike | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // idem
  }
}

const dropBlob = (url: string | null) =>
  url && url.startsWith('blob:') ? null : url;

function load(storage: StorageLike | null): DemoState | null {
  const raw = safeGet(storage, DB_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as DemoState;
    if (state?.version !== DATA_VERSION) return null;
    state.articles.forEach((a) => (a.cover_image = dropBlob(a.cover_image)));
    state.users.forEach((u) => (u.avatar = dropBlob(u.avatar)));
    return state;
  } catch {
    return null;
  }
}

export interface DemoDbOptions {
  storage: StorageLike | null;
  now?: () => number;
}

export function createDemoDb({ storage, now = Date.now }: DemoDbOptions) {
  let state: DemoState = load(storage) ?? buildSeed(now(), slugify);
  let sessionUserId: string | null = safeGet(storage, SESSION_KEY);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  const db = {
    get state() {
      return state;
    },

    save() {
      safeSet(storage, DB_KEY, JSON.stringify(state));
      notify();
    },

    /** Para o painel demo acompanhar login/logout feitos pelo app. */
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    reset() {
      state = buildSeed(now(), slugify);
      sessionUserId = null;
      safeRemove(storage, SESSION_KEY);
      db.save();
    },

    setSession(userId: string | null) {
      sessionUserId = userId;
      if (userId) safeSet(storage, SESSION_KEY, userId);
      else safeRemove(storage, SESSION_KEY);
      notify();
    },

    currentUser(): DemoUser | null {
      if (!sessionUserId) return null;
      return state.users.find((u) => u.id === sessionUserId) ?? null;
    },

    findUser(id: string) {
      return state.users.find((u) => u.id === id) ?? null;
    },

    findUserByEmail(email: string) {
      const e = email.trim().toLowerCase();
      return state.users.find((u) => u.email.toLowerCase() === e) ?? null;
    },

    /** Slug do Django + sufixo `-1`, `-2`… quando já existe (500 chars). */
    uniqueSlug(title: string, ignoreId?: string) {
      const base = slugify(title).slice(0, 500) || 'artigo';
      const taken = (s: string) =>
        state.articles.some((a) => a.slug === s && a.id !== ignoreId);
      let slug = base;
      for (let n = 1; taken(slug); n++) slug = `${base}-${n}`;
      return slug;
    },

    nowIso() {
      return new Date(now()).toISOString();
    },

    now,
  };
  return db;
}

export type DemoDb = ReturnType<typeof createDemoDb>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}

/** Instância única usada pelos handlers do MSW (e pelo painel demo). */
export const demoDb = createDemoDb({ storage: browserStorage() });
