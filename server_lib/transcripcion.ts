export type ModoTranscripcion = 'parcial' | 'final';

interface ProveedorTranscripcion {
  nombre: 'Groq';
  llave: string;
  url: string;
  modelo: string;
}

interface SegmentoWhisper {
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface RespuestaTranscripcion {
  text?: string;
  segments?: SegmentoWhisper[];
}

export interface ResultadoTranscripcion {
  success: true;
  text: string;
  /** Señal acústica orientativa; la app nunca guarda basándose solo en ella. */
  calidad?: 'alta' | 'media' | 'baja';
}

export interface FalloTranscripcion {
  success?: false;
  offline: true;
  error: string;
}

const URL_GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Términos colombianos cuya ortografía cambia con facilidad en audio corto.
 * Las palabras personalizadas se suman a esta lista, pero con límites estrictos
 * para no convertir una pista útil en un prompt interminable.
 */
const PALABRAS_CLAVE_BASE = [
  'LukApp',
  // Órdenes financieras: van primero porque un error aquí cambia un saldo.
  'abonar',
  'abono a tarjeta',
  'pagar tarjeta',
  'actualizar saldo',
  'ajustar saldo',
  'transferir entre cuentas',
  'pasar a una cajita',
  'registrar rendimiento',
  // Bancos, billeteras y servicios financieros usados en Colombia.
  'Nequi',
  'Daviplata',
  'Bancolombia',
  'Davivienda',
  'Nu',
  'RappiPay',
  'Lulo Bank',
  'Ualá',
  'Banco de Bogotá',
  'Banco Popular',
  'Banco de Occidente',
  'Banco AV Villas',
  'Banco Caja Social',
  'Banco Agrario',
  'Bancoomeva',
  'Banco Falabella',
  'Scotiabank Colpatria',
  'BBVA',
  'Itaú',
  'GNB Sudameris',
  'dale!',
  'MOVii',
  'Tpaga',
  'Powwi',
  'Bold',
  'Addi',
  'Sistecrédito',
  'PSE',
  'Transfiya',
  'Bre-B',
  // Vocabulario colombiano pedido explícitamente por quienes dictan.
  'tamal',
  'lechona',
  'sancocho',
  'chipcha',
  'Chibcha',
  'ñapa',
  // Transporte, comercios y lugares que suelen aparecer en gastos cortos.
  'TransMilenio',
  'SITP',
  'TuLlave',
  'inDrive',
  'DiDi',
  'Picap',
  'Rappi',
  'Juan Valdez',
  'Crepes & Waffles',
  'Farmatodo',
  'OXXO',
  'Éxito',
  'D1',
  'Ara',
  'Jumbo',
  'Olímpica',
  // Comidas y expresiones colombianas que el modelo suele castellanizar mal.
  'ajiaco',
  'bandeja paisa',
  'changua',
  'arepa',
  'empanada',
  'buñuelo',
  'pandebono',
  'almojábana',
  'chicharrón',
  'mondongo',
  'mazamorra',
  'morcilla',
  'oblea',
  'cholado',
  'salpicón',
  'chicha',
  'corrientazo',
  'mecato',
  'tinto',
  // Dinero y movimientos habituales.
  'millón',
  'mil pesos',
  'lucas',
  'cuota',
  'arriendo',
  'administración',
  'consignación',
  'transferencia',
  'desembolso',
  'abono',
  'nómina',
  'quincena',
  'remesa',
  'cuatro por mil',
] as const;

// El prompt tiene un límite estricto. Estas palabras cambian con más frecuencia
// el monto, la dirección o el comercio de un movimiento, así que entran antes
// de la lista completa de nombres propios.
const PALABRAS_CLAVE_PRIORITARIAS = [
  'LukApp',
  'Nequi',
  'Daviplata',
  'Bancolombia',
  'Davivienda',
  'abonar',
  'abono a tarjeta',
  'pagar tarjeta',
  'actualizar saldo',
  'ajustar saldo',
  'transferir entre cuentas',
  'pasar a una cajita',
  'registrar rendimiento',
  'tamal',
  'lechona',
  'sancocho',
  'chipcha',
  'Chibcha',
  'ñapa',
] as const;

/** Groq dice "caracteres", pero en la práctica cuenta los bytes UTF-8. */
const MAX_BYTES_PROMPT_GROQ = 896;

const bytesUtf8 = (texto: string): number => new TextEncoder().encode(texto).byteLength;

const CONTEXTO_BASE =
  'Transcribe literalmente este dictado financiero en español de Colombia. ' +
  'Conserva cifras, negaciones, nombres de cuentas y la dirección del dinero ' +
  '(de, desde, a, hacia; pagué, gasté, compré, retiré, transferí, aboné, recibí). ' +
  'No inventes ni completes lo que no se oye: conserva los montos compuestos ' +
  '("mil quinientos pesos", nunca "1 y 500") y no conviertas cantidades de productos en precios. ' +
  'Usa las ortografías sugeridas solo si realmente se oyen.';

const construirPrompt = (vocabulario: readonly string[]): string => {
  const inicioLista = ' Ortografías esperadas: ';
  const palabrasClave = [
    ...new Set([...vocabulario, ...PALABRAS_CLAVE_PRIORITARIAS, ...PALABRAS_CLAVE_BASE]),
  ];
  const elegidas: string[] = [];

  for (const termino of palabrasClave) {
    const candidato = `${CONTEXTO_BASE}${inicioLista}${[...elegidas, termino].join(', ')}.`;
    if (bytesUtf8(candidato) <= MAX_BYTES_PROMPT_GROQ) elegidas.push(termino);
  }

  return elegidas.length > 0
    ? `${CONTEXTO_BASE}${inicioLista}${elegidas.join(', ')}.`
    : CONTEXTO_BASE;
};

const normalizarTermino = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null;
  const limpio = valor
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  if (limpio.length < 2 || !/[\p{L}\p{N}]/u.test(limpio)) return null;
  return limpio;
};

