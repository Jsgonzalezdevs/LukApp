import { describe, it, expect } from 'vitest';
import { totalVisible } from './cajitas';
import type { Cajita, CajitaMovimiento } from '../data/modelos';

/**
 * Estas comprobaciones vivían en PatrimonioCard.test.tsx. Esa tarjeta ya no
 * existe —su número es ahora la cifra grande de Inicio— pero la regla que
 * probaba sigue siendo verdad y ahora la preguntan dos pantallas, así que se
 * comprueba sobre la función que las dos usan.
 */
const cajita = (id: string, tipo: Cajita['tipo']): Cajita => ({
  id,
  nombre: id,
  icon: 'wallet',
  tipo,
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
});

const mov = (cajitaId: string, deltaCop: number): CajitaMovimiento => ({
  id: `m_${cajitaId}_${deltaCop}`,
  cajitaId,
  kind: 'ajuste',
  deltaCop,
  categoria: null,
  occurredOn: '2026-01-01',
  nota: '',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const CAJITAS = [
  cajita('banco', 'cuenta'),
  cajita('ahorro', 'cajita'),
  cajita('tarjeta', 'tarjeta'),
];
const MOVS = [mov('banco', 1_000_000), mov('ahorro', 500_000), mov('tarjeta', 300_000)];

describe('totalVisible', () => {
  it('una tarjeta no reduce el efectivo disponible hasta que se paga', () => {
    // 1.000.000 + 500.000. Los 300.000 están en la tarjeta, no salieron del banco.
    expect(totalVisible(CAJITAS, MOVS, [], true)).toBe(1_500_000);
  });

  it('sin contar los ahorros, deja fuera lo guardado', () => {
    // 1.000.000. Los 500.000 del ahorro no entran y la tarjeta tampoco vacía la cuenta.
    expect(totalVisible(CAJITAS, MOVS, [], false)).toBe(1_000_000);
  });

  it('una deuda directa sí resta en los dos casos', () => {
    const conDeuda = [...CAJITAS, cajita('prestamo', 'deuda')];
    const movimientos = [...MOVS, mov('prestamo', 200_000)];
    expect(totalVisible(conDeuda, movimientos, [], true)).toBe(1_300_000);
    expect(totalVisible(conDeuda, movimientos, [], false)).toBe(800_000);
  });

  it('sin nada, es cero y no explota', () => {
    expect(totalVisible([], [], [], true)).toBe(0);
    expect(totalVisible([], [], [], false)).toBe(0);
  });
});
