export type ModoTranscripcion = 'parcial' | 'final';

interface ProveedorTranscripcion {
  nombre: 'OpenAI' | 'Groq';
  llave: string;
  url: string;
  modelo: string;
  tipo: 'gpt-transcribe' | 'whisper';
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

const URL_OPENAI = 'https://api.openai.com/v1/audio/transcriptions';
const URL_GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Términos colombianos cuya ortografía cambia con facilidad en audio corto.
 * Las palabras personalizadas se suman a esta lista, pero con límites estrictos
 * para no convertir una pista útil en un prompt interminable.
 */
const PALABRAS_CLAVE_BASE = [
  'LukApp',
  'Nequi',
  'Daviplata',
  'Bancolombia',
  'Davivienda',
  'Nu',
  'RappiPay',
  'Lulo',
  'Ualá',
  'Falabella',
  'Scotiabank',
  'Colpatria',
  'BBVA',
  'Bold',
  'Addi',
  'TransMilenio',
  'TuLlave',
  'Éxito',
  'D1',
  'Ara',
  'millón',
  'mil pesos',
  'lucas',
  'cuota',
  'arriendo',
] as const;

const CONTEXTO_BASE =
  'Dictado breve para registrar un movimiento financiero en pesos colombianos. ' +
  'Transcribe literalmente en español de Colombia. Las cifras, negaciones, nombres propios y ' +
  'direcciones del dinero son críticas: conserva exactamente expresiones como pagué, gasté, ' +
  'compré, retiré, transferí, recibí, me pagaron, me transfirieron, de, desde, a y hacia. ' +
  'No completes información que no se oye ni conviertas cantidades de productos en precios.';

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

const proveedoresDisponibles = (
  entorno: Record<string, string | undefined>,
  modo: ModoTranscripcion,
): ProveedorTranscripcion[] => {
  const openai: ProveedorTranscripcion | null = entorno.OPENAI_API_KEY
    ? {
        nombre: 'OpenAI',
        llave: entorno.OPENAI_API_KEY,
        url: URL_OPENAI,
        modelo: 'gpt-transcribe',
        tipo: 'gpt-transcribe',
      }
    : null;
  const groq: ProveedorTranscripcion | null = entorno.GROQ_API_KEY
    ? {
        nombre: 'Groq',
        llave: entorno.GROQ_API_KEY,
        url: URL_GROQ,
        modelo: 'whisper-large-v3',
        tipo: 'whisper',
      }
    : null;

  // La lectura parcial favorece respuesta inmediata. La definitiva favorece el
  // modelo recomendado para máxima precisión y conserva Whisper como respaldo.
  return modo === 'parcial'
    ? [groq, openai].filter((p): p is ProveedorTranscripcion => p !== null)
    : [openai, groq].filter((p): p is ProveedorTranscripcion => p !== null);
};

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
  const palabrasClave = [...PALABRAS_CLAVE_BASE, ...vocabulario];
  const contextoPersonal = vocabulario.length > 0
    ? `${CONTEXTO_BASE} Nombres esperados en esta cuenta: ${vocabulario.join(', ')}.`
    : CONTEXTO_BASE;
  const formulario = new FormData();
  formulario.append('file', audio, nombreAudioSegunTipo(tipo));
  formulario.append('model', proveedor.modelo);
  formulario.append('prompt', contextoPersonal);

  if (proveedor.tipo === 'gpt-transcribe') {
    for (const palabra of palabrasClave) formulario.append('keywords[]', palabra);
    formulario.append('languages[]', 'es');
  } else {
    formulario.append('language', 'es');
    formulario.append('temperature', '0');
    formulario.append('response_format', 'verbose_json');
  }

  return formulario;
};

interface OpcionesTranscripcion {
  entorno: Record<string, string | undefined>;
  modo: ModoTranscripcion;
  vocabulario?: readonly string[];
  fetcher?: typeof fetch;
  onError?: (mensaje: string) => void;
}

/** Ejecuta la mejor transcripción disponible y cae al segundo proveedor. */
export const transcribirAudio = async (
  audio: Blob,
  tipo: string,
  opciones: OpcionesTranscripcion,
): Promise<ResultadoTranscripcion | FalloTranscripcion> => {
  const proveedores = proveedoresDisponibles(opciones.entorno, opciones.modo);
  if (proveedores.length === 0) {
    return { offline: true, error: 'Falta llave de transcripción' };
  }

  const hacerFetch = opciones.fetcher ?? fetch;
  for (const proveedor of proveedores) {
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
        continue;
      }

      const datos = (await respuesta.json()) as RespuestaTranscripcion;
      const text = typeof datos.text === 'string' ? datos.text.trim() : '';
      if (!text) {
        opciones.onError?.(`[transcribir] ${proveedor.nombre} devolvió texto vacío`);
        continue;
      }
      return {
        success: true,
        text,
        calidad:
          proveedor.tipo === 'whisper' ? estimarCalidadWhisper(datos.segments) : undefined,
      };
    } catch (error) {
      opciones.onError?.(
        `[transcribir] ${proveedor.nombre} error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { offline: true, error: 'No se pudo transcribir' };
};
