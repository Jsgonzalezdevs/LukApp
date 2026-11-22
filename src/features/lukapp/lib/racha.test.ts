import { describe, expect, it } from 'vitest';
import { calcularRacha, inicioDeRachaActual } from './racha';
import { shiftDays } from './localDate';
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

describe('bonos de racha desde el superadmin', () => {
  const HOY = '2026-08-24';
  const dias = (desde: string, n: number) =>
    Array.from({ length: n }, (_, i) => mockTx(shiftDays(desde, -i)));

  it('suma exactamente lo pedido, aunque haya rachas viejas cerca', () => {
    // Racha viva de 3 días (22-24), hueco de 1 día y una racha vieja de 10.
    const txs = [...dias('2026-08-24', 3), ...dias('2026-08-20', 10)];
    const bono = { inicioRacha: inicioDeRachaActual(txs.map((t) => t.occurredOn), HOY), dias: 67 };
    expect(bono.inicioRacha).toBe('2026-08-22');
    const r = calcularRacha(txs, HOY, [bono]);
    expect(r.rachaActual).toBe(70);
    expect(r.rachaMaxima).toBe(70);
    expect(r.anotadoHoy).toBe(true);
    expect(r.diasAnotadosMes).toBe(13);
  });

  it('sigue sumando mientras la racha crece y se pierde si se corta', () => {
    const bono = { inicioRacha: '2026-08-22', dias: 5 };
    expect(calcularRacha(dias('2026-08-24', 3), HOY, [bono]).rachaActual).toBe(8);
    expect(calcularRacha(dias('2026-08-30', 9), '2026-08-30', [bono]).rachaActual).toBe(14);
    const cortada = calcularRacha([...dias('2026-08-30', 2), ...dias('2026-08-24', 3)], '2026-08-30', [bono]);
    expect(cortada.rachaActual).toBe(2);
    expect(cortada.rachaMaxima).toBe(8);
  });

  it('sin racha viva, el bono queda para hoy y se conserva si anota hoy', () => {
    expect(inicioDeRachaActual(['2026-08-10'], HOY)).toBe(HOY);
    const bono = { inicioRacha: HOY, dias: 4 };
    const sinAnotar = calcularRacha([mockTx('2026-08-10')], HOY, [bono]);
    expect(sinAnotar.rachaActual).toBe(4);
    expect(sinAnotar.anotadoHoy).toBe(false);
    expect(calcularRacha([mockTx(HOY)], HOY, [bono]).rachaActual).toBe(5);
    expect(calcularRacha([mockTx('2026-08-25')], '2026-08-25', [bono]).rachaActual).toBe(1);
  });
});
