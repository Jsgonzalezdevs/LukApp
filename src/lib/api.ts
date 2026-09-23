/**
 * Base URL for the Express API.
 *
 * Empty by default, which yields same-origin relative paths — what local
 * development needs (Vite proxies /api to :3000) and what a single-host deploy
 * needs (Express serves both `dist` and /api).
 *
 * It only has to be set when the front end and the API live on DIFFERENT hosts,
 * which is exactly the current production setup: the site is on Vercel and the
 * API on Render, so a relative /api hits Vercel — where nothing serves it — and
 * returns 404. Setting VITE_API_URL to the Render origin points the calls at the
 * right host; `cors()` is already enabled server-side for that case.
 */
const URL_API_PRODUCCION = 'https://focus-62nt.onrender.com';
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? URL_API_PRODUCCION : '')).replace(/\/+$/, '');

/** `apiUrl('/api/x')` -> '/api/x' locally, 'https://host/api/x' when configured. */
export const apiUrl = (ruta: string): string => `${BASE}${ruta}`;

let calentamientoEnCurso: Promise<void> | null = null;
let ultimoCalentamiento = 0;
const INTERVALO_CALENTAMIENTO_MS = 60_000;

/**
 * Despierta Render mientras la app carga sus datos locales. En el plan gratis
 * el proceso puede dormirse; iniciar esta petición al recuperar la sesión hace
 * que la primera acción que necesita API no sea la que pague toda la espera.
 * Se comparte y limita para no duplicar peticiones entre vistas.
 */
export const precalentarApi = (): Promise<void> => {
  if (!BASE || typeof window === 'undefined') return Promise.resolve();
  if (calentamientoEnCurso) return calentamientoEnCurso;
  if (Date.now() - ultimoCalentamiento < INTERVALO_CALENTAMIENTO_MS) return Promise.resolve();

  ultimoCalentamiento = Date.now();
  const controlador = new AbortController();
  const limite = window.setTimeout(() => controlador.abort(), 55_000);
  calentamientoEnCurso = fetch(apiUrl('/api/salud'), {
    cache: 'no-store',
    signal: controlador.signal,
  })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      window.clearTimeout(limite);
      calentamientoEnCurso = null;
    });
  return calentamientoEnCurso;
};
