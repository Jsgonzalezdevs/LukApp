import { describe, expect, it } from 'vitest';
import { generarInsightsEducativos } from './educacionContextual';
import type { Transaction } from '../types';

const crearTx = (
  parcial: Partial<Transaction> &
    Pick<Transaction, 'id' | 'amountCop' | 'kind' | 'category' | 'description' | 'occurredOn'>,
): Transaction => ({
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-27T00:00:00Z',
  ...parcial,
});

describe('educacionContextual - generarInsightsEducativos', () => {
  it('traduce gastos hormiga a almuerzos corrientazos y pasajes', () => {
    const txs: Transaction[] = [
      crearTx({
        id: '1',
        amountCop: 18_000,
        kind: 'gasto',
        category: 'snacks',
        description: 'Tinto y empanada',
        occurredOn: '2026-08-20',
      }),
      crearTx({
        id: '2',
        amountCop: 22_000,
        kind: 'gasto',
        category: 'snacks',
        description: 'Café Juan Valdez',
        occurredOn: '2026-08-21',
      }),
    ];

    const insights = generarInsightsEducativos(txs);
    expect(insights.length).toBeGreaterThan(0);
    const habito = insights.find((i) => i.tipo === 'habito');
    expect(habito).toBeDefined();
    expect(habito?.equivalencia).toContain('almuerzos ejecutivos');
  });
});
