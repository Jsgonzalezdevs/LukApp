/** Dominio corto desde el que se abre directamente la aplicación financiera. */
export const HOST_APP_PRINCIPAL = 'mi.lukapp.app';

export const esDominioAppPrincipal = (hostname?: string): boolean =>
  (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')) === HOST_APP_PRINCIPAL;

export const urlAppPrincipal = (ruta: string): string =>
  `https://${HOST_APP_PRINCIPAL}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
