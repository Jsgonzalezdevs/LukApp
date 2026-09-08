import { describe, expect, it } from 'vitest';
import { simularPregunta } from './simulacionConversacional';
import type { EntradaMotorFinanciero } from './motorFinanciero';

const entrada = { hoy: '2026-09-05', cajitas: [], cajitaMovimientos: [], transacciones: [], metas: [], presupuestos: [], recurrentes: [], periodo: { frecuencia: 'mensual', diaInicio: 1 } } as unknown as EntradaMotorFinanciero;

describe('simulacion conversacional', () => {
  it('respeta unidades y deja las comparaciones de varios montos al asesor', () => {
    expect(simularPregunta('Qué pasa si gasto 100 mil', entrada)?.escenario.montoCop).toBe(100000);
    expect(simularPregunta('Qué pasa si gasto 1,5 millones', entrada)?.escenario.montoCop).toBe(1500000);
    expect(simularPregunta('Qué pasa si pago 70000 o si ahorro 50000', entrada)).toBeNull();
    expect(simularPregunta('Me recomiendas pagar mi tarjeta o si pago 70000', entrada)).toBeNull();
  });
  it('detecta gasto y delega el resultado al simulador', () => {
    const solicitud = simularPregunta('¿Qué pasa si gasto $300.000?', entrada);
    expect(solicitud?.tipo).toBe('simulacion');
    expect(solicitud?.escenario).toEqual({ tipo: 'gasto-extraordinario', montoCop: 300000 });
    expect(solicitud?.resultado.base).toBeDefined();
    expect(solicitud?.respuesta).toContain('simulación temporal');
  });

  it('distingue ahorro y abono, y no inventa escenarios sin monto', () => {
    expect(simularPregunta('¿Qué pasa si ahorro $200.000?', entrada)?.escenario.tipo).toBe('ahorro-adicional');
    expect(simularPregunta('¿Qué pasa si pago $500.000 de mi deuda?', entrada)?.escenario.tipo).toBe('abono-extraordinario');
    expect(simularPregunta('¿Qué pasa si pago una deuda?', entrada)).toBeNull();
  });
});
