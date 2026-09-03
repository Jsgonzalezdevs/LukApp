/*
 * Service worker for LukApp standalone.
 */

// Debe avanzar junto con la versión de la app. Al hacerlo, activate elimina
// recursos de lanzamientos anteriores en vez de dejar una PWA instalada con
// cachés viejos acumulados.
const VERSION = 'v2.1.6';
const SHELL = `lukapp-shell-${VERSION}`;
const ASSETS = `lukapp-assets-${VERSION}`;

/** The document every in-app route resolves to. */
const SHELL_URL = '/';

/**
 * The app's own routes.
 */
const RUTAS_APP = ['/', '/app', '/entrar', '/ajustes', '/superadmin', '/estadisticas'];

const esRutaDeLaApp = (url) =>
  RUTAS_APP.some((r) => url.pathname === r || url.pathname.startsWith(`${r}/`));

/**
 * Requests that must ALWAYS hit the network and must never be stored.
 */
const NUNCA_CACHEAR = (url) =>
  url.pathname.startsWith('/api/') ||
  url.hostname.endsWith('.supabase.co') ||
  url.pathname.includes('/auth/') ||
  url.pathname.endsWith('.webmanifest');

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(SHELL_URL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((c) => c.startsWith('lukapp-') && !c.endsWith(VERSION))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (NUNCA_CACHEAR(url)) return;
  if (url.origin !== self.location.origin) return;

  if (peticion.mode === 'navigate') {
    if (!esRutaDeLaApp(url)) return;

    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok && respuesta.type === 'basic') {
            const copia = respuesta.clone();
            caches.open(SHELL).then((cache) => cache.put(SHELL_URL, copia));
          }
          return respuesta;
        })
        .catch(() =>
          caches.match(SHELL_URL).then((r) => r ?? fetch(peticion).catch(() => Response.error())),
        ),
    );
    return;
  }

  evento.respondWith(
    caches.match(peticion).then(
      (enCache) =>
        enCache ??
        fetch(peticion).then((respuesta) => {
          if (respuesta.ok && respuesta.type === 'basic') {
            const copia = respuesta.clone();
            caches.open(ASSETS).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        }),
    ),
  );
});
