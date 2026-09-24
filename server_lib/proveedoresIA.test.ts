import { describe, expect, it } from 'vitest';
import { MODELOS_GROQ_ASESOR } from './proveedoresIA';

describe('modelos de Groq para el Asesor', () => {
  it('conserva GPT-OSS y tiene un respaldo sin razonamiento', () => {
    expect(MODELOS_GROQ_ASESOR).toContainEqual({
      id: 'openai/gpt-oss-120b',
      esfuerzoRazonamiento: 'low',
    });
    expect(MODELOS_GROQ_ASESOR).toContainEqual({
      id: 'qwen/qwen3.8-27b',
      esfuerzoRazonamiento: 'none',
    });
  });
});
