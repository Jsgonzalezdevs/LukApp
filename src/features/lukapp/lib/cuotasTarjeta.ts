import type { Transaction } from '../types';

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
