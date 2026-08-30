import type { Transaction } from '../types';
import type { CajitaMovimiento } from '../data/modelos';

export interface CuotaProgramada {
  transaccionId: string;
  numero: number;
  total: number;
  montoCop: number;
  venceEn: string;
}

const sumarMeses = (fecha: string, meses: number): string => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const destino = new Date(anio, mes - 1 + meses, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
};

/** Cuotas futuras de compras que realmente fueron diferidas. */
export const cuotasDeTarjeta = (
  transacciones: readonly Transaction[],
  tarjetaId: string,
): CuotaProgramada[] =>
  transacciones
    .filter((tx) => tx.cuentaId === tarjetaId && (tx.cuotasTotal ?? 0) >= 2 && (tx.cuotaCop ?? 0) > 0)
    .flatMap((tx) =>
      Array.from({ length: tx.cuotasTotal ?? 0 }, (_, indice) => ({
        transaccionId: tx.id,
        numero: indice + 1,
        total: tx.cuotasTotal ?? 0,
        montoCop: tx.cuotaCop ?? 0,
        venceEn: sumarMeses(tx.occurredOn, indice),
      })),
    )
    .sort((a, b) => a.venceEn.localeCompare(b.venceEn));

/** Total que se debería apartar en el mes de una tarjeta. */
export const pagoMensualTarjeta = (
  transacciones: readonly Transaction[],
  tarjetaId: string,
  mes: string,
): number =>
  cuotasDeTarjeta(transacciones, tarjetaId)
    .filter((cuota) => cuota.venceEn.slice(0, 7) === mes)
    .reduce((total, cuota) => total + cuota.montoCop, 0);

/** Último día de un mes, sin depender de la zona horaria del navegador. */
const finDeMes = (mes: string): string => {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const ultimoDia = new Date(anio, numeroMes, 0).getDate();
  return `${mes}-${String(ultimoDia).padStart(2, '0')}`;
};

/**
 * Lo que aún falta por cubrir este mes después de los abonos ya registrados.
 *
 * Los pagos se aplican primero a la cuota más antigua que ya venció. Así un
 * abono no solo baja el saldo global de la tarjeta: también hace desaparecer
 * el aviso del mes cuando ya se cubrió. Las cuotas futuras no se consumen por
 * accidente con un pago corriente.
 */
export const pagoPendienteTarjeta = (
  transacciones: readonly Transaction[],
  movimientos: readonly CajitaMovimiento[],
  tarjetaId: string,
  mes: string,
  hasta: string = finDeMes(mes),
): number => {
  const cuotas = cuotasDeTarjeta(transacciones, tarjetaId)
    .filter((cuota) => cuota.venceEn <= hasta)
    .map((cuota) => ({ ...cuota, pendienteCop: cuota.montoCop }));
  const abonos = movimientos
    .filter((mov) => mov.cajitaId === tarjetaId && mov.kind === 'abono' && mov.deltaCop < 0 && mov.occurredOn <= hasta)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));

  for (const abono of abonos) {
    let porAplicar = Math.abs(abono.deltaCop);
    for (const cuota of cuotas) {
      if (porAplicar === 0 || cuota.venceEn > abono.occurredOn) break;
      const cubierto = Math.min(cuota.pendienteCop, porAplicar);
      cuota.pendienteCop -= cubierto;
      porAplicar -= cubierto;
    }
  }

  return cuotas
    .filter((cuota) => cuota.venceEn.slice(0, 7) === mes)
    .reduce((total, cuota) => total + cuota.pendienteCop, 0);
};
