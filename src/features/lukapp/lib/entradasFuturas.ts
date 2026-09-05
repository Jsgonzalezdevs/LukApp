import type { Instantanea } from '../data/repositorio';
import { fechaEnMes, yaRegistrado } from './recurrentes';

export interface EntradaFutura { id: string; fecha: string | null; periodo: string | null; montoCop: number; certeza: 'programada' | 'estimada' | 'desconocida'; concepto: string }

/** Única interpretación de ingresos futuros; no incluye movimientos ya hechos. */
export const construirEntradasFuturas = (entrada: Instantanea & { hoy: string }, horizonteDias = 90): EntradaFutura[] => {
  const salida: EntradaFutura[] = [];
  const [anio, mes, dia] = entrada.hoy.split('-').map(Number);
  const hasta = new Date(anio, mes - 1, dia + Math.max(0, horizonteDias));
  const meses: string[] = [];
  for (let cursor = new Date(anio, mes - 1, 1); cursor <= hasta; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
  }
  for (const recurrente of entrada.recurrentes.filter((r) => r.archivedAt === null && r.kind === 'ingreso')) {
    for (const periodo of meses) {
      if (yaRegistrado(recurrente, entrada.transacciones, periodo)) continue;
      const fecha = Number.isInteger(recurrente.diaDelMes) && recurrente.diaDelMes >= 1 && recurrente.diaDelMes <= 31 ? fechaEnMes(recurrente, periodo) : null;
      if (fecha === null || (fecha >= entrada.hoy && fecha <= hasta.toISOString().slice(0, 10))) salida.push({ id: `ingreso-${recurrente.id}-${periodo}`, fecha, periodo, montoCop: recurrente.amountCop, certeza: fecha ? 'programada' : 'desconocida', concepto: recurrente.nombre });
    }
  }
  return salida.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.id.localeCompare(b.id));
};
