import type { CategoriaClave, Transaction } from '../types';
import type { CajitaMovimiento } from '../data/modelos';
import type { EntradaMotorFinanciero, ContextoFinanciero } from './motorFinanciero';
import { construirContextoFinanciero } from './motorFinanciero';
import { idsPasivos, saldosPorCajita } from './cajitas';

export type ModificadorSimulacion =
  | { tipo: 'gasto-extraordinario'; montoCop: number }
  | { tipo: 'ahorro-adicional'; montoCop: number; cajitaId?: string }
  | { tipo: 'abono-extraordinario'; montoCop: number; deudaId?: string; cuentaId?: string }
  | { tipo: 'reduccion-gasto'; montoCop: number; categoria: CategoriaClave };

export interface DiferenciaFinanciera {
  base: number;
  simulado: number;
  cambioCop: number;
  cambioPct: number | null;
}

export interface ResultadoSimulacion {
  base: ContextoFinanciero;
  simulado: ContextoFinanciero;
  diferencia: {
    disponibleDiario: DiferenciaFinanciera;
    dineroLibre: DiferenciaFinanciera;
    obligaciones: DiferenciaFinanciera;
    patrimonio: DiferenciaFinanciera;
  };
  recuperacionDias: number | null;
  avisos: readonly string[];
  riesgo: ContextoFinanciero['liquidez']['nivel'];
  explicacion: readonly string[];
}

const porcentaje = (base: number, simulado: number): number | null =>
  base > 0 ? Math.round(((simulado - base) / base) * 1000) / 10 : null;

const diferencia = (base: number, simulado: number): DiferenciaFinanciera => ({
  base, simulado, cambioCop: simulado - base, cambioPct: porcentaje(base, simulado),
});

const transaccionTemporal = (entrada: EntradaMotorFinanciero, modificador: Extract<ModificadorSimulacion, { tipo: 'gasto-extraordinario' }>): Transaction => ({
  id: 'simulacion-gasto-extraordinario', kind: 'gasto', amountCop: modificador.montoCop, category: 'otros', description: 'Simulación temporal', occurredOn: entrada.hoy, cuentaId: entrada.cajitas.find((c) => c.tipo === 'cuenta' && c.archivedAt === null)?.id ?? null, rawTranscript: '', createdAt: entrada.hoy,
});

const movimientoTemporal = (entrada: EntradaMotorFinanciero, modificador: Extract<ModificadorSimulacion, { tipo: 'ahorro-adicional' | 'abono-extraordinario' }>): CajitaMovimiento => ({
  id: `simulacion-${modificador.tipo}`,
  cajitaId: modificador.tipo === 'ahorro-adicional' ? (modificador.cajitaId ?? entrada.cajitas.find((c) => c.tipo === 'cajita' && c.archivedAt === null)?.id ?? '') : (modificador.deudaId ?? entrada.cajitas.find((c) => c.tipo === 'deuda' && c.archivedAt === null)?.id ?? ''),
  kind: modificador.tipo === 'ahorro-adicional' ? 'deposito' : 'abono',
  deltaCop: modificador.tipo === 'ahorro-adicional' ? modificador.montoCop : -modificador.montoCop,
  categoria: null, occurredOn: entrada.hoy, nota: 'Simulación temporal', createdAt: entrada.hoy,
});

const aplicarModificador = (entrada: EntradaMotorFinanciero, modificador: ModificadorSimulacion): EntradaMotorFinanciero => {
  const simulada: EntradaMotorFinanciero = {
    ...entrada,
    transacciones: [...entrada.transacciones],
    cajitas: [...entrada.cajitas],
    cajitaMovimientos: [...entrada.cajitaMovimientos],
    metas: [...entrada.metas],
    presupuestos: [...entrada.presupuestos],
    recurrentes: [...entrada.recurrentes],
  };
  if (modificador.tipo === 'gasto-extraordinario') simulada.transacciones.push(transaccionTemporal(entrada, modificador));
  if (modificador.tipo === 'ahorro-adicional') {
    const mov = movimientoTemporal(entrada, modificador);
    if (mov.cajitaId) {
      simulada.cajitaMovimientos.push(mov);
      const cuentaId = entrada.cajitas.find((c) => c.tipo === 'cuenta' && c.archivedAt === null)?.id;
      if (cuentaId) simulada.cajitaMovimientos.push({ ...mov, id: `${mov.id}-cuenta`, cajitaId: cuentaId, kind: 'retiro', deltaCop: -modificador.montoCop });
    }
  }
  if (modificador.tipo === 'abono-extraordinario') {
    const deuda = movimientoTemporal(entrada, modificador);
    if (deuda.cajitaId) {
      simulada.cajitaMovimientos.push(deuda);
      const cuentaId = modificador.cuentaId ?? entrada.cajitas.find((c) => c.tipo === 'cuenta' && c.archivedAt === null)?.id;
      if (cuentaId) simulada.cajitaMovimientos.push({ ...deuda, id: `${deuda.id}-cuenta`, cajitaId: cuentaId, kind: 'retiro', deltaCop: -modificador.montoCop });
    }
  }
  if (modificador.tipo === 'reduccion-gasto') simulada.ajusteFuturoCop = (simulada.ajusteFuturoCop ?? 0) + modificador.montoCop;
  return simulada;
};

