#!/usr/bin/env node
/**
 * Guarda do bundle: o MSW (mock da API no navegador) só pode existir no
 * build demo (`npm run build:demo`, publicado no Render para o design).
 * No build de produção (`npm run build`, Hostinger) ele NÃO pode entrar:
 * um service worker interceptando /api/* em produção esconderia o backend real.
 *
 * Uso (depois do build correspondente):
 *   node scripts/check-msw-bundle.mjs --expect absent    # após npm run build
 *   node scripts/check-msw-bundle.mjs --expect present   # após npm run build:demo
 *
 * Assinatura procurada: a string literal `mockServiceWorker.js`, que o
 * main.tsx passa para worker.start() e que sobrevive à minificação. Ela só
 * fica no bundle se o ramo que liga o MSW não for eliminado como código morto.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SIGNATURE = 'mockServiceWorker.js';
const ASSETS_DIR = path.resolve('dist/assets');

const flagIndex = process.argv.indexOf('--expect');
const expected = flagIndex === -1 ? undefined : process.argv[flagIndex + 1];
if (expected !== 'absent' && expected !== 'present') {
  console.error('uso: check-msw-bundle.mjs --expect absent|present');
  process.exit(2);
}

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listJs(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

let files;
try {
  files = listJs(ASSETS_DIR);
} catch {
  console.error(
    `dist/assets não encontrado — rode o build antes (${ASSETS_DIR})`,
  );
  process.exit(2);
}

const hits = files.filter((f) => readFileSync(f, 'utf8').includes(SIGNATURE));
const found = hits.length > 0;

if (expected === 'absent' && found) {
  console.error(
    `FALHA: MSW encontrado no build de produção:\n  ${hits.join('\n  ')}`,
  );
  process.exit(1);
}
if (expected === 'present' && !found) {
  console.error(
    'FALHA: build demo sem MSW — o site do Render ficaria sem API.',
  );
  process.exit(1);
}
console.log(
  `ok: MSW ${found ? 'presente' : 'ausente'} no bundle (${files.length} arquivos .js verificados)`,
);
