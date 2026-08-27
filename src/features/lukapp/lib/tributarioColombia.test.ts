import { describe, expect, it } from 'vitest';
import { analizarTopesRenta, calcularRetencionHonorarios, TOPES_RENTA_UVT } from './tributarioColombia';
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

describe('tributarioColombia - analizarTopesRenta', () => {
  it('identifica semáforo verde cuando el usuario está lejos del tope', () => {
    const txs: Transaction[] = [
      crearTx({
        id: '1',
        amountCop: 5_000_000,
        kind: 'ingreso',
        category: 'ingreso',
        description: 'Sueldo',
        occurredOn: '2026-03-15',
      }),
      crearTx({
        id: '2',
        amountCop: 2_000_000,
        kind: 'gasto',
        category: 'mercado',
        description: 'Mercado',
        occurredOn: '2026-03-16',
      }),
    ];

    const resultado = analizarTopesRenta(txs, 2026);
    expect(resultado.semaforoGeneral).toBe('verde');
    expect(resultado.porcentajeConsignaciones).toBeLessThan(70);
    expect(resultado.detalles.debeDeclararEstimado).toBe(false);
  });

  it('alerta cuando los ingresos superan 1400 UVT', () => {
    const tope = TOPES_RENTA_UVT.INGRESOS_BRUTOS * 52_374;
    const txs: Transaction[] = [
      crearTx({
        id: '1',
        amountCop: tope + 1_000_000,
        kind: 'ingreso',
        category: 'ingreso',
        description: 'Venta de inmueble',
        occurredOn: '2026-06-10',
      }),
    ];

    const resultado = analizarTopesRenta(txs, 2026);
    expect(resultado.semaforoGeneral).toBe('alerta');
    expect(resultado.detalles.debeDeclararEstimado).toBe(true);
    expect(resultado.mensajeConsejo).toContain('superaron el tope');
  });
});

describe('tributarioColombia - calcularRetencionHonorarios', () => {
  it('calcula retención estándar del 10% para no declarante con ReteICA', () => {
    const bruto = 10_000_000;
    const liquidacion = calcularRetencionHonorarios(bruto, { declaraRenta: false, tarifaReteIcaPorMil: 9.66 });

    expect(liquidacion.tarifaRetefuentePct).toBe(10);
    expect(liquidacion.valorRetefuente).toBe(1_000_000);
    expect(liquidacion.valorReteIca).toBe(96_600);
    expect(liquidacion.totalRetenciones).toBe(1_096_600);
    expect(liquidacion.netoARecibir).toBe(8_903_400);
    expect(liquidacion.seguridadSocialSugerida.ibc).toBe(4_000_000);
  });

  it('calcula 11% para declarante de renta', () => {
    const bruto = 5_000_000;
    const liquidacion = calcularRetencionHonorarios(bruto, { declaraRenta: true, tarifaReteIcaPorMil: 0 });

    expect(liquidacion.tarifaRetefuentePct).toBe(11);
    expect(liquidacion.valorRetefuente).toBe(550_000);
    expect(liquidacion.netoARecibir).toBe(4_450_000);
  });
});
