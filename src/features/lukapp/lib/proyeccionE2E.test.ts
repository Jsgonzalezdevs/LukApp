import { describe, expect, it } from 'vitest';
import { instantaneaVacia } from '../data/repositorio';
import type { Cajita } from '../data/modelos';
import { construirContextoFinanciero } from './motorFinanciero';
import { PERIODO_POR_DEFECTO } from './periodo';

const item = (id: string, tipo: Cajita['tipo']): Cajita => ({ id, nombre: id, icon: 'wallet', tipo, metaCop: null, tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null });
const mov = (id: string, cajitaId: string, deltaCop: number) => ({ id, cajitaId, kind: 'ajuste' as const, deltaCop, categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01' });

describe('flujo E2E del motor de proyección', () => {
  it('conserva deuda no fechada y proyecta ingresos de varios meses', () => {
    const entrada = { ...instantaneaVacia(), hoy: '2026-09-05', periodo: PERIODO_POR_DEFECTO, cajitas: [item('cuenta', 'cuenta'), item('deuda', 'deuda')], cajitaMovimientos: [mov('saldo', 'cuenta', 2_000_000), mov('deuda', 'deuda', 500_000)], recurrentes: [{ id: 'salario', nombre: 'Salario', kind: 'ingreso' as const, amountCop: 1_000_000, categoria: 'otros' as const, cuentaId: 'cuenta', diaDelMes: 15, createdAt: '2026-01-01', archivedAt: null }] };
    const antes = JSON.stringify(entrada);
    const contexto = construirContextoFinanciero(entrada);
    expect(contexto.obligaciones.find((o) => o.origen === 'deuda')).toMatchObject({ montoCop: 500_000, fecha: null, certeza: 'desconocida' });
    expect(contexto.entradasFuturas).toHaveLength(3);
    expect(contexto.proyeccionCompleta.some((p) => p.entradasCop === 1_000_000)).toBe(true);
    expect(JSON.stringify(entrada)).toBe(antes);
    expect(JSON.stringify(contexto.proyeccionCompleta)).not.toMatch(/NaN|Infinity/);
  });
});