export const simularDecisiones = (entrada: EntradaMotorFinanciero, modificadores: readonly ModificadorSimulacion[]): ResultadoSimulacion => {
  const base = construirContextoFinanciero(entrada);
  const avisos: string[] = [];
  const simulada = modificadores.reduce((actual, modificador) => {
    if (modificador.montoCop <= 0) { avisos.push(`${modificador.tipo}: el monto debe ser mayor que cero.`); return actual; }
    if (modificador.tipo === 'ahorro-adicional' && !actual.cajitas.some((c) => c.tipo === 'cajita' && c.archivedAt === null)) { avisos.push('No hay una cajita activa para simular este ahorro.'); return actual; }
    if (modificador.tipo === 'abono-extraordinario') {
      const deudaId = modificador.deudaId ?? actual.cajitas.find((c) => c.tipo === 'deuda' && c.archivedAt === null)?.id;
      const cuentaId = modificador.cuentaId ?? actual.cajitas.find((c) => c.tipo === 'cuenta' && c.archivedAt === null)?.id;
      if (!deudaId || !cuentaId) { avisos.push('El abono requiere una deuda y una cuenta activas.'); return actual; }
      const saldos = saldosPorCajita(actual.cajitaMovimientos, actual.transacciones, idsPasivos(actual.cajitas));
      const disponibleDeuda = Math.max(0, Math.abs(saldos.get(deudaId) ?? 0));
      const disponibleCuenta = Math.max(0, saldos.get(cuentaId) ?? 0);
      const aplicable = Math.min(modificador.montoCop, disponibleDeuda, disponibleCuenta);
      if (aplicable <= 0) { avisos.push('El abono no puede aplicarse: la deuda o la cuenta no tienen saldo disponible.'); return actual; }
      if (aplicable < modificador.montoCop) avisos.push(`El abono se limitó a ${aplicable} porque no puede superar la deuda o el saldo de la cuenta.`);
      return aplicarModificador(actual, { ...modificador, montoCop: aplicable });
    }
    return aplicarModificador(actual, modificador);
  }, entrada);
  const simulado = construirContextoFinanciero(simulada);
  const impactoUnicoCop = modificadores.reduce((total, m) => total + (m.tipo === 'reduccion-gasto' ? -m.montoCop : m.montoCop), 0);
  const recuperacionDias = impactoUnicoCop !== 0 && base.liquidez.disponibleDiarioCop > 0 ? Math.ceil(Math.abs(impactoUnicoCop) / base.liquidez.disponibleDiarioCop) : null;
  return {
    base, simulado,
    diferencia: {
      disponibleDiario: diferencia(base.liquidez.disponibleDiarioCop, simulado.liquidez.disponibleDiarioCop),
      dineroLibre: diferencia(base.liquidez.dineroLibreCop, simulado.liquidez.dineroLibreCop),
      obligaciones: diferencia(base.liquidez.obligacionesPendientesCop, simulado.liquidez.obligacionesPendientesCop),
      patrimonio: diferencia(base.saldo.patrimonioCop, simulado.saldo.patrimonioCop),
    },
    recuperacionDias, avisos, riesgo: simulado.liquidez.nivel,
    explicacion: [
      'La simulación es temporal y no modifica tus finanzas reales.',
      ...simulado.liquidez.factores.map((f) => `${f.concepto}: ${f.montoCop} (${f.certeza}).`),
    ],
  };
};
