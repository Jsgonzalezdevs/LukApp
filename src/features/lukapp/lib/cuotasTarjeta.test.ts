import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import type { CajitaMovimiento } from '../data/modelos';
import { cuotasDeTarjeta, pagoMensualTarjeta, pagoPendienteTarjeta } from './cuotasTarjeta';

const compra: Transaction = {
  id: 'platzi', kind: 'gasto', amountCop: 899_259, category: 'educacion', description: 'Platzi',
  occurredOn: '2026-08-29', cuentaId: 'tarjeta', rawTranscript: '', cuotasTotal: 12, cuotaCop: 74_938,
  createdAt: '2026-08-29T00:00:00Z',
};

describe('cuotasTarjeta', () => {
  it('genera una cuota por mes y conserva el último día válido', () => {
    const cuotas = cuotasDeTarjeta([compra], 'tarjeta');
    expect(cuotas).toHaveLength(12);
    expect(cuotas[0]).toMatchObject({ numero: 1, venceEn: '2026-08-29', montoCop: 74_938 });
    expect(cuotas[11]).toMatchObject({ numero: 12, venceEn: '2027-07-29' });
  });

  it('solo suma las cuotas del mes consultado', () => {
    expect(pagoMensualTarjeta([compra], 'tarjeta', '2026-08')).toBe(74_938);
    expect(pagoMensualTarjeta([compra], 'tarjeta', '2027-08')).toBe(0);
  });

  it('descuenta de la cuota del mes los abonos ya registrados en la tarjeta', () => {
    const abonos: CajitaMovimiento[] = [{
      id: 'abono', cajitaId: 'tarjeta', kind: 'abono', deltaCop: -40_000,
      categoria: null, occurredOn: '2026-08-30', nota: '', createdAt: '2026-08-30T00:00:00Z',
    }];

    expect(pagoPendienteTarjeta([compra], abonos, 'tarjeta', '2026-08', '2026-08-30')).toBe(34_938);
  });

  it('no descuenta una cuota futura con un abono hecho en el mes actual', () => {
    const abonos: CajitaMovimiento[] = [{
      id: 'abono', cajitaId: 'tarjeta', kind: 'abono', deltaCop: -74_938,
      categoria: null, occurredOn: '2026-08-30', nota: '', createdAt: '2026-08-30T00:00:00Z',
    }];

    expect(pagoPendienteTarjeta([compra], abonos, 'tarjeta', '2026-08', '2026-08-30')).toBe(0);
    expect(pagoPendienteTarjeta([compra], abonos, 'tarjeta', '2026-09', '2026-09-30')).toBe(74_938);
  });
});
