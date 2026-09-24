export interface ModeloGroq {
  id: string;
  esfuerzoRazonamiento: 'none' | 'low';
}

/**
 * Groq permite habilitar modelos distintos por proyecto. Qwen queda como
 * respaldo sin razonamiento para que el Asesor siga respondiendo cuando los
 * GPT-OSS estén restringidos o agoten su presupuesto de razonamiento.
 */
export const MODELOS_GROQ_ASESOR: readonly ModeloGroq[] = [
  { id: 'openai/gpt-oss-120b', esfuerzoRazonamiento: 'low' },
  { id: 'openai/gpt-oss-20b', esfuerzoRazonamiento: 'low' },
  { id: 'qwen/qwen3.8-27b', esfuerzoRazonamiento: 'none' },
];
