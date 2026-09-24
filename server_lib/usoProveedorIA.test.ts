import { describe, expect, it } from 'vitest';
import {
  cuotaGroqDesdeCabeceras,
  usoDesdeRespuestaChat,
  usoDesdeRespuestaClaude,
  usoDesdeRespuestaGemini,
} from './usoProveedorIA';

describe('uso del proveedor de IA', () => {
  it('conserva el uso real entregado por Groq', () => {
    expect(usoDesdeRespuestaChat({
      usage: { prompt_tokens: 76, completion_tokens: 20, total_tokens: 96 },
    })).toEqual({ promptTokens: 76, completionTokens: 20, totalTokens: 96 });
  });

  it('normaliza las respuestas de Gemini y Claude', () => {
    expect(usoDesdeRespuestaGemini({
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
    })).toEqual({ promptTokens: 12, completionTokens: 8, totalTokens: 20 });
    expect(usoDesdeRespuestaClaude({
      usage: { input_tokens: 12, output_tokens: 8 },
    })).toEqual({ promptTokens: 12, completionTokens: 8, totalTokens: 20 });
  });

  it('lee los límites reales de Groq sin confundir minuto y día', () => {
    const cabeceras = new Headers({
      'x-ratelimit-limit-tokens': '8000',
      'x-ratelimit-remaining-tokens': '7900',
      'x-ratelimit-limit-requests': '1000',
      'x-ratelimit-remaining-requests': '999',
    });

    expect(cuotaGroqDesdeCabeceras(cabeceras)).toEqual({
      limiteTokensMinuto: 8000,
      tokensRestantesMinuto: 7900,
      limiteSolicitudesDia: 1000,
      solicitudesRestantesDia: 999,
    });
  });

  it('no convierte cabeceras ausentes en una cuota de cero', () => {
    expect(cuotaGroqDesdeCabeceras(new Headers())).toBeNull();
  });
});
