/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VERSION, VERSION_ETIQUETA } from './version';
import { NOVEDADES, VERSION_ACTUAL } from './features/lukapp/novedades';

/* Este archivo es el candado del versionado. La regla está escrita en
   src/version.ts y en CLAUDE.md, pero una regla escrita se olvida: subir la
   versión son tres sitios, y con esto es imposible subirla a medias. */

const paquete = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { version: string };

describe('versión', () => {
  it('usa el formato V0.0.0 y nada más', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VERSION_ETIQUETA).toBe(`v${VERSION}`);
  });

  it('dice lo mismo en package.json que en el código', () => {
    expect(paquete.version).toBe(VERSION);
  });

  it('tiene su entrada de novedades arriba del todo', () => {
    expect(NOVEDADES[0].version).toBe(VERSION);
    expect(VERSION_ACTUAL).toBe(VERSION);
  });

  it('no repite ni desordena versiones en el historial', () => {
    const numeros = NOVEDADES.map((n) => n.version.split('.').map(Number));
    expect(new Set(NOVEDADES.map((n) => n.version)).size).toBe(NOVEDADES.length);
    // El historial va de más nueva a más vieja, así que cada entrada tiene que
    // ser estrictamente menor que la de arriba.
    for (let i = 1; i < numeros.length; i += 1) {
      const [may, men, par] = numeros[i - 1];
      const [may2, men2, par2] = numeros[i];
      expect(may * 1e6 + men * 1e3 + par).toBeGreaterThan(may2 * 1e6 + men2 * 1e3 + par2);
    }
  });
});
