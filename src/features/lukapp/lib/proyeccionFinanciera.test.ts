import { describe, expect, it } from 'vitest';
import { instantaneaVacia } from '../data/repositorio';
import type { Cajita } from '../data/modelos';
import type { Recurrente } from './recurrentes';
import { proyectarFinanzas } from './proyeccionFinanciera';
import { construirObligacionesFuturas } from './obligacionesFuturas';
import { construirEntradasFuturas } from './entradasFuturas';

const cuenta: Cajita = { id: 'c', nombre: 'Banco', icon: 'wallet', tipo: 'cuenta', metaCop: null, tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null };
const recurrente = (kind: Recurrente['kind'], diaDelMes = 10): Recurrente => ({ id: kind, nombre: kind, kind, amountCop: kind === 'gasto' ? 100 : 500, categoria: 'hogar', cuentaId: 'c', diaDelMes, createdAt: '2026-01-01', archivedAt: null });
const entrada = () => ({ ...instantaneaVacia(), hoy: '2026-09-05', cajitas: [cuenta], cajitaMovimientos: [{ id: 'saldo', cajitaId: 'c', kind: 'ajuste' as const, deltaCop: 1_000, categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01' }] });

describe('proyección financiera determinista', () => {
  it('proyecta 7, 30 y 90 días sin mutar la instantánea', () => {
    const e = entrada(); e.recurrentes = [recurrente('gasto')]; const antes = JSON.stringify(e);
    const obligaciones = construirObligacionesFuturas(e, 90);
    const entradasFuturas = construirEntradasFuturas(e, 90);
    expect(proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 7 })).toHaveLength(8);
    expect(proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 30 })).toHaveLength(31);
    expect(proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 90 })).toHaveLength(91);
    expect(JSON.stringify(e)).toBe(antes);
  });

  it('agrega cada recurrente futuro exactamente una vez y no proyecta ingresos desconocidos', () => {
    const e = entrada(); e.recurrentes = [recurrente('gasto', 10), recurrente('ingreso', 20)];
    const obligaciones = construirObligacionesFuturas(e, 30);
    expect(obligaciones.filter((o) => o.concepto === 'gasto')).toHaveLength(1);
    expect(obligaciones.some((o) => o.concepto === 'ingreso')).toBe(false);
    const entradasFuturas = construirEntradasFuturas(e, 30);
    const punto = proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 30 }).find((p) => p.fecha === '2026-09-20');
    expect(punto?.entradasCop).toBe(500);
  });

  it('mantiene determinismo y no produce NaN ni Infinity', () => {
    const e = entrada(); e.recurrentes = [recurrente('gasto')];
    const obligaciones = construirObligacionesFuturas(e, 30);
    const entradasFuturas = construirEntradasFuturas(e, 30);
    const una = proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 30 }); const dos = proyectarFinanzas({ ...e, obligaciones, entradasFuturas }, { dias: 30 });
    expect(una).toEqual(dos);
    expect(JSON.stringify(una)).not.toMatch(/NaN|Infinity/);
  });
});
