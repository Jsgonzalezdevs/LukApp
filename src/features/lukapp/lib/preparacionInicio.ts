import type { Instantanea } from '../data/repositorio';
import type { CajitaMovimiento } from '../data/modelos';

/** Un gasto registrado no prueba cuánto dinero había antes de ese gasto. */
export const tieneSaldoConfirmado = (cuentaId: string, movimientos: readonly CajitaMovimiento[]): boolean =>
  movimientos.some((m) => m.cajitaId === cuentaId && (m.kind === 'ajuste' || m.nota === 'Saldo inicial'));

export const preparacionInicio = (datos: Instantanea) => {
  const cuentas = datos.cajitas.filter((c) => c.tipo === 'cuenta' && c.archivedAt === null);
  const sinSaldo = cuentas.filter((c) => !tieneSaldoConfirmado(c.id, datos.cajitaMovimientos));
  return {
    cuentas,
    sinSaldo,
    saldosCompletos: cuentas.length > 0 && sinSaldo.length === 0,
    primerMovimiento: datos.transacciones.length > 0,
  };
};
