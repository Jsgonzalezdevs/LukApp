import type { ContextoFinanciero, SenalFinanciera } from './motorFinanciero';
import type { MetaInteligente } from './metasInteligentes';

export interface ResumenInteligenciaFinanciera {
  situacion: 'estable' | 'atencion' | 'riesgo' | 'incompleta';
  disponibleDiarioCop: number;
  disponibleDiarioBrutoCop: number;
  patrimonioCop: number;
  obligacionesProximas: ContextoFinanciero['obligaciones'];
  señales: readonly SenalFinanciera[];
  metas: readonly MetaInteligente[];
  proyeccion: ContextoFinanciero['proyeccionCompleta'];
  forecast: ContextoFinanciero['forecast'] | null;
  evidencia: readonly string[];
}

export interface ContextoParaAsesor {
  /** Campos heredados solo para compatibilidad con el endpoint actual. */
  gastosMesCop?: number;
  ingresosMesCop?: number;
  totalTransaccionesMes?: number;
  patrimonioCop: number;
  liquidez: ContextoFinanciero['liquidez'];
  compromisos: ContextoFinanciero['compromisos'];
  obligaciones: ContextoFinanciero['obligaciones'];
  entradasFuturas: ContextoFinanciero['entradasFuturas'];
  proyeccion: ContextoFinanciero['proyeccionCompleta'];
  forecast: ContextoFinanciero['forecast'] | null;
  señales: readonly SenalFinanciera[];
  metas: readonly MetaInteligente[];
  tarjetas: ContextoFinanciero['tarjetas'];
  presupuestos: ContextoFinanciero['presupuestos'];
  incertidumbres: readonly string[];
}

/**
 * Fachada semántica para consumidores: ensambla el contexto, pero no vuelve a
 * calcular ninguna cifra. Así Dashboard, insights y asesor pueden compartir
 * una lectura estable sin convertir la capa de presentación en otro motor.
 */
export const construirCentroInteligencia = (
  contexto: ContextoFinanciero,
): ResumenInteligenciaFinanciera => {
  const nivel = contexto.liquidez.nivel;
  return {
    situacion: nivel === 'incompleto' ? 'incompleta' : nivel === 'riesgo' ? 'riesgo' : nivel === 'atencion' ? 'atencion' : 'estable',
    disponibleDiarioCop: contexto.liquidez.disponibleDiarioCop,
    disponibleDiarioBrutoCop: contexto.liquidez.disponibleDiarioBrutoCop,
    patrimonioCop: contexto.saldo.patrimonioCop,
    obligacionesProximas: contexto.obligaciones,
    señales: [...(contexto.anomalias ?? [])].sort((a, b) => b.confianza - a.confianza || (b.impactoCop ?? 0) - (a.impactoCop ?? 0)),
    metas: [...(contexto.metasInteligentes ?? [])],
    proyeccion: contexto.proyeccionCompleta,
    forecast: contexto.forecast ?? null,
    evidencia: contexto.liquidez.factores.map((factor) => `${factor.concepto}: ${factor.montoCop} COP (${factor.certeza})`),
  };
};

/** Contrato mínimo para IA: solo datos derivados, sin movimientos crudos. */
export const construirContextoParaAsesor = (contexto: ContextoFinanciero): ContextoParaAsesor => ({
  patrimonioCop: contexto.saldo.patrimonioCop,
  liquidez: contexto.liquidez,
  compromisos: contexto.compromisos,
  obligaciones: contexto.obligaciones,
  entradasFuturas: contexto.entradasFuturas,
  proyeccion: contexto.proyeccionCompleta,
  forecast: contexto.forecast ?? null,
  señales: construirCentroInteligencia(contexto).señales,
  metas: [...(contexto.metasInteligentes ?? [])],
  tarjetas: contexto.tarjetas,
  presupuestos: contexto.presupuestos,
  incertidumbres: [
    ...(contexto.liquidez.confianza !== 'alta' ? [`Liquidez con confianza ${contexto.liquidez.confianza}.`] : []),
    ...(contexto.compromisos.datosIncompletos ? ['Hay datos financieros incompletos.'] : []),
  ],
});