/** Decodifica el vocabulario enviado por la app sin aceptar texto arbitrario. */
export const leerVocabularioPersonal = (cabecera: string | null | undefined): string[] => {
  if (!cabecera || cabecera.length > 6_000) return [];
  try {
    const leido = JSON.parse(decodeURIComponent(cabecera)) as unknown;
    if (!Array.isArray(leido)) return [];
    const vistos = new Set<string>();
    const resultado: string[] = [];
    for (const valor of leido) {
      const termino = normalizarTermino(valor);
      if (!termino) continue;
      const clave = termino.toLocaleLowerCase('es');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      resultado.push(termino);
      if (resultado.length === 30) break;
    }
    return resultado;
  } catch {
    return [];
  }
};

export const nombreAudioSegunTipo = (tipo: string): string => {
  if (tipo.includes('mp4') || tipo.includes('m4a')) return 'audio.mp4';
  if (tipo.includes('mpeg') || tipo.includes('mp3')) return 'audio.mp3';
  if (tipo.includes('ogg')) return 'audio.ogg';
  if (tipo.includes('wav')) return 'audio.wav';
  return 'audio.webm';
};

const proveedorGroq = (
  entorno: Record<string, string | undefined>,
): ProveedorTranscripcion | null =>
  entorno.GROQ_API_KEY
    ? {
        nombre: 'Groq',
        llave: entorno.GROQ_API_KEY,
        url: URL_GROQ,
        modelo: 'whisper-large-v3',
      }
    : null;

const estimarCalidadWhisper = (
  segmentos: readonly SegmentoWhisper[] | undefined,
): ResultadoTranscripcion['calidad'] => {
  const utiles = (segmentos ?? []).filter(
    (segmento) =>
      Number.isFinite(segmento.avg_logprob) || Number.isFinite(segmento.no_speech_prob),
  );
  if (utiles.length === 0) return undefined;

  const probSilencio =
    utiles.reduce((suma, segmento) => suma + (segmento.no_speech_prob ?? 0), 0) /
    utiles.length;
  const logProb =
    utiles.reduce((suma, segmento) => suma + (segmento.avg_logprob ?? -0.8), 0) /
    utiles.length;

  if (probSilencio >= 0.55 || logProb <= -1.15) return 'baja';
  if (probSilencio >= 0.3 || logProb <= -0.72) return 'media';
  return 'alta';
};

const construirFormulario = (
  proveedor: ProveedorTranscripcion,
  audio: Blob,
  tipo: string,
  vocabulario: readonly string[],
): FormData => {
  const formulario = new FormData();
  formulario.append('file', audio, nombreAudioSegunTipo(tipo));
  formulario.append('model', proveedor.modelo);
  // Los nombres reales van primero. Se agregan pistas mientras quepan: Groq
  // rechaza el audio completo con `invalid_prompt` en vez de truncar el texto.
  formulario.append('prompt', construirPrompt(vocabulario));
  formulario.append('language', 'es');
  formulario.append('temperature', '0');
  formulario.append('response_format', 'verbose_json');

  return formulario;
};

interface OpcionesTranscripcion {
  entorno: Record<string, string | undefined>;
  modo: ModoTranscripcion;
  vocabulario?: readonly string[];
  fetcher?: typeof fetch;
  onError?: (mensaje: string) => void;
}

/**
 * Transcribe exclusivamente con Groq.
 *
 * OPENAI_API_KEY se ignora intencionalmente en este flujo: LukApp es gratuito
 * y una clave olvidada en el entorno nunca debe convertir el dictado en un
 * consumo facturable de OpenAI.
 */
export const transcribirAudio = async (
  audio: Blob,
  tipo: string,
  opciones: OpcionesTranscripcion,
): Promise<ResultadoTranscripcion | FalloTranscripcion> => {
  const proveedor = proveedorGroq(opciones.entorno);
  if (!proveedor) {
    return { offline: true, error: 'Falta llave de transcripción' };
  }

  const hacerFetch = opciones.fetcher ?? fetch;
  try {
    const respuesta = await hacerFetch(proveedor.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proveedor.llave}` },
      body: construirFormulario(
        proveedor,
        audio,
        tipo,
        opciones.vocabulario ?? [],
      ),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      opciones.onError?.(
        `[transcribir] ${proveedor.nombre} ${respuesta.status}: ${detalle.slice(0, 200)}`,
      );
      return { offline: true, error: 'No se pudo transcribir' };
    }

    const datos = (await respuesta.json()) as RespuestaTranscripcion;
    const text = typeof datos.text === 'string' ? datos.text.trim() : '';
    if (!text) {
      opciones.onError?.(`[transcribir] ${proveedor.nombre} devolvió texto vacío`);
      return { offline: true, error: 'No se pudo transcribir' };
    }
    return {
      success: true,
      text,
      calidad: estimarCalidadWhisper(datos.segments),
    };
  } catch (error) {
    opciones.onError?.(
      `[transcribir] ${proveedor.nombre} error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { offline: true, error: 'No se pudo transcribir' };
};
