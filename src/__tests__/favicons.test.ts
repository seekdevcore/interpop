/**
 * Regressão dos favicons e ícones PWA servidos de public/.
 *
 * Todo ícone citado no index.html e no site.webmanifest precisa existir, ter
 * o tamanho declarado e seguir a regra da plataforma:
 * - apple-touch-icon e ícone maskable sem transparência (iOS e Android
 *   pintam a área transparente de preto);
 * - favicon.ico com 16, 32 e 48 px;
 * - interpop-icon.svg só com formas: favicon SVG não carrega web font, então
 *   um <text> cairia na fonte do sistema e mudaria o desenho.
 *
 * Os arquivos entram via `?raw` / `?inline` do Vite (sem node:fs), porque o
 * tsconfig do app só expõe os tipos de vite/client.
 */
import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';
import manifestRaw from '../../public/site.webmanifest?raw';
import iconSvg from '../../public/interpop-icon.svg?raw';

const PUBLIC = '../../public/';
const publicFiles = new Set(
  Object.keys(import.meta.glob('../../public/*')).map((k) =>
    k.slice(PUBLIC.length),
  ),
);
const binaries = import.meta.glob('../../public/*.{png,ico}', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function bytes(file: string): Uint8Array {
  const dataUrl = binaries[PUBLIC + file];
  if (!dataUrl) throw new Error(`arquivo ausente: public/${file}`);
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

interface PngInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
}

function readPng(file: string): PngInfo {
  const b = bytes(file);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect(Array.from(b.slice(0, 8)), `${file} não é PNG`).toEqual(signature);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks = new Set<string>();
  for (let off = 8; off + 8 <= b.length; off += 12 + dv.getUint32(off)) {
    chunks.add(String.fromCharCode(...b.slice(off + 4, off + 8)));
  }
  const colorType = b[25]; // 4 = cinza+alfa, 6 = RGBA
  return {
    width: dv.getUint32(16),
    height: dv.getUint32(20),
    hasAlpha: colorType === 4 || colorType === 6 || chunks.has('tRNS'),
  };
}

/** Caminho do href ("/x.png?v=2") → nome do arquivo em public/. */
const toPublic = (href: string) =>
  href.replace(/^\//, '').replace(/[?#].*$/, '');

describe('ícones citados no index.html', () => {
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
  const links = Array.from(
    doc.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]',
    ),
  );

  it('declara SVG, PNG, ICO, apple-touch-icon e manifest', () => {
    const hrefs = links.map((l) => toPublic(l.getAttribute('href') ?? ''));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'interpop-icon.svg',
        'favicon-96x96.png',
        'favicon.ico',
        'apple-touch-icon.png',
        'site.webmanifest',
      ]),
    );
  });

  it.each(
    links.map((l) => [l.getAttribute('rel'), l.getAttribute('href') ?? '']),
  )('%s → %s existe em public/', (_rel, href) => {
    expect(publicFiles.has(toPublic(href))).toBe(true);
  });

  it('apple-touch-icon é PNG 180×180 sem transparência', () => {
    expect(readPng('apple-touch-icon.png')).toEqual({
      width: 180,
      height: 180,
      hasAlpha: false,
    });
  });

  it('favicon-96x96.png tem 96×96', () => {
    expect(readPng('favicon-96x96.png')).toMatchObject({
      width: 96,
      height: 96,
    });
  });

  it('favicon.ico traz 16, 32 e 48 px', () => {
    const b = bytes('favicon.ico');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    expect(dv.getUint16(0, true)).toBe(0); // reservado
    expect(dv.getUint16(2, true)).toBe(1); // tipo 1 = ícone
    const sizes = Array.from({ length: dv.getUint16(4, true) }, (_, i) => {
      const w = b[6 + 16 * i] || 256;
      const h = b[7 + 16 * i] || 256;
      return `${w}x${h}`;
    });
    expect(sizes.sort()).toEqual(['16x16', '32x32', '48x48']);
  });
});

describe('ícones do site.webmanifest', () => {
  const manifest = JSON.parse(manifestRaw) as {
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };

  it.each(manifest.icons.map((i) => [i.src, i.sizes, i.purpose]))(
    '%s existe e tem %s (purpose %s)',
    (src, sizes) => {
      const [w, h] = sizes.split('x').map(Number);
      expect(readPng(toPublic(src))).toMatchObject({ width: w, height: h });
    },
  );

  it('tem 192 e 512 "any" e um único maskable 512 sem transparência', () => {
    const any = manifest.icons
      .filter((i) => i.purpose === 'any')
      .map((i) => i.sizes);
    expect(any).toEqual(expect.arrayContaining(['192x192', '512x512']));
    const maskable = manifest.icons.filter((i) =>
      i.purpose.split(' ').includes('maskable'),
    );
    expect(maskable).toHaveLength(1);
    expect(maskable[0].sizes).toBe('512x512');
    expect(readPng(toPublic(maskable[0].src)).hasAlpha).toBe(false);
  });
});

describe('interpop-icon.svg', () => {
  it('é quadrado e só usa formas, sem texto, fonte ou recurso externo', () => {
    expect(iconSvg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(iconSvg).not.toMatch(/<text|font-family|@font-face/i);
    expect(iconSvg).not.toMatch(/\bhref=|url\(\s*['"]?(https?:|\/\/)/i);
  });
});
