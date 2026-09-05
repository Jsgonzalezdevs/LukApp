import { describe, expect, it } from 'vitest';
import { detectarAnomalias } from './inteligenciaFinanciera';
import type { Transaction } from '../types';

const movimiento = (amountCop: number, category = 'mercado'): Transaction => ({
  id: String(amountCop), kind: 'gasto', amountCop, category, description: '', occurredOn: '2026-09-01', cuentaId: null, rawTranscript: '', createdAt: '2026-09-01',
});

describe('inteligencia financiera', () => {
  it('detecta un valor atípico contra el historial, no contra sí mismo', () => {
    const anomalias = detectarAnomalias([movimiento(100_000), movimiento(120_000), movimiento(920_000)]);
    expect(anomalias[0]).toMatchObject({ categoria: 'mercado', monto: 920_000 });
    expect(anomalias[0].porcentajeSobrePromedio).toBeGreaterThan(75);
  });

});
