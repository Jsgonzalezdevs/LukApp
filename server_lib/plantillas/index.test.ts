import { describe, expect, it } from 'vitest';
import { analizarConPlantilla, detectarBanco } from './index';

const NEQUI = `Extracto de depósito de bajo monto de:
JUANA PEREZ
Estado de depósito de bajo monto para el período de: 2026/06/01 a 2026/06/30
Fecha del movimiento Descripción Valor Saldo
30/06/2026 De MARIA EJEMPLO $3,000.00 $3,102.54
27/06/2026 COMPRA EN FARMATODO $-4,000.00 $69,602.54
26/06/2026 TRANSFERENCIA DESDE BANCOLOMBIA $-1,000.00 $73,602.54

Los depósitos de bajo monto Nequi generan rendimientos, los cuales se liquidan diariamente.
`;

describe('detectarBanco', () => {
  it('identifica Nequi por su encabezado', () => {
    expect(detectarBanco(NEQUI)).toBe('nequi');
  });

  it('devuelve null para texto no reconocido', () => {
    expect(detectarBanco('un pdf cualquiera sin relación bancaria')).toBeNull();
  });
});

describe('analizarConPlantilla', () => {
  it('produce un resultado completo para un extracto soportado', () => {
    const resultado = analizarConPlantilla(NEQUI);
    expect(resultado).not.toBeNull();
    expect(resultado?.movimientos).toHaveLength(3);
    expect(resultado?.periodo).toEqual({
      desde: '2026-06-01',
      hasta: '2026-06-30',
      etiqueta: '01/06/2026 — 30/06/2026',
    });
    // Ingreso 3.000, gasto real 4.000 (Farmatodo) — el traslado a Bancolombia
    // queda excluido de los totales.
    expect(resultado?.metricas.find((m) => m.etiqueta === 'Total ingresos')?.valorCop).toBe(3000);
    expect(resultado?.metricas.find((m) => m.etiqueta === 'Total gastos')?.valorCop).toBe(4000);
    expect(resultado?.alertas).toHaveLength(1);
    expect(resultado?.advertencias.length).toBeGreaterThan(0);
  });

  it('devuelve null cuando el banco no se reconoce', () => {
    expect(analizarConPlantilla('texto sin ningún banco conocido')).toBeNull();
  });

  it('devuelve null cuando el banco se reconoce pero no hay movimientos', () => {
    const soloEncabezado = 'Extracto de depósito de bajo monto de:\nJUANA PEREZ\nNequi';
    expect(analizarConPlantilla(soloEncabezado)).toBeNull();
  });
});
