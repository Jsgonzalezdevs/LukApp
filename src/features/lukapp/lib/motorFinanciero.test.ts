import { describe, expect, it } from 'vitest';
import { construirContextoFinanciero } from './motorFinanciero';
import { PERIODO_POR_DEFECTO } from './periodo';
import { instantaneaVacia } from '../data/repositorio';
import type { Cajita, Meta } from '../data/modelos';
import type { Transaction } from '../types';

const cajita = (id: string, tipo: Cajita['tipo']): Cajita => ({ id, nombre: id, icon: 'wallet', tipo, metaCop: null, tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null, claseCuenta: 'banco' });
const movimiento = (id: string, cajitaId: string, deltaCop: number) => ({ id, cajitaId, kind: 'ajuste' as const, deltaCop, categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01' });
const entrada = () => ({ ...instantaneaVacia(), hoy: '2026-09-05', periodo: PERIODO_POR_DEFECTO });
const compra = (id: string, tarjetaId: string, cuotasTotal: number | null = null, cuotaCop: number | null = null): Transaction => ({ id, kind: 'gasto', amountCop: 1_200_000, category: 'comida', description: id, occurredOn: '2026-09-02', cuentaId: tarjetaId, rawTranscript: '', createdAt: '2026-09-02', cuotasTotal, cuotaCop });

describe('motor financiero unificado', () => {
  it('reutiliza saldos y separa tarjetas de deudas', () => {
    const e = entrada();
    e.cajitas = [cajita('banco', 'cuenta'), cajita('tarjeta', 'tarjeta'), cajita('prestamo', 'deuda')];
    e.cajitaMovimientos = [movimiento('a', 'banco', 1_000_000), movimiento('b', 'tarjeta', 300_000), movimiento('c', 'prestamo', 200_000)];
    const r = construirContextoFinanciero(e);
    expect(r.saldo).toMatchObject({ saldoCuentasCop: 1_000_000, saldoTarjetasCop: 300_000, saldoDeudasCop: 200_000, patrimonioCop: 500_000 });
  });

  it('expone recurrentes futuras y cuotas sin registrar transacciones', () => {
    const e = entrada();
    e.cajitas = [cajita('tarjeta', 'tarjeta')];
    e.transacciones = [compra('compra', 'tarjeta', 3, 400_000)];
    e.recurrentes = [{ id: 'r', nombre: 'Arriendo', kind: 'gasto', amountCop: 800_000, categoria: 'hogar', cuentaId: null, diaDelMes: 15, createdAt: '2026-01-01', archivedAt: null }];
    const r = construirContextoFinanciero(e);
    expect(r.obligaciones.some((o) => o.concepto === 'Arriendo' && o.estado === 'programada')).toBe(true);
    expect(r.obligaciones.some((o) => o.origen === 'tarjeta')).toBe(true);
    expect(e.transacciones).toHaveLength(1);
  });

  it('calcula metas enlazadas y marca proyección limitada con poco historial', () => {
    const e = entrada();
    e.cajitas = [cajita('ahorro', 'cajita')];
    e.cajitaMovimientos = [movimiento('a', 'ahorro', 250_000)];
    const meta: Meta = { id: 'm', nombre: 'Viaje', icon: 'plane', objetivoCop: 500_000, fechaObjetivo: '2026-12-01', cajitaId: 'ahorro', ahorradoCop: 0, createdAt: '2026-01-01', completedAt: null };
    e.metas = [meta];
    const r = construirContextoFinanciero(e);
    expect(r.metas[0].progreso.ahorradoCop).toBe(250_000);
    expect(r.proyeccion.limitada).toBe(true);
    expect(r.compromisos.datosIncompletos).toBe(true);
  });

  it('conserva el déficit bruto cuando los compromisos superan la liquidez', () => {
    const e = entrada();
    e.cajitas = [cajita('banco', 'cuenta')];
    e.cajitaMovimientos = [movimiento('saldo', 'banco', 100_000)];
    e.recurrentes = [{ id: 'r', nombre: 'Arriendo', kind: 'gasto', amountCop: 500_000, categoria: 'hogar', cuentaId: 'banco', diaDelMes: 10, createdAt: '2026-01-01', archivedAt: null }];
    const r = construirContextoFinanciero(e);
    expect(r.liquidez.disponibleDiarioBrutoCop).toBeLessThan(0);
    expect(r.liquidez.disponibleDiarioCop).toBe(0);
    expect(r.liquidez.dineroLibreBrutoCop).toBeLessThan(0);
    expect(r.liquidez.nivel).toBe('riesgo');
    expect(r.liquidez.factores[0].concepto).toBe('Arriendo');
  });
});
