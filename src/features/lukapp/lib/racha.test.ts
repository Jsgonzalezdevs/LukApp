import { describe, expect, it } from 'vitest';
import { calcularRacha, diasParaSumarRacha } from './racha';
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

describe('días regalados desde el superadmin', () => {
  const HOY = '2026-08-24';

  it('suman a la racha sin contar como anotado hoy ni en el mes', () => {
    const r = calcularRacha([mockTx('2026-08-24')], HOY, ['2026-08-23', '2026-08-22']);
    expect(r.rachaActual).toBe(3);
    expect(r.anotadoHoy).toBe(true);
    expect(r.diasAnotadosMes).toBe(1);

    const soloRegalo = calcularRacha([], HOY, ['2026-08-23']);
    expect(soloRegalo.rachaActual).toBe(1);
    expect(soloRegalo.anotadoHoy).toBe(false);
    expect(soloRegalo.ultimoDiaAnotado).toBeNull();
  });

  it('rellena justo antes de la racha viva', () => {
    const dias = diasParaSumarRacha(['2026-08-24', '2026-08-23'], HOY, 3);
    expect(dias).toEqual(['2026-08-22', '2026-08-21', '2026-08-20']);
    const r = calcularRacha([mockTx('2026-08-24'), mockTx('2026-08-23')], HOY, dias);
    expect(r.rachaActual).toBe(5);
  });

  it('sin racha viva arranca desde ayer', () => {
    expect(diasParaSumarRacha(['2026-08-10'], HOY, 2)).toEqual(['2026-08-23', '2026-08-22']);
  });

  it('no regala un día que ya cuenta', () => {
    const dias = diasParaSumarRacha(['2026-08-23', '2026-08-21'], HOY, 2);
    expect(dias).toEqual(['2026-08-22', '2026-08-20']);
  });
});
