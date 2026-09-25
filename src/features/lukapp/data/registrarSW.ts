/**
 * Registers the service worker that makes the app installable and able to open
 * without a connection.
 *
 * Deliberately silent about failure. A worker that will not register is a
 * degraded install, not a broken app — every screen still works over the
 * network — so it must never surface an error to someone who only wanted to
 * check a balance.
 */
export const registrarServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  // Dev is served from source with no build output to cache, and a worker there
  // would serve stale modules straight through HMR.
  if (import.meta.env.DEV) return;

  const registrar = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registro) => {
      const avisarActualizacion = () => window.dispatchEvent(new Event('lukapp:actualizacion-pwa'));
      if (registro.waiting) avisarActualizacion();
      registro.addEventListener('updatefound', () => {
        const trabajador = registro.installing;
        trabajador?.addEventListener('statechange', () => {
          if (trabajador.state === 'installed' && navigator.serviceWorker.controller) {
            avisarActualizacion();
          }
        });
      });
    }).catch(() => undefined);
  };

  // `main.tsx` importa este módulo después de que pueda haberse disparado
  // `load`. Escucharlo otra vez en ese caso dejaba al worker esperando un
  // evento que ya pasó y la PWA nunca quedaba lista fuera de desarrollo.
  if (document.readyState === 'complete') {
    registrar();
  } else {
    window.addEventListener('load', registrar, { once: true });
  }
};
