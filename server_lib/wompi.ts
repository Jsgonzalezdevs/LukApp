import { createHash, timingSafeEqual } from 'node:crypto';

export type AmbienteWompi = 'test' | 'prod';

export interface ConfiguracionWompi {
  ambiente: AmbienteWompi;
  llavePublica: string;
  secretoIntegridad: string;
  secretoEventos: string;
  urlRedireccion: string;
}

export interface EventoWompi {
  event?: unknown;
  data?: unknown;
  environment?: unknown;
  signature?: { properties?: unknown; checksum?: unknown } | unknown;
  timestamp?: unknown;
}

const textoSeguro = (valor: unknown): string | null =>
  typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
    ? String(valor)
    : null;

const prefijoPorAmbiente = (ambiente: AmbienteWompi, tipo: 'publica' | 'integridad' | 'eventos'): string => {
  const prefijo = ambiente === 'test' ? 'test' : 'prod';
  if (tipo === 'publica') return `pub_${prefijo}_`;
  if (tipo === 'integridad') return `${prefijo}_integrity_`;
  return `${prefijo}_events_`;
};

const textoDeEntorno = (entorno: NodeJS.ProcessEnv, nombre: string): string => {
  const valor = entorno[nombre]?.trim();
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
};

/**
 * La configuración se valida antes de crear un checkout. Cruzar secretos de
 * sandbox con llaves de producción parece inocuo, pero puede mezclar pruebas y
 * cobros reales; los prefijos oficiales de Wompi permiten frenarlo temprano.
 */
export const configuracionWompi = (entorno: NodeJS.ProcessEnv): ConfiguracionWompi => {
  const modo = entorno.WOMPI_AMBIENTE?.trim();
  if (modo !== 'sandbox' && modo !== 'produccion') {
    throw new Error('WOMPI_AMBIENTE debe ser sandbox o produccion.');
  }

  const ambiente: AmbienteWompi = modo === 'sandbox' ? 'test' : 'prod';
  const llavePublica = textoDeEntorno(entorno, 'WOMPI_PUBLIC_KEY');
  const secretoIntegridad = textoDeEntorno(entorno, 'WOMPI_INTEGRITY_SECRET');
  const secretoEventos = textoDeEntorno(entorno, 'WOMPI_EVENTS_SECRET');
  const urlRedireccion = textoDeEntorno(entorno, 'WOMPI_REDIRECT_URL');

  if (!llavePublica.startsWith(prefijoPorAmbiente(ambiente, 'publica'))
    || !secretoIntegridad.startsWith(prefijoPorAmbiente(ambiente, 'integridad'))
    || !secretoEventos.startsWith(prefijoPorAmbiente(ambiente, 'eventos'))) {
    throw new Error('Las llaves de Wompi no corresponden al ambiente elegido.');
  }

  let redireccion: URL;
  try {
    redireccion = new URL(urlRedireccion);
  } catch {
    throw new Error('WOMPI_REDIRECT_URL debe ser una URL válida.');
  }
  if (redireccion.protocol !== 'https:') {
    throw new Error('WOMPI_REDIRECT_URL debe usar HTTPS.');
  }

  return { ambiente, llavePublica, secretoIntegridad, secretoEventos, urlRedireccion: redireccion.toString() };
};

/** Wompi recibe el monto en centavos aunque COP no use fracciones visibles. */
export const centavosWompi = (montoCop: number): number => {
  if (!Number.isSafeInteger(montoCop) || montoCop <= 0 || montoCop > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error('El monto de Wompi no es un entero seguro en pesos colombianos.');
  }
  return montoCop * 100;
};

/** Firma del Web Checkout: referencia + centavos + COP + vencimiento + secreto. */
export const firmaIntegridadWompi = (
  referencia: string,
  montoCentavos: number,
  vencimientoCheckout: string,
  secretoIntegridad: string,
): string => createHash('sha256')
  .update(`${referencia}${montoCentavos}COP${vencimientoCheckout}${secretoIntegridad}`, 'utf8')
  .digest('hex');

const valorEnEvento = (datos: unknown, ruta: unknown): string | null => {
  if (typeof ruta !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(ruta)) {
    return null;
  }

  let actual: unknown = datos;
  for (const segmento of ruta.split('.')) {
    if (!actual || typeof actual !== 'object' || !Object.hasOwn(actual, segmento)) return null;
    actual = (actual as Record<string, unknown>)[segmento];
  }
  return textoSeguro(actual);
};

/**
 * El arreglo `signature.properties` cambia según el evento. Por eso se toma
 * del cuerpo recibido, en el orden exacto que Wompi indica, en vez de fijarlo
 * a tres campos que podrían dejar de ser válidos en una actualización futura.
 */
export const checksumEsperadoWompi = (evento: EventoWompi, secretoEventos: string): string | null => {
  if (!evento.signature || typeof evento.signature !== 'object') return null;
  const firma = evento.signature as { properties?: unknown };
  if (!Array.isArray(firma.properties) || firma.properties.length === 0) return null;
  if (!Number.isSafeInteger(evento.timestamp) || Number(evento.timestamp) < 0) return null;

  const valores = firma.properties.map((propiedad) => valorEnEvento(evento.data, propiedad));
  if (valores.some((valor) => valor === null)) return null;

  return createHash('sha256')
    .update(`${valores.join('')}${evento.timestamp}${secretoEventos}`, 'utf8')
    .digest('hex');
};

export const coincideChecksum = (esperado: string, recibido: unknown): boolean => {
  if (typeof recibido !== 'string' || !/^[a-f\d]{64}$/i.test(recibido)) return false;
  const a = Buffer.from(esperado.toLowerCase(), 'utf8');
  const b = Buffer.from(recibido.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};
