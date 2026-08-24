import { describe, expect, it } from 'vitest';
import { calcularRacha } from './racha';
import type { Transaction } from '../types';

const mockTx = (occurredOn: string): Transaction => ({
  id: `tx-${occurredOn}`,
  kind: 'gasto',
  amountCop: 10000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn,
  cuentaId: 'c1',
  rawTranscript: 'Almuerzo 10 mil',
  createdAt: `${occurredOn}T12:00:00.000Z`,
});

describe('calcularRacha', () => {
  const HOY = '2026-08-24';

  it('retorna 0 si no hay transacciones', () => {
    const r = calcularRacha([], HOY);
    expect(r.rachaActual).toBe(0);
    expect(r.rachaMaxima).toBe(0);
    expect(r.anotadoHoy).toBe(false);
  });

  it('cuenta racha activa si anotó hoy y días anteriores consecutivos', () => {
    const txs = [
      mockTx('2026-08-24'),
      mockTx('2026-08-23'),
      mockTx('2026-08-22'),
    ];
    const r = calcularRacha(txs, HOY);
    expect(r.rachaActual).toBe(3);
    expect(r.anotadoHoy).toBe(true);
    expect(r.hitosAlcanzados.length).toBeGreaterThanOrEqual(1);
    expect(r.hitosAlcanzados[0].dias).toBe(3);
  });

  it('mantiene la racha viva si anotó ayer pero aún no ha anotado hoy', () => {
    const txs = [
      mockTx('2026-08-23'),
      mockTx('2026-08-22'),
    ];
    const r = calcularRacha(txs, HOY);
    expect(r.rachaActual).toBe(2);
    expect(r.anotadoHoy).toBe(false);
  });

  it('reinicia racha a 0 si pasaron más de 2 días sin anotar', () => {
    const txs = [
      mockTx('2026-08-20'),
      mockTx('2026-08-19'),
    ];
    const r = calcularRacha(txs, HOY);
    expect(r.rachaActual).toBe(0);
    expect(r.rachaMaxima).toBe(2);
  });

  it('calcula correctamente los días anotados en el mes', () => {
    const txs = [
      mockTx('2026-08-24'),
      mockTx('2026-08-15'),
      mockTx('2026-07-30'),
    ];
    const r = calcularRacha(txs, HOY);
    expect(r.diasAnotadosMes).toBe(2);
  });
});
