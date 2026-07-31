import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { tokenValido } from './_lib/auth.ts';
import { analisisSchema } from './_lib/esquema.ts';
import { SYSTEM_PROMPT } from './_lib/prompt.ts';

/**
 * Analyses a bank statement PDF with Claude Opus 5.
 *
 * This is a BACKGROUND function, and that is forced rather than chosen: a
 * synchronous Netlify function is capped at ~10s (26s on Pro), while an Opus 5
 * pass over a multi-page PDF with thinking on runs far longer. Background
 * functions get 15 minutes.
 *
 * The trade is that a background function answers 202 with NO body, so the result
 * cannot be returned to the caller. It goes to Netlify Blobs under a job id the
 * CLIENT generates, and the client polls `analisis-estado` for it. Every failure
 * path must therefore also write to the blob — an error that only throws would
 * leave the client polling a key that never appears.
 */
export const config: Config = { background: true };

const ALMACEN = 'analisis-extractos';

// Well under Claude's 32 MB / 600 page ceiling. This is a cost guard, not a
// capability limit: PDF pages bill as image + text, so a 50-page annual statement
// would cost several dollars in one call.
const MAX_BYTES_PDF = 6 * 1024 * 1024;

const PRECIO = { entrada: 5 / 1_000_000, salida: 25 / 1_000_000, cache: 0.5 / 1_000_000 };

interface Peticion {
  jobId?: unknown;
  pdfBase64?: unknown;
  nombreArchivo?: unknown;
}

const esIdValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[0-9a-f-]{8,64}$/i.test(valor);

export default async (req: Request): Promise<Response> => {
  const store = getStore(ALMACEN);

  // ---- Parse enough to know where to report failures ----
  let cuerpo: Peticion;
  try {
    cuerpo = (await req.json()) as Peticion;
  } catch {
    return new Response(null, { status: 202 });
  }

  const { jobId, pdfBase64, nombreArchivo } = cuerpo;

  // Without a usable job id there is nowhere to write an error to, so this is the
  // one case that can only fail silently.
  if (!esIdValido(jobId)) return new Response(null, { status: 202 });

  const fallar = async (codigo: string, mensaje: string) => {
    await store.setJSON(jobId, { estado: 'error', codigo, mensaje });
    return new Response(null, { status: 202 });
  };

  if (!tokenValido(req.headers.get('authorization'), process.env.ANALISTA_TOKEN)) {
    return await fallar('sin-autorizacion', 'Token inválido o ausente.');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return await fallar(
      'fallo-interno',
      'Falta ANTHROPIC_API_KEY en las variables de entorno de Netlify.',
    );
  }

  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    return await fallar('pdf-invalido', 'No llegó el contenido del PDF.');
  }

  // base64 inflates by ~4/3, so recover the real byte count before comparing.
  const bytesReales = Math.floor((pdfBase64.length * 3) / 4);
  if (bytesReales > MAX_BYTES_PDF) {
    return await fallar(
      'pdf-muy-grande',
      `El PDF pesa ${(bytesReales / 1024 / 1024).toFixed(1)} MB y el límite es 6 MB.`,
    );
  }

  await store.setJSON(jobId, { estado: 'procesando', desde: new Date().toISOString() });

  // ---- Ask Claude ----
  const client = new Anthropic();

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      // Generous: max_tokens caps thinking AND the response together, and the
      // movement list can be long on a busy month.
      max_tokens: 32_000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // The prompt is a stable constant with nothing interpolated, so it
          // caches. Opus 5's minimum cacheable prefix is 512 tokens.
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Extraction, classification and arithmetic against a well-specified
      // taxonomy — not open-ended reasoning. `low` is the documented sweet spot
      // for scoped, non-intelligence-sensitive work, and it cuts the thinking
      // token spend (the biggest cost driver here) without touching structured
      // outputs or the exclusion logic, which stays fully specified in the
      // system prompt regardless of effort.
      output_config: {
        effort: 'low',
        format: zodOutputFormat(analisisSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            // The document block goes BEFORE the text block.
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text:
                `Analiza este extracto bancario${
                  typeof nombreArchivo === 'string' ? ` (${nombreArchivo})` : ''
                }. ` +
                'Extrae TODOS los movimientos y marca con `exclusion` los que no deben sumarse ' +
                'a los totales. Calcula las métricas usando solo los movimientos no excluidos.',
            },
          ],
        },
      ],
    });

    const mensaje = await stream.finalMessage();

    // Opus 5 can decline with HTTP 200. Reading content[0] before checking this
    // would throw on an empty content array.
    if (mensaje.stop_reason === 'refusal') {
      return await fallar(
        'rechazado',
        'Claude declinó procesar este documento. Revisa que sea un extracto bancario.',
      );
    }

    const texto = mensaje.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === 'text')
      .map((bloque) => bloque.text)
      .join('');

    if (!texto.trim()) {
      return await fallar('respuesta-invalida', 'Claude devolvió una respuesta vacía.');
    }

    let crudo: unknown;
    try {
      crudo = JSON.parse(texto);
    } catch {
      return await fallar('respuesta-invalida', 'La respuesta no era JSON válido.');
    }

    // Validate even though structured outputs constrain the shape: a
    // `max_tokens` cutoff mid-object produces valid-looking truncated JSON.
    const validado = analisisSchema.safeParse(crudo);
    if (!validado.success) {
      return await fallar(
        'respuesta-invalida',
        `El análisis no cumplió el esquema: ${validado.error.issues[0]?.message ?? 'desconocido'}`,
      );
    }

    // Normalize what the schema could not constrain (no numeric bounds are
    // allowed in structured-output JSON Schema), so the client never has to.
    const resultado = {
      ...validado.data,
      movimientos: validado.data.movimientos.map((mov) => ({
        ...mov,
        montoCop: Math.abs(Math.round(mov.montoCop)),
      })),
      metricas: validado.data.metricas.map((fila) => ({
        ...fila,
        valorCop: Math.round(fila.valorCop),
      })),
    };

    const uso = mensaje.usage;
    const leidosDeCache = uso.cache_read_input_tokens ?? 0;

    await store.setJSON(jobId, {
      estado: 'listo',
      resultado,
      usoTokens: {
        entrada: uso.input_tokens,
        salida: uso.output_tokens,
        leidosDeCache,
        costoUsd:
          Math.round(
            (uso.input_tokens * PRECIO.entrada +
              uso.output_tokens * PRECIO.salida +
              leidosDeCache * PRECIO.cache) *
              10_000,
          ) / 10_000,
      },
    });

    return new Response(null, { status: 202 });
  } catch (error) {
    // Typed, most-specific-first. Never string-match error messages.
    if (error instanceof Anthropic.RateLimitError) {
      return await fallar('limite-api', 'Se alcanzó el límite de la API. Intenta en unos minutos.');
    }
    if (error instanceof Anthropic.BadRequestError) {
      return await fallar('pdf-invalido', `La API rechazó la petición: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      return await fallar('fallo-interno', `Error de la API (${error.status}).`);
    }
    // Deliberately does not include the raw message: it can contain fragments of
    // the statement, and Netlify retains function logs.
    return await fallar('fallo-interno', 'Falló el procesamiento del extracto.');
  }
};
