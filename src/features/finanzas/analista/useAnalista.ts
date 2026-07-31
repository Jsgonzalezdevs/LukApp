import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalisisResultado, CodigoError, EstadoAnalisis, UsoTokens } from './tipos';

const CLAVE_TOKEN = 'finanzas.analista.token';
const RUTA_ANALIZAR = '/.netlify/functions/analizar-extracto';
const RUTA_ESTADO = '/.netlify/functions/analisis-estado';

const MAX_BYTES = 6 * 1024 * 1024;
const INTERVALO_MS = 3_000;
const MAX_INTENTOS = 320; // ~16 min, matching the background-function ceiling.

export type FaseAnalista = 'inactivo' | 'subiendo' | 'procesando' | 'listo' | 'error';

export interface UseAnalista {
  fase: FaseAnalista;
  /** Seconds elapsed since the upload, for a progress hint on a long request. */
  segundos: number;
  resultado: AnalisisResultado | null;
  uso: UsoTokens | null;
  error: { codigo: CodigoError; mensaje: string } | null;
  token: string;
  guardarToken: (token: string) => void;
  analizar: (archivo: File) => void;
  reiniciar: () => void;
}

const leerTokenGuardado = (): string => {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(CLAVE_TOKEN) ?? '';
  } catch {
    // Safari in private mode throws on localStorage access rather than returning
    // null, and that must not take down the whole view.
    return '';
  }
};

/** Reads a File into raw base64, without the `data:...;base64,` prefix. */
const aBase64 = (archivo: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const resultado = String(lector.result);
      const coma = resultado.indexOf(',');
      resolve(coma >= 0 ? resultado.slice(coma + 1) : resultado);
    };
    lector.readAsDataURL(archivo);
  });

/**
 * Drives the two-step analyst flow: POST to a background function that answers
 * 202 with no body, then poll a synchronous endpoint until the result appears.
 *
 * The job id is generated HERE, on the client, precisely because the background
 * function cannot tell us one — a 202 carries no payload.
 */
export const useAnalista = (): UseAnalista => {
  const [fase, setFase] = useState<FaseAnalista>('inactivo');
  const [segundos, setSegundos] = useState(0);
  const [resultado, setResultado] = useState<AnalisisResultado | null>(null);
  const [uso, setUso] = useState<UsoTokens | null>(null);
  const [error, setError] = useState<{ codigo: CodigoError; mensaje: string } | null>(null);
  const [token, setToken] = useState(leerTokenGuardado);

  const cancelado = useRef(false);
  const cronometro = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerCronometro = useCallback(() => {
    if (cronometro.current !== null) {
      clearInterval(cronometro.current);
      cronometro.current = null;
    }
  }, []);

  useEffect(() => {
    cancelado.current = false;
    return () => {
      cancelado.current = true;
      detenerCronometro();
    };
  }, [detenerCronometro]);

  const guardarToken = useCallback((nuevo: string) => {
    const limpio = nuevo.trim();
    setToken(limpio);
    try {
      if (limpio) localStorage.setItem(CLAVE_TOKEN, limpio);
      else localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      // Not fatal: the token simply will not survive a reload.
    }
  }, []);

  const reiniciar = useCallback(() => {
    detenerCronometro();
    setFase('inactivo');
    setSegundos(0);
    setResultado(null);
    setUso(null);
    setError(null);
  }, [detenerCronometro]);

  const fallar = useCallback(
    (codigo: CodigoError, mensaje: string) => {
      detenerCronometro();
      setError({ codigo, mensaje });
      setFase('error');
    },
    [detenerCronometro],
  );

  const analizar = useCallback(
    (archivo: File) => {
      void (async () => {
        setResultado(null);
        setUso(null);
        setError(null);
        setSegundos(0);

        if (!token) {
          fallar('sin-autorizacion', 'Falta el token de acceso.');
          return;
        }
        if (archivo.type !== 'application/pdf') {
          fallar('pdf-invalido', 'El archivo debe ser un PDF.');
          return;
        }
        if (archivo.size > MAX_BYTES) {
          fallar(
            'pdf-muy-grande',
            `El PDF pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el límite es 6 MB.`,
          );
          return;
        }

        setFase('subiendo');

        let pdfBase64: string;
        try {
          pdfBase64 = await aBase64(archivo);
        } catch {
          fallar('pdf-invalido', 'No se pudo leer el archivo.');
          return;
        }
        if (cancelado.current) return;

        const jobId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`;

        try {
          const respuesta = await fetch(RUTA_ANALIZAR, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ jobId, pdfBase64, nombreArchivo: archivo.name }),
          });

          // A background function answers 202 and nothing else. Any other status
          // means the request never reached the handler.
          if (respuesta.status !== 202) {
            fallar(
              'fallo-interno',
              respuesta.status === 404
                ? 'La función no está desplegada todavía. Esto solo funciona en Netlify, no en el servidor local.'
                : `El servidor respondió ${respuesta.status}.`,
            );
            return;
          }
        } catch {
          fallar('fallo-interno', 'No se pudo contactar al servidor.');
          return;
        }
        if (cancelado.current) return;

        setFase('procesando');
        detenerCronometro();
        cronometro.current = setInterval(() => setSegundos((s) => s + 1), 1000);

        for (let intento = 0; intento < MAX_INTENTOS; intento += 1) {
          await new Promise((r) => setTimeout(r, INTERVALO_MS));
          if (cancelado.current) return;

          let estado: EstadoAnalisis;
          try {
            const respuesta = await fetch(`${RUTA_ESTADO}?id=${encodeURIComponent(jobId)}`, {
              headers: { authorization: `Bearer ${token}` },
            });
            estado = (await respuesta.json()) as EstadoAnalisis;
          } catch {
            // A single failed poll is not fatal — keep trying.
            continue;
          }
          if (cancelado.current) return;

          if (estado.estado === 'listo') {
            detenerCronometro();
            setResultado(estado.resultado);
            setUso(estado.usoTokens);
            setFase('listo');
            return;
          }
          if (estado.estado === 'error') {
            fallar(estado.codigo, estado.mensaje);
            return;
          }
        }

        fallar('fallo-interno', 'El análisis tardó demasiado. Intenta de nuevo.');
      })();
    },
    [token, fallar, detenerCronometro],
  );

  return {
    fase,
    segundos,
    resultado,
    uso,
    error,
    token,
    guardarToken,
    analizar,
    reiniciar,
  };
};
