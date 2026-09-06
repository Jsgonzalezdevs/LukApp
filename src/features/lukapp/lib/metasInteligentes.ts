import type { ContextoFinanciero } from './motorFinanciero';
import type { MetaConProgreso } from './metas';

export type ViabilidadMeta = 'viable' | 'ajustada' | 'en_riesgo' | 'sin_datos';
export interface MetaInteligente extends MetaConProgreso {
  restanteCop: number | null;
  ritmoActualCop: number | null;
  ritmoNecesarioCop: number | null;
  fechaEstimada: string | null;
  viabilidad: ViabilidadMeta;
  confianza: 'alta' | 'media' | 'baja';
  evidencia: readonly string[];
}

/** Interpreta metas sin convertirlas en obligaciones ni recalcular liquidez. */
export const evaluarMetas = (contexto: ContextoFinanciero): MetaInteligente[] => contexto.metas.map((fila) => {
  const { progreso } = fila;
  const tieneObjetivo = Number.isFinite(progreso.objetivoCop) && progreso.objetivoCop > 0;
  const ritmoNecesarioCop = progreso.ritmoMensualCop;
  const ritmoActualCop = null; // El modelo no identifica ahorro nuevo sin confundir transferencias con ahorro.
  const dineroLibre = contexto.liquidez.dineroLibreCop;
  const viabilidad: ViabilidadMeta = !tieneObjetivo ? 'sin_datos' : progreso.completada ? 'viable' : ritmoNecesarioCop === null ? 'sin_datos' : ritmoNecesarioCop <= dineroLibre ? 'viable' : 'en_riesgo';
  const evidencia = !tieneObjetivo
    ? ['Falta monto objetivo.']
    : progreso.completada
      ? ['Meta alcanzada.']
      : ['El modelo no identifica ahorro nuevo sin confundir transferencias internas con ahorro.'];
  return { ...fila, restanteCop: tieneObjetivo ? progreso.faltaCop : null, ritmoActualCop, ritmoNecesarioCop, fechaEstimada: null, viabilidad, confianza: 'baja', evidencia };
});
