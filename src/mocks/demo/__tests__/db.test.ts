/**
 * Banco em memória do site demo: persistência no navegador, reset, sessão
 * e slug no formato do Django (`slugify(allow_unicode=True)`).
 */
import { describe, expect, it } from 'vitest';
import { createDemoDb, slugify, DEMO_ACCOUNTS } from '@/mocks/demo/db';

/** Storage em memória com a mesma interface que o db usa do localStorage. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe('createDemoDb', () => {
  it('nasce com o seed: 12 publicados + 2 rascunhos, contas demo existem', () => {
    const db = createDemoDb({ storage: null });
    const published = db.state.articles.filter((a) => a.status === 'published');
    expect(published).toHaveLength(12);
    expect(db.state.articles).toHaveLength(14);
    for (const acc of DEMO_ACCOUNTS) {
      expect(db.findUserByEmail(acc.email)?.role).toBe(acc.role);
    }
  });

  it('persiste mudanças e sessão entre instâncias (recarregar a página)', () => {
    const storage = memoryStorage();
    const a = createDemoDb({ storage });
    a.state.articles[0].title = 'Título alterado';
    a.setSession(a.state.users[0].id);
    a.save();

    const b = createDemoDb({ storage });
    expect(b.state.articles[0].title).toBe('Título alterado');
    expect(b.currentUser()?.id).toBe(a.state.users[0].id);
  });

  it('reset volta ao seed e encerra a sessão', () => {
    const storage = memoryStorage();
    const db = createDemoDb({ storage });
    db.state.articles.splice(0, 5);
    db.setSession(db.state.users[0].id);
    db.save();
    db.reset();
    expect(db.state.articles).toHaveLength(14);
    expect(db.currentUser()).toBeNull();
    expect(createDemoDb({ storage }).state.articles).toHaveLength(14);
  });

  it('dado salvo de outra versão do seed é descartado', () => {
    const storage = memoryStorage();
    storage.setItem(
      'interpop-demo:db',
      JSON.stringify({ version: -1, articles: [] }),
    );
    expect(createDemoDb({ storage }).state.articles).toHaveLength(14);
  });

  it('JSON corrompido no storage não derruba o site', () => {
    const storage = memoryStorage();
    storage.setItem('interpop-demo:db', '{quebrado');
    expect(createDemoDb({ storage }).state.articles).toHaveLength(14);
  });

  it('URLs blob: (uploads) não sobrevivem ao reload', () => {
    const storage = memoryStorage();
    const a = createDemoDb({ storage });
    a.state.articles[0].cover_image = 'blob:http://x/123';
    a.state.users[0].avatar = 'blob:http://x/456';
    a.save();
    const b = createDemoDb({ storage });
    expect(b.state.articles[0].cover_image).toBeNull();
    expect(b.state.users[0].avatar).toBeNull();
  });

  it('storage que lança (modo privado, cota) cai para memória', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const db = createDemoDb({ storage: throwing });
    expect(() => db.save()).not.toThrow();
    expect(db.state.articles).toHaveLength(14);
  });

  it('subscribe avisa em setSession, save e reset; o retorno cancela', () => {
    const db = createDemoDb({ storage: null });
    let calls = 0;
    const off = db.subscribe(() => calls++);
    db.setSession(db.state.users[0].id);
    db.save();
    db.reset();
    expect(calls).toBe(3);
    off();
    db.setSession(null);
    expect(calls).toBe(3);
  });

  it('uniqueSlug acrescenta -1, -2 quando o slug já existe', () => {
    const db = createDemoDb({ storage: null });
    const taken = db.state.articles[0].slug;
    expect(db.uniqueSlug(db.state.articles[0].title)).toBe(`${taken}-1`);
  });
});

describe('slugify (espelho do Django allow_unicode=True)', () => {
  it.each([
    ['Ação & Reação: o pop coreano', 'ação-reação-o-pop-coreano'],
    ['  K-pop  e   soft power ', 'k-pop-e-soft-power'],
    ['Música', 'música'],
    ['Por quê? 100%!', 'por-quê-100'],
    ['--já--', 'já'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
