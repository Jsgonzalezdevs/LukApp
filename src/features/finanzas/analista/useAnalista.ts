import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalisisResultado, CodigoError, EstadoAnalisis, UsoTokens } from './tipos';

const CLAVE_TOKEN = 'finanzas.analista.token';
const RUTA_ANALIZAR = '/.netlify/functions/analizar-extracto';
const RUTA_ESTADO = '/.netlify/functions/analisis-estado';

const MAX_BYTES = 6 * 1024 * 1024;
const INTERVALO_MS = 3_000;
const MAX_INTENTOS = 320; // ~16 min, matching the background-function ceiling.

export type FaseTrabajo = 'subiendo' | 'procesando' | 'listo' | 'error';

export interface Trabajo {
  id: string;
  /** Kept (not just its name) so a failed job can be retried without re-picking the file. */
  archivo: File;
  fase: FaseTrabajo;
  /** ms epoch when this job started, so elapsed time is `ahora - inicio` rather
   *  than a per-job counter — one shared clock drives every job's display. */
  inicio: number;
  resultado: AnalisisResultado | null;
  uso: UsoTokens | null;
  error: { codigo: CodigoError; mensaje: string } | null;
}

export interface UseAnalista {
  trabajos: Trabajo[];
  /** Shared clock tick (ms epoch), for computing each job's elapsed seconds. */
  ahora: number;
  token: string;
  guardarToken: (token: string) => void;
  /** Validates and launches one job per file. Files are processed concurrently. */
  analizarArchivos: (archivos: readonly File[]) => void;
  reintentar: (id: string) => void;
  quitarTrabajo: (id: string) => void;
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

const nuevoJobId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`;

const dormir = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives the analyst flow for any number of concurrent files.
 *
 * Each file gets its own job id and its own two-step flow: POST to a background
 * function that answers 202 with no body, then poll a synchronous endpoint until
 * the result appears in Netlify Blobs. Jobs are independent — one failing or
 * taking minutes never blocks the others — because that's the natural shape of
 * "drag three statements in at once".
 */
export const useAnalista = (): UseAnalista => {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());
  const [token, setToken] = useState(leerTokenGuardado);

  const cancelado = useRef(false);
  // Mirrors `trabajos` synchronously so `reintentar` can read the current
  // File/id pair without making the callback depend on (and thus be
  // recreated on) every state update.
  const trabajosRef = useRef<Trabajo[]>([]);

  useEffect(() => {
    trabajosRef.current = trabajos;
  }, [trabajos]);

  useEffect(() => {
    cancelado.current = false;
    return () => {
      cancelado.current = true;
    };
  }, []);

  // One shared clock for every job's elapsed-seconds display, instead of a
  // timer per job.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const actualizarTrabajo = useCallback((id: string, cambios: Partial<Trabajo>) => {
    setTrabajos((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
  }, []);

  const procesarArchivo = useCallback(
    (id: string, archivo: File, tokenActual: string) => {
      void (async () => {
        let pdfBase64: string;
        try {
          pdfBase64 = await aBase64(archivo);
        } catch {
          actualizarTrabajo(id, {
            fase: 'error',
            error: { codigo: 'pdf-invalido', mensaje: 'No se pudo leer el archivo.' },
          });
          return;
        }
        if (cancelado.current) return;

        try {
          const respuesta = await fetch(RUTA_ANALIZAR, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${tokenActual}`,
            },
            body: JSON.stringify({ jobId: id, pdfBase64, nombreArchivo: archivo.name }),
          });

          // A background function answers 202 and nothing else. Any other status
          // means the request never reached the handler.
          if (respuesta.status !== 202) {
            actualizarTrabajo(id, {
              fase: 'error',
              error: {
                codigo: 'fallo-interno',
                mensaje:
                  respuesta.status === 404
                    ? 'La función no está desplegada todavía. Esto solo funciona en Netlify, no en el servidor local.'
                    : `El servidor respondió ${respuesta.status}.`,
              },
            });
            return;
          }
        } catch {
          actualizarTrabajo(id, {
            fase: 'error',
            error: { codigo: 'fallo-interno', mensaje: 'No se pudo contactar al servidor.' },
          });
          return;
        }
        if (cancelado.current) return;

        actualizarTrabajo(id, { fase: 'procesando' });

        for (let intento = 0; intento < MAX_INTENTOS; intento += 1) {
          await dormir(INTERVALO_MS);
          if (cancelado.current) return;

          let estado: EstadoAnalisis;
          try {
            const respuesta = await fetch(`${RUTA_ESTADO}?id=${encodeURIComponent(id)}`, {
              headers: { authorization: `Bearer ${tokenActual}` },
            });
            estado = (await respuesta.json()) as EstadoAnalisis;
          } catch {
            // A single failed poll is not fatal — keep trying.
            continue;
          }
          if (cancelado.current) return;

          if (estado.estado === 'listo') {
            actualizarTrabajo(id, {
              fase: 'listo',
              resultado: estado.resultado,
              uso: estado.usoTokens,
            });
            return;
          }
          if (estado.estado === 'error') {
            actualizarTrabajo(id, { fase: 'error', error: { codigo: estado.codigo, mensaje: estado.mensaje } });
            return;
          }
        }

        actualizarTrabajo(id, {
          fase: 'error',
          error: { codigo: 'fallo-interno', mensaje: 'El análisis tardó demasiado. Intenta de nuevo.' },
        });
      })();
    },
    [actualizarTrabajo],
  );

  const analizarArchivos = useCallback(
    (archivos: readonly File[]) => {
      if (!token || archivos.length === 0) return;

      const creados: Trabajo[] = [];
      const aProcesar: { id: string; archivo: File }[] = [];

      // Validated up front, per file, so a bad file in a batch of five shows its
      // own error immediately instead of flashing through "subiendo" first.
      for (const archivo of archivos) {
        const id = nuevoJobId();
        const base: Omit<Trabajo, 'fase' | 'error'> = {
          id,
          archivo,
          inicio: Date.now(),
          resultado: null,
          uso: null,
        };

        if (archivo.type !== 'application/pdf') {
          creados.push({
            ...base,
            fase: 'error',
            error: { codigo: 'pdf-invalido', mensaje: `"${archivo.name}" no es un PDF.` },
          });
          continue;
        }
        if (archivo.size > MAX_BYTES) {
          creados.push({
            ...base,
            fase: 'error',
            error: {
              codigo: 'pdf-muy-grande',
              mensaje: `"${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el límite es 6 MB.`,
            },
          });
          continue;
        }

        creados.push({ ...base, fase: 'subiendo', error: null });
        aProcesar.push({ id, archivo });
      }

      // Newest first, matching the convention used everywhere else in this app.
      setTrabajos((prev) => [...creados, ...prev]);

      for (const { id, archivo } of aProcesar) {
        procesarArchivo(id, archivo, token);
      }
    },
    [token, procesarArchivo],
  );

  const reintentar = useCallback(
    (id: string) => {
      const trabajo = trabajosRef.current.find((t) => t.id === id);
      if (!trabajo || !token) return;
      actualizarTrabajo(id, { fase: 'subiendo', error: null, resultado: null, uso: null, inicio: Date.now() });
      procesarArchivo(id, trabajo.archivo, token);
    },
    [token, procesarArchivo, actualizarTrabajo],
  );

  const quitarTrabajo = useCallback((id: string) => {
    setTrabajos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { trabajos, ahora, token, guardarToken, analizarArchivos, reintentar, quitarTrabajo };
};
