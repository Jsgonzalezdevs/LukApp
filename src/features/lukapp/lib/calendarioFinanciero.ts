import type { ContextoFinanciero } from './motorFinanciero';

export type PrecisionEvento = 'exacta' | 'periodo' | 'estimada' | 'desconocida';
export type EstadoEvento = 'proximo' | 'hoy' | 'vencido' | 'registrado' | 'desconocido';
export interface EventoFinanciero {
  id: string;
  tipo: 'ingreso' | 'obligacion' | 'pago-tarjeta' | 'deuda' | 'recurrente';
  fecha: string | null;
  periodo: string | null;
  montoCop: number | null;
  impacto: 'entrada' | 'salida';
  concepto: string;
  origen: string;
  estado: EstadoEvento;
  precision: PrecisionEvento;
  certeza: 'real' | 'programada' | 'estimada' | 'desconocida';
  evidencia: readonly string[];
}

/** Adaptador de presentación: no recalcula importes ni descubre obligaciones. */
export const eventosDelContexto = (contexto: ContextoFinanciero, hoy: string): EventoFinanciero[] => {
  const obligaciones = contexto.obligaciones.map((o) => ({
    id: o.id,
    tipo: o.origen === 'tarjeta' ? 'pago-tarjeta' as const : o.origen === 'deuda' ? 'deuda' as const : o.origen === 'recurrente' ? 'recurrente' as const : 'obligacion' as const,
    fecha: o.fecha,
    periodo: o.periodo,
    montoCop: o.montoCop,
    impacto: 'salida' as const,
    concepto: o.concepto,
    origen: o.origen,
    estado: o.fecha === null ? 'desconocido' as const : o.fecha < hoy ? 'vencido' as const : o.fecha === hoy ? 'hoy' as const : 'proximo' as const,
    precision: o.fecha === null ? 'periodo' as const : o.certeza === 'estimada' ? 'estimada' as const : 'exacta' as const,
    certeza: o.certeza,
    evidencia: [o.origen, ...(o.periodo ? [`Período ${o.periodo}`] : [])],
  }));
  const entradas = contexto.entradasFuturas.map((e) => ({
    id: e.id, tipo: 'ingreso' as const, fecha: e.fecha, periodo: e.periodo, montoCop: e.montoCop,
    impacto: 'entrada' as const, concepto: e.concepto, origen: 'recurrente',
    estado: e.fecha === null ? 'desconocido' as const : e.fecha < hoy ? 'vencido' as const : e.fecha === hoy ? 'hoy' as const : 'proximo' as const,
    precision: e.fecha === null ? 'desconocida' as const : e.certeza === 'estimada' ? 'estimada' as const : 'exacta' as const,
    certeza: e.certeza, evidencia: ['ingreso futuro', ...(e.periodo ? [`Período ${e.periodo}`] : [])],
  }));
  return [...obligaciones, ...entradas].sort((a, b) => (a.fecha ?? '9999-99-99').localeCompare(b.fecha ?? '9999-99-99') || a.id.localeCompare(b.id));
};
