import type { Instantanea } from '../data/repositorio';
import { fechaEnMes, yaRegistrado } from './recurrentes';
import { fechaPagoDePeriodo, resumenTarjeta } from './tarjetas';
import { pagoMensualTarjeta } from './cuotasTarjeta';
import { totalPorTipo } from './cajitas';

export interface ObligacionFutura {
  id: string;
  origen: 'recurrente' | 'cuota' | 'tarjeta' | 'deuda' | 'manual';
  concepto: string;
  fecha: string | null;
  periodo: string | null;
  montoCop: number | null;
  cuentaId: string | null;
  estado: 'programada' | 'vencida' | 'confirmada' | 'desconocida';
  certeza: 'real' | 'programada' | 'estimada' | 'desconocida';
}

const sumarDias = (fecha: string, dias: number) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const salida = new Date(anio, mes - 1, dia + dias);
  return `${salida.getFullYear()}-${String(salida.getMonth() + 1).padStart(2, '0')}-${String(salida.getDate()).padStart(2, '0')}`;
};

/** Único constructor: las cuotas se trazan, pero el pago de tarjeta es la salida. */
export const construirObligacionesFuturas = (entrada: Instantanea & { hoy: string }, horizonteDias = 90): ObligacionFutura[] => {
  const hasta = sumarDias(entrada.hoy, Math.max(0, horizonteDias));
  const meses = new Set<string>();
  for (let fecha = entrada.hoy; fecha <= hasta; fecha = sumarDias(fecha, 1)) meses.add(fecha.slice(0, 7));
  const salida: ObligacionFutura[] = [];
  for (const mes of meses) {
    for (const recurrente of entrada.recurrentes.filter((r) => r.archivedAt === null && r.kind === 'gasto')) {
      if (mes === entrada.hoy.slice(0, 7) && yaRegistrado(recurrente, entrada.transacciones, mes)) continue;
      const fecha = fechaEnMes(recurrente, mes);
      if (fecha >= entrada.hoy && fecha <= hasta) salida.push({ id: `recurrente-${recurrente.id}-${fecha}`, origen: 'recurrente', concepto: recurrente.nombre, fecha, periodo: mes, montoCop: recurrente.amountCop, cuentaId: recurrente.cuentaId, estado: 'programada', certeza: 'programada' });
    }
  }
  for (const tarjeta of entrada.cajitas.filter((c) => c.tipo === 'tarjeta' && c.archivedAt === null)) {
    const saldo = Math.abs(totalPorTipo([tarjeta], entrada.cajitaMovimientos, 'tarjeta', entrada.transacciones));
    for (const mes of meses) {
      const pago = mes === entrada.hoy.slice(0, 7) ? resumenTarjeta(tarjeta, saldo, entrada.transacciones, entrada.cajitaMovimientos, mes, entrada.hoy).pagoSiguienteCop : pagoMensualTarjeta(entrada.transacciones, tarjeta.id, mes);
      const fecha = fechaPagoDePeriodo(tarjeta, mes);
      const limiteMes = hasta;
      if (pago <= 0) continue;
      if (fecha && fecha >= entrada.hoy && fecha <= hasta) salida.push({ id: `pago-tarjeta-${tarjeta.id}-${mes}`, origen: 'tarjeta', concepto: `Pago de ${tarjeta.nombre}`, fecha, periodo: mes, montoCop: pago, cuentaId: null, estado: 'programada', certeza: 'estimada' });
      else if (!fecha && (mes === entrada.hoy.slice(0, 7) || limiteMes >= entrada.hoy)) salida.push({ id: `pago-tarjeta-${tarjeta.id}-${mes}`, origen: 'tarjeta', concepto: `Pago de ${tarjeta.nombre}`, fecha: null, periodo: mes, montoCop: pago, cuentaId: null, estado: 'desconocida', certeza: 'desconocida' });
    }
    // Evita que las cuotas individuales vuelvan a ser salidas además del pago mensual.
  }
  for (const deuda of entrada.cajitas.filter((c) => c.tipo === 'deuda' && c.archivedAt === null)) {
    const importe = Math.abs(totalPorTipo([deuda], entrada.cajitaMovimientos, 'deuda', entrada.transacciones));
    if (importe > 0) salida.push({ id: `deuda-${deuda.id}`, origen: 'deuda', concepto: `Saldo pendiente de ${deuda.nombre}`, fecha: null, periodo: entrada.hoy.slice(0, 7), montoCop: importe, cuentaId: deuda.id, estado: 'desconocida', certeza: 'desconocida' });
  }
  return salida.sort((a, b) => (a.fecha ?? '9999-99-99').localeCompare(b.fecha ?? '9999-99-99') || a.id.localeCompare(b.id));
};
