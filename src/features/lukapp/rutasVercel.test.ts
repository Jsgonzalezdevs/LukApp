import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUTA_BENEFICIOS_PREMIUM } from './data/useRuta';
import { SECTIONS } from './sections';

const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};

/**
 * Vercel solo entrega la app en las rutas que vercel.json reescribe a
 * index.html. Una ruta nueva que se olvide ahí funciona navegando dentro de la
 * app, pero da 404 al abrirla como enlace (así pasó con /premium).
 */
describe('rutas de la app en Vercel', () => {
  const llegaALaApp = (ruta: string): boolean =>
    vercel.rewrites.some(({ source, destination }) =>
      destination === '/index.html' && new RegExp(`^${source}$`).test(ruta));

  it.each([
    ...SECTIONS.filter(({ id }) => id !== 'inicio').map(({ id }) => `/${id}`),
    '/app',
    '/calendario',
    RUTA_BENEFICIOS_PREMIUM,
    '/dinero/extractos',
  ])('%s se abre como enlace directo', (ruta) => {
    expect(llegaALaApp(ruta)).toBe(true);
  });
});
