import { useCallback, useSyncExternalStore } from 'react';

/**
 * La URL como estado de navegación para LukApp.
 */

/** El prefijo bajo el que vive LukApp. En el dominio propio es la raíz ''. */
export const BASE_LUKAPP = '';

const normalizar = (ruta: string): string => {
  const limpia = ruta.replace(/\/+$/, '');
  return limpia === '' ? '/' : limpia;
};

const leer = (): string =>
  typeof window === 'undefined' ? '/' : normalizar(window.location.pathname);

let rutaActual = leer();
const suscriptores = new Set<() => void>();

const avisar = () => {
  const siguiente = leer();
  if (siguiente === rutaActual) return;
  rutaActual = siguiente;
  suscriptores.forEach((f) => f());
};

const suscribir = (f: () => void) => {
  suscriptores.add(f);
  window.addEventListener('popstate', avisar);
  return () => {
    suscriptores.delete(f);
    if (suscriptores.size === 0) window.removeEventListener('popstate', avisar);
  };
};

/** Empuja al historial: el atrás vuelve a la pantalla anterior. */
export const irA = (destino: string): void => {
  const limpio = normalizar(destino);
  if (leer() === limpio) return;
  window.history.pushState({}, '', limpio);
  avisar();
};

/**
 * Cambia la URL sin dejar rastro en el historial.
 */
export const reemplazarPor = (destino: string): void => {
  const limpio = normalizar(destino);
  if (leer() === limpio) return;
  window.history.replaceState({}, '', limpio);
  avisar();
};

/** La ruta de ahora, y cómo cambiarla. */
export const useRuta = () => {
  const ruta = useSyncExternalStore(
    suscribir,
    () => rutaActual,
    () => '/',
  );

  const ir = useCallback((destino: string) => irA(destino), []);
  const reemplazar = useCallback((destino: string) => reemplazarPor(destino), []);

  return { ruta, ir, reemplazar };
};

/**
 * El trozo de ruta ya partido, soportando tanto '/' como '/finanzas'.
 *
 * `/app`              → `['app']`
 * `/finanzas/app`     → `['app']`
 * `/ajustes/cuentas`  → `['ajustes', 'cuentas']`
 * `/`                 → `[]`
 */
export const segmentosDe = (ruta: string): string[] =>
  normalizar(ruta)
    .replace(/^\/finanzas/, '')
    .split('/')
    .filter(Boolean);
