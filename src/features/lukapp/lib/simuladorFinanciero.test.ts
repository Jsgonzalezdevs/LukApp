import { describe, expect, it } from 'vitest';
import { instantaneaVacia } from '../data/repositorio';
import type { Cajita } from '../data/modelos';
import { PERIODO_POR_DEFECTO } from './periodo';
import { simularDecisiones } from './simuladorFinanciero';

const cuenta = (id: string, tipo: Cajita['tipo']): Cajita => ({ id, nombre: id, icon: 'wallet', tipo, metaCop: null, tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null, claseCuenta: 'banco' });
const movimiento = (id: string, cajitaId: string, deltaCop: number, kind: 'ajuste' | 'deposito' | 'abono' | 'retiro' = 'ajuste') => ({ id, cajitaId, kind, deltaCop, categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01' });
const entrada = () => ({ ...instantaneaVacia(), hoy: '2026-09-05', periodo: PERIODO_POR_DEFECTO });

describe('simulador financiero', () => {
  it('simula gasto, conserva el déficit y no toca la instantánea original', () => {
    const e = entrada(); e.cajitas = [cuenta('banco', 'cuenta')]; e.cajitaMovimientos = [movimiento('saldo', 'banco', 1_000_000)];
    const antes = JSON.stringify(e); const r = simularDecisiones(e, [{ tipo: 'gasto-extraordinario', montoCop: 1_500_000 }]);
    expect(r.diferencia.disponibleDiario.simulado).toBe(0); expect(r.simulado.liquidez.disponibleDiarioBrutoCop).toBeLessThan(0); expect(JSON.stringify(e)).toBe(antes);
  });

  it('simula ahorro, abono de deuda y reducción de gasto sin registrar movimientos reales', () => {
    const e = entrada(); e.cajitas = [cuenta('banco', 'cuenta'), cuenta('deuda', 'deuda')]; e.cajitaMovimientos = [movimiento('saldo', 'banco', 1_000_000), movimiento('deuda', 'deuda', 400_000)];
    const r = simularDecisiones(e, [{ tipo: 'ahorro-adicional', montoCop: 100_000 }, { tipo: 'abono-extraordinario', montoCop: 100_000 }, { tipo: 'reduccion-gasto', montoCop: 50_000, categoria: 'comida' }]);
    expect(r.simulado.saldo.patrimonioCop).toBe(r.base.saldo.patrimonioCop);
    expect(e.cajitaMovimientos).toHaveLength(2); expect(e.transacciones).toHaveLength(0); expect(r.diferencia.patrimonio.cambioPct).toBe(0);
  });

  it('es determinista y el escenario vacío coincide con la base', () => {
    const e = entrada(); const a = simularDecisiones(e, []); const b = simularDecisiones(e, []);
    expect(a.simulado).toEqual(b.simulado); expect(a.diferencia.disponibleDiario.cambioCop).toBe(0);
  });

  it('no simula silenciosamente ahorro sin cajita y limita abonos imposibles', () => {
    const sinCajita = entrada(); sinCajita.cajitas = [cuenta('banco', 'cuenta')];
    const ahorro = simularDecisiones(sinCajita, [{ tipo: 'ahorro-adicional', montoCop: 100_000 }]);
    expect(ahorro.avisos[0]).toMatch(/No hay una cajita/); expect(ahorro.simulado.saldo).toEqual(ahorro.base.saldo);
    const e = entrada(); e.cajitas = [cuenta('banco', 'cuenta'), cuenta('deuda', 'deuda')]; e.cajitaMovimientos = [movimiento('c', 'banco', 50_000), movimiento('d', 'deuda', 20_000)];
    const abono = simularDecisiones(e, [{ tipo: 'abono-extraordinario', montoCop: 100_000 }]);
    expect(abono.avisos[0]).toMatch(/limitó/); expect(abono.simulado.saldo.saldoDeudasCop).toBe(0); expect(abono.simulado.saldo.saldoCuentasCop).toBe(30_000);
  });
});
