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
    // Una versión nueva se descarga en segundo plano, pero el navegador la deja
    // esperando hasta que se cierren todas las ventanas que usan la actual.
    // Así la siguiente apertura recibe la versión nueva sin recargar ni perder
    // lo que la persona esté haciendo.
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
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
