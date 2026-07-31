import { GoogleGenAI } from '@google/genai';
import { analisisJsonSchema, analisisSchema } from './esquema';
import { SYSTEM_PROMPT } from './prompt';
import type { AnalisisValidado } from './esquema';

// Flash rather than Pro: this is bounded extraction and classification against
// a fixed taxonomy already fully specified in the system prompt, not
// open-ended reasoning — and Flash is the model with a real free-tier quota.
const MODELO = 'gemini-2.5-flash';

export type ResultadoGemini =
  | { ok: true; resultado: AnalisisValidado; tokensEntrada: number; tokensSalida: number }
  | { ok: false; motivo: 'bloqueado-antes' | 'bloqueado-durante' | 'respuesta-vacia' | 'json-invalido' | 'esquema-invalido'; detalle: string };

/**
 * Sends already-redacted statement text to Gemini and validates the result.
 *
 * Two independent safety nets, because structured-output enforcement is a
 * request-time hint, not a guarantee: (1) `finishReason` catches a mid-
 * generation safety block, which — like Claude's `stop_reason: "refusal"` —
 * can arrive as a normal HTTP 200 with no exception thrown; (2) parsing the
 * text as JSON and then validating it against the SAME Zod schema used to
 * build the request catches a `MAX_TOKENS` cutoff or any other case where the
 * model's declared schema-following fell short in practice.
 */
export const analizarConGemini = async (
  apiKey: string,
  textoRedactado: string,
): Promise<ResultadoGemini> => {
  const cliente = new GoogleGenAI({ apiKey });

  const respuesta = await cliente.models.generateContent({
    model: MODELO,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Analiza este extracto bancario (texto ya extraído del PDF original y con los ' +
              'datos personales ocultos). Extrae TODOS los movimientos y marca con `exclusion` ' +
              'los que no deben sumarse a los totales. Calcula las métricas usando solo los ' +
              'movimientos no excluidos.\n\n---\n\n' +
              textoRedactado,
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: analisisJsonSchema,
      // Extraction against a fixed schema, not creative writing.
      temperature: 0.1,
    },
  });

  // A prompt can be blocked before any candidate is generated at all — this
  // is checked FIRST because in that case `candidates` is typically empty and
  // reading `candidates[0]` directly would throw.
  const bloqueoPrevio = respuesta.promptFeedback?.blockReason;
  if (bloqueoPrevio) {
    return {
      ok: false,
      motivo: 'bloqueado-antes',
      detalle: `Gemini bloqueó la solicitud antes de procesarla (${bloqueoPrevio}).`,
    };
  }

  const candidato = respuesta.candidates?.[0];
  const razon = candidato?.finishReason;

  // STOP and MAX_TOKENS both carry real content worth trying to parse — a
  // truncated-but-valid-looking JSON object is exactly what the schema
  // validation below is for. Every other reason (SAFETY, RECITATION,
  // BLOCKLIST, LANGUAGE, OTHER, ...) means there is no usable content.
  if (razon && razon !== 'STOP' && razon !== 'MAX_TOKENS') {
    return {
      ok: false,
      motivo: 'bloqueado-durante',
      detalle: `Gemini detuvo la generación antes de terminar (${razon}).`,
    };
  }

  const texto = respuesta.text;
  if (!texto || !texto.trim()) {
    return { ok: false, motivo: 'respuesta-vacia', detalle: 'Gemini devolvió una respuesta vacía.' };
  }

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'json-invalido', detalle: 'La respuesta no era JSON válido.' };
  }

  const validado = analisisSchema.safeParse(crudo);
  if (!validado.success) {
    return {
      ok: false,
      motivo: 'esquema-invalido',
      detalle: `El análisis no cumplió el esquema: ${validado.error.issues[0]?.message ?? 'desconocido'}`,
    };
  }

  const uso = respuesta.usageMetadata;
  return {
    ok: true,
    resultado: validado.data,
    tokensEntrada: uso?.promptTokenCount ?? 0,
    tokensSalida: uso?.candidatesTokenCount ?? 0,
  };
};
