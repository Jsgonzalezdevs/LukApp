/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

const manifest = JSON.parse(leer('public/ecosistema.webmanifest'));
const sw = leer('public/sw.js');
const html = leer('index.html');

describe('manifest', () => {
  it('declares what a browser needs before it offers to install', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/app');
    expect(manifest.display).toBe('standalone');
  });

  it('points at icons that actually exist', () => {
    for (const icono of manifest.icons) {
      expect(existsSync(resolve(raiz, 'public', icono.src.slice(1)))).toBe(true);
    }
  });

  it('includes a maskable icon, or Android crops the artwork', () => {
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('has the 192 and 512 sizes install prompts require', () => {
    const tamanos = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
  });

  it('is linked from the page, not merely present in the folder', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/ecosistema.webmanifest');
  });

  it('keeps the apple-touch-icon, which iOS uses instead of the manifest', () => {
    expect(html).toContain('apple-touch-icon');
  });

  /* Durante un tiempo el HTML apuntó a /finanzas-icon-*.png, que nunca
     existieron: el navegador pedía el icono, se comía un 404 y caía al
     genérico. Nada fallaba en voz alta, así que aquí se comprueba que cada
     ruta local del <head> exista de verdad en public/. */
  it('only references icons that exist in public/', () => {
    const rutas = [...html.matchAll(/href="(\/[^"]+\.(?:png|svg|ico))"/g)].map((m) => m[1]);
    expect(rutas.length).toBeGreaterThan(0);
    for (const ruta of rutas) {
      expect(existsSync(resolve(raiz, 'public', ruta.slice(1)))).toBe(true);
    }
  });
});

describe('service worker', () => {
  it('never caches the API, Supabase or auth', () => {
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain("url.hostname.endsWith('.supabase.co')");
    expect(sw).toContain("url.pathname.includes('/auth/')");
  });

  it('never caches the manifest or icons across revisions', () => {
    expect(sw).toContain("url.pathname.endsWith('.webmanifest')");
  });
});
