export interface ModeloGroq {
  id: string;
  esfuerzoRazonamiento: 'none' | 'low';
  /** Se marca a mano: deducirlo del id fallaba porque «gpt-oss-120b» también
   * termina en «20b» y el modelo grande pasaba por económico. */
  economico: boolean;
}

/**
 * Groq permite habilitar modelos distintos por proyecto. Qwen queda como
 * respaldo sin razonamiento para que el Asesor siga respondiendo cuando los
 * GPT-OSS estén restringidos o agoten su presupuesto de razonamiento.
 */
export const MODELOS_GROQ_ASESOR: readonly ModeloGroq[] = [
  { id: 'openai/gpt-oss-120b', esfuerzoRazonamiento: 'low', economico: false },
  { id: 'openai/gpt-oss-20b', esfuerzoRazonamiento: 'low', economico: true },
  { id: 'qwen/qwen3.8-27b', esfuerzoRazonamiento: 'none', economico: false },
];

/** Orden de intento: con `preferirEconomico` el modelo liviano va primero y
 * los demás quedan de respaldo en su orden original (sort es estable). */
export const ordenModelosGroq = (preferirEconomico: boolean): readonly ModeloGroq[] => preferirEconomico
  ? [...MODELOS_GROQ_ASESOR].sort((a, b) => Number(b.economico) - Number(a.economico))
  : MODELOS_GROQ_ASESOR;
