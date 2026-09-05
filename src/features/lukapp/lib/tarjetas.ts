import type { Cajita, CajitaMovimiento } from '../data/modelos';
import type { Transaction } from '../types';
import { pagoPendienteTarjeta } from './cuotasTarjeta';

export interface ResumenTarjeta {
  tarjetaId: string;
  saldoUtilizadoCop: number;
  limiteCreditoCop: number | null;
  cupoDisponibleCop: number | null;
  pagoSiguienteCop: number;
  pagoMinimoCop: number | null;
  fechaCorteSiguiente: string | null;
  fechaPagoSiguiente: string | null;
  certezaPago: 'real' | 'estimada';
}

export type PosicionCompraEnCiclo = 'antes-del-corte' | 'en-el-corte' | 'despues-del-corte' | 'desconocida';
export type PosicionExtracto = 'actual' | 'siguiente' | 'anterior' | 'desconocido';

export interface ClasificacionCompraTarjeta {
  posicion: PosicionCompraEnCiclo;
  extracto: string | null;
  posicionExtracto: PosicionExtracto;
}

const fechaConDia = (mes: string, dia: number): string => {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const ultimo = new Date(anio, numeroMes, 0).getDate();
  return `${mes}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, '0')}`;
};

const siguienteMes = (mes: string): string => {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const fecha = new Date(anio, numeroMes, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Regla única de extractos:
 * - el día de corte pertenece al extracto de ese mismo mes;
 * - una compra posterior al corte pertenece al extracto del mes siguiente;
 * - el día configurado se ajusta al último día real del mes (31 en febrero
 *   equivale al 28/29; en meses de 30, al 30);
 * - `fechaReferencia` determina el ciclo abierto: antes del corte el extracto
 *   actual es el del mes de referencia; después del corte es el siguiente;
 * - si falta fecha, día de corte o la fecha no es YYYY-MM-DD válida, se devuelve
 *   desconocido. Nunca se fabrica una fecha ni un extracto.
 */
export const clasificarCompraTarjeta = (
  tarjeta: Cajita,
  fechaCompra: string,
  fechaReferencia: string,
): ClasificacionCompraTarjeta => {
  const dia = tarjeta.tipo === 'tarjeta' ? tarjeta.diaCorte : null;
  const valida = (fecha: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const [anio, mes, diaFecha] = fecha.split('-').map(Number);
    const objeto = new Date(anio, mes - 1, diaFecha);
    return objeto.getFullYear() === anio && objeto.getMonth() === mes - 1 && objeto.getDate() === diaFecha;
  };
  if (!dia || dia < 1 || dia > 31 || !valida(fechaCompra) || !valida(fechaReferencia)) {
    return { posicion: 'desconocida', extracto: null, posicionExtracto: 'desconocido' };
  }
  const mesCompra = fechaCompra.slice(0, 7);
  const corteCompra = fechaConDia(mesCompra, dia);
  const posicion: PosicionCompraEnCiclo = fechaCompra < corteCompra ? 'antes-del-corte' : fechaCompra === corteCompra ? 'en-el-corte' : 'despues-del-corte';
  const extracto = posicion === 'despues-del-corte' ? siguienteMes(mesCompra) : mesCompra;
  const mesReferencia = fechaReferencia.slice(0, 7);
  const corteReferencia = fechaConDia(mesReferencia, dia);
  const extractoActual = fechaReferencia <= corteReferencia ? mesReferencia : siguienteMes(mesReferencia);
  const orden = (mes: string) => {
    const [anio, numero] = mes.split('-').map(Number);
    return anio * 12 + numero;
  };
  const diferencia = orden(extracto) - orden(extractoActual);
  return {
    posicion,
    extracto,
    posicionExtracto: diferencia === 0 ? 'actual' : diferencia === 1 ? 'siguiente' : diferencia < 0 ? 'anterior' : 'desconocido',
  };
};

/** Próximo corte/pago, sin asumir fechas cuando la tarjeta no las informa. */
export const fechasTarjeta = (tarjeta: Cajita, hoy: string) => {
  if (tarjeta.tipo !== 'tarjeta') return { corte: null, pago: null };
  const mes = hoy.slice(0, 7);
  const corte = tarjeta.diaCorte ? fechaConDia(mes, tarjeta.diaCorte) >= hoy ? fechaConDia(mes, tarjeta.diaCorte) : fechaConDia(siguienteMes(mes), tarjeta.diaCorte) : null;
  if (!tarjeta.diaPago) return { corte, pago: null };
  const corteMes = corte?.slice(0, 7) ?? mes;
  const pagoMes = corteMes;
  let pago = fechaConDia(pagoMes, tarjeta.diaPago);
  if (corte !== null && pago <= corte) pago = fechaConDia(siguienteMes(pagoMes), tarjeta.diaPago);
  return { corte, pago };
};

/** Fecha de pago asociada al extracto de un mes; null si no fue configurada. */
export const fechaPagoDePeriodo = (tarjeta: Cajita, periodo: string): string | null => {
  if (tarjeta.tipo !== 'tarjeta' || !tarjeta.diaPago) return null;
  const [anio, mes] = periodo.split('-').map(Number);
  const corte = tarjeta.diaCorte ? Math.min(tarjeta.diaCorte, new Date(anio, mes, 0).getDate()) : null;
  const pago = fechaConDia(periodo, tarjeta.diaPago);
  return corte !== null && pago <= fechaConDia(periodo, corte) ? fechaConDia(siguienteMes(periodo), tarjeta.diaPago) : pago;
};

/** Resumen presentacional: no reemplaza el saldo contable del motor. */
export const resumenTarjeta = (
  tarjeta: Cajita,
  saldoUtilizadoCop: number,
  transacciones: readonly Transaction[],
  movimientos: readonly CajitaMovimiento[],
  mes: string,
  hoy: string,
): ResumenTarjeta => {
  const fechas = fechasTarjeta(tarjeta, hoy);
  const pagoSiguienteCop = pagoPendienteTarjeta(transacciones, movimientos, tarjeta.id, mes, fechas.pago ?? `${mes}-31`);
  const limite = tarjeta.limiteCreditoCop ?? null;
  return {
    tarjetaId: tarjeta.id,
    saldoUtilizadoCop,
    limiteCreditoCop: limite,
    cupoDisponibleCop: limite === null ? null : Math.max(0, limite - Math.max(0, saldoUtilizadoCop)),
    pagoSiguienteCop,
    pagoMinimoCop: tarjeta.pagoMinimoCop ?? null,
    fechaCorteSiguiente: fechas.corte,
    fechaPagoSiguiente: fechas.pago,
    certezaPago: pagoSiguienteCop > 0 ? 'real' : 'estimada',
  };
};
