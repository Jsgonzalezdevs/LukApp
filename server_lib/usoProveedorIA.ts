export interface UsoTokensIA {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CuotaProveedorIA {
  limiteTokensMinuto: number | null;
  tokensRestantesMinuto: number | null;
  limiteSolicitudesDia: number | null;
  solicitudesRestantesDia: number | null;
}

const numeroNoNegativo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero) : null;
};

const usoDesdeCampos = (prompt: unknown, completion: unknown, total: unknown): UsoTokensIA | null => {
  const promptTokens = numeroNoNegativo(prompt);
  const completionTokens = numeroNoNegativo(completion);
  const totalTokens = numeroNoNegativo(total);
  if (promptTokens === null && completionTokens === null && totalTokens === null) return null;

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
  };
};

/** Uso exacto devuelto por APIs compatibles con OpenAI, como Groq y DeepSeek. */
export const usoDesdeRespuestaChat = (respuesta: unknown): UsoTokensIA | null => {
  const uso = respuesta && typeof respuesta === 'object'
    ? (respuesta as { usage?: Record<string, unknown> }).usage
    : undefined;
  return usoDesdeCampos(uso?.prompt_tokens, uso?.completion_tokens, uso?.total_tokens);
};

export const usoDesdeRespuestaGemini = (respuesta: unknown): UsoTokensIA | null => {
  const uso = respuesta && typeof respuesta === 'object'
    ? (respuesta as { usageMetadata?: Record<string, unknown> }).usageMetadata
    : undefined;
  return usoDesdeCampos(uso?.promptTokenCount, uso?.candidatesTokenCount, uso?.totalTokenCount);
};

export const usoDesdeRespuestaClaude = (respuesta: unknown): UsoTokensIA | null => {
  const uso = respuesta && typeof respuesta === 'object'
    ? (respuesta as { usage?: Record<string, unknown> }).usage
    : undefined;
  return usoDesdeCampos(uso?.input_tokens, uso?.output_tokens, undefined);
};

/**
 * Groq entrega estos valores en cada respuesta. La cuota de tokens es por
 * minuto y la de solicitudes por día; nunca se presentan como una cuota diaria
 * inventada por LukApp.
 */
export const cuotaGroqDesdeCabeceras = (cabeceras: Headers): CuotaProveedorIA | null => {
  const cuota: CuotaProveedorIA = {
    limiteTokensMinuto: numeroNoNegativo(cabeceras.get('x-ratelimit-limit-tokens')),
    tokensRestantesMinuto: numeroNoNegativo(cabeceras.get('x-ratelimit-remaining-tokens')),
    limiteSolicitudesDia: numeroNoNegativo(cabeceras.get('x-ratelimit-limit-requests')),
    solicitudesRestantesDia: numeroNoNegativo(cabeceras.get('x-ratelimit-remaining-requests')),
  };
  return Object.values(cuota).some((valor) => valor !== null) ? cuota : null;
};
