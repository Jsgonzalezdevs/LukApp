import { describe, expect, it } from 'vitest';
import { MODELOS_GROQ_ASESOR, ordenModelosGroq } from './proveedoresIA';

describe('modelos de Groq para el Asesor', () => {
  it('conserva GPT-OSS y tiene un respaldo sin razonamiento', () => {
    expect(MODELOS_GROQ_ASESOR).toContainEqual({
      id: 'openai/gpt-oss-120b',
      esfuerzoRazonamiento: 'low',
      economico: false,
    });
    expect(MODELOS_GROQ_ASESOR).toContainEqual({
      id: 'qwen/qwen3.8-27b',
      esfuerzoRazonamiento: 'none',
      economico: false,
    });
  });
});

describe('ordenModelosGroq', () => {
  it('con preferirEconomico intenta primero gpt-oss-20b y no el 120b', () => {
    expect(ordenModelosGroq(true).map((m) => m.id)).toEqual([
      'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b',
    ]);
  });
  it('sin preferencia respeta el orden original', () => {
    expect(ordenModelosGroq(false)[0].id).toBe('openai/gpt-oss-120b');
  });
});
