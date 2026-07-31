import { PDFParse } from 'pdf-parse';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { tokenValido } from './_lib/auth.ts';
import { redactarTexto } from './_lib/redactar.ts';
import { analizarConGemini } from './_lib/gemini.ts';

/**
 * Step 2 of 2. Analyses a bank statement with Gemini.
 *
 * BACKGROUND on purpose: a synchronous Netlify function is capped at ~10s,
 * far below what an AI pass over a multi-page statement takes. Background
 * functions get 15 minutes — at the cost of a hard, non-configurable 256 KB
 * request-body ceiling, which is exactly why this function is triggered with
 * nothing but `{ jobId }`. The PDF itself was already uploaded to Netlify
 * Blobs by `subir-extracto` (a synchronous function, sized for big bytes);
 * this one reads it back out by key.
 *
 * A background function answers 202 with NO body, so every failure path here
 * must also write to the result blob — a caller polling `analisis-estado`
 * would otherwise wait on a key that never appears.
 */
export const config: Config = { background: true };

const ALMACEN = 'analisis-extractos';

const esIdValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[0-9a-f-]{8,64}$/i.test(valor);

export default async (req: Request): Promise<Response> => {
  const store = getStore(ALMACEN);

  let cuerpo: { jobId?: unknown; nombreArchivo?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return new Response(null, { status: 202 });
  }

  const { jobId, nombreArchivo } = cuerpo;
  // Without a usable job id there is nowhere to write an error to, so this is
  // the one case that can only fail silently.
  if (!esIdValido(jobId)) return new Response(null, { status: 202 });

  const fallar = async (codigo: string, mensaje: string) => {
    await store.setJSON(jobId, { estado: 'error', codigo, mensaje });
    // Best-effort cleanup: an uploaded PDF that fails analysis should not sit
    // in Blobs indefinitely just because this path returned early.
    await store.delete(`pdf:${jobId}`).catch(() => undefined);
    return new Response(null, { status: 202 });
  };

  if (!tokenValido(req.headers.get('authorization'), process.env.ANALISTA_TOKEN)) {
    return await fallar('sin-autorizacion', 'Token inválido o ausente.');
  }
  if (!process.env.GEMINI_API_KEY) {
    return await fallar('fallo-interno', 'Falta GEMINI_API_KEY en las variables de entorno de Netlify.');
  }

  await store.setJSON(jobId, { estado: 'procesando', desde: new Date().toISOString() });

  // ---- Read the PDF back out of Blobs ----
  let bytesPdf: ArrayBuffer;
  try {
    bytesPdf = await store.get(`pdf:${jobId}`, { type: 'arrayBuffer' });
  } catch {
    return await fallar('pdf-invalido', 'No se encontró el PDF subido. Intenta de nuevo.');
  }
  if (!bytesPdf || bytesPdf.byteLength === 0) {
    return await fallar('pdf-invalido', 'No se encontró el PDF subido. Intenta de nuevo.');
  }

  // ---- Extract text ----
  let textoCrudo: string;
  try {
    const parser = new PDFParse({ data: new Uint8Array(bytesPdf) });
    const resultado = await parser.getText();
    textoCrudo = resultado.text;
    await parser.destroy();
  } catch {
    return await fallar(
      'pdf-invalido',
      'No se pudo leer el texto del PDF. Puede estar corrupto o protegido con contraseña.',
    );
  }

  if (!textoCrudo.trim()) {
    return await fallar(
      'pdf-invalido',
      'El PDF no tiene texto extraíble — probablemente es un escaneo sin capa de texto.',
    );
  }

  // ---- Redact before this ever reaches a third party. See _lib/redactar.ts
  //      for what this does and does not protect against. ----
  const textoRedactado = redactarTexto(textoCrudo);

  // ---- Ask Gemini ----
  try {
    const resultado = await analizarConGemini(process.env.GEMINI_API_KEY, textoRedactado);

    if (!resultado.ok) {
      const codigoPorMotivo: Record<typeof resultado.motivo, string> = {
        'bloqueado-antes': 'rechazado',
        'bloqueado-durante': 'rechazado',
        'respuesta-vacia': 'respuesta-invalida',
        'json-invalido': 'respuesta-invalida',
        'esquema-invalido': 'respuesta-invalida',
      };
      return await fallar(codigoPorMotivo[resultado.motivo], resultado.detalle);
    }

    // Normalize what the schema could not constrain (structured-output JSON
    // Schema has no numeric-range support), so the client never has to.
    const resultadoNormalizado = {
      ...resultado.resultado,
      movimientos: resultado.resultado.movimientos.map((mov) => ({
        ...mov,
        montoCop: Math.abs(Math.round(mov.montoCop)),
      })),
      metricas: resultado.resultado.metricas.map((fila) => ({
        ...fila,
        valorCop: Math.round(fila.valorCop),
      })),
    };

    await store.setJSON(jobId, {
      estado: 'listo',
      resultado: resultadoNormalizado,
      // Gemini's free tier has no monetary cost by definition — token counts
      // are surfaced for transparency, not billing.
      usoTokens: {
        entrada: resultado.tokensEntrada,
        salida: resultado.tokensSalida,
        leidosDeCache: 0,
        costoUsd: 0,
      },
    });
    await store.delete(`pdf:${jobId}`).catch(() => undefined);

    void nombreArchivo; // kept in the request shape for future logging/telemetry only.
    return new Response(null, { status: 202 });
  } catch {
    // Deliberately does not include the raw error message: it can echo
    // fragments of the (already redacted, but still real) statement text, and
    // Netlify retains function logs.
    return await fallar('fallo-interno', 'Falló el procesamiento del extracto.');
  }
};
