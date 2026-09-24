/**
 * Reglas HTTP pequeñas y puras para que la API no dependa de un CORS abierto.
 *
 * Las llamadas de LukApp usan tokens Bearer, no cookies; por tanto no hay una
 * razón legítima para aceptar credenciales de cualquier sitio que conozca la
 * URL de Render. Los orígenes se normalizan antes de compararlos para evitar
 * que una barra final o mayúsculas abran una excepción por accidente.
 */
export interface EntornoHttp {
  CORS_ORIGINS?: string;
  NODE_ENV?: string;
  RENDER?: string;
}

const ORIGENES_PUBLICOS = [
  'https://lukapp.app',
  'https://www.lukapp.app',
] as const;

const ORIGENES_LOCALES = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

const normalizarOrigen = (valor: string): string | null => {
  try {
    const url = new URL(valor.trim());
    const esHttps = url.protocol === 'https:';
    const esHttpLocal = url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return esHttps || esHttpLocal ? url.origin : null;
  } catch {
    return null;
  }
};

/** Orígenes que un navegador puede usar para llamar a la API. */
export const origenesCorsPermitidos = (entorno: EntornoHttp): ReadonlySet<string> => {
  const configurados = entorno.CORS_ORIGINS
    ?.split(',')
    .map(normalizarOrigen)
    .filter((origen): origen is string => Boolean(origen));

  if (configurados?.length) return new Set(configurados);

  const enDesarrollo = entorno.NODE_ENV !== 'production' && !entorno.RENDER;
  return new Set(enDesarrollo ? [...ORIGENES_PUBLICOS, ...ORIGENES_LOCALES] : ORIGENES_PUBLICOS);
};

/**
 * Las peticiones sin Origin son clientes no navegadores (Atajos, curl, cron),
 * que se autentican por su propio mecanismo. Un Origin inválido o ajeno no
 * recibe cabeceras CORS y el navegador bloquea su lectura.
 */
export const esOrigenCorsPermitido = (
  origen: string | undefined,
  permitidos: ReadonlySet<string>,
): boolean => {
  if (!origen) return true;
  const normalizado = normalizarOrigen(origen);
  return normalizado !== null && permitidos.has(normalizado);
};

/** Cabeceras apropiadas para respuestas JSON que pueden contener finanzas. */
export const CABECERAS_API_SEGURAS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
