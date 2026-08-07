import { describe, expect, it } from 'vitest';
import { pareceNequi, parsearNequi, periodoNequi } from './nequi';

const EXTRACTO = `Extracto de depósito de bajo monto de:
JUANA PEREZ EJEMPLO
Número de depósito de bajo monto: 3001234567
Estado de depósito de bajo monto para el período de: 2026/06/01 a 2026/06/30
Fecha del movimiento Descripción Valor Saldo
30/06/2026 De MARIA EJEMPLO $3,000.00 $3,102.54
27/06/2026 Para SOLMAR EJEMPLO $-4,000.00 $69,602.54
08/06/2026 COMPRA PAQUETE PTM $-35,000.00 $66,844.44
07/06/2026 Pago de Intereses $28.17 $15,528.61

Los depósitos de bajo monto Nequi generan rendimientos, los cuales se liquidan diariamente.
`;

describe('plantilla Nequi', () => {
  it('reconoce un extracto de Nequi', () => {
    expect(pareceNequi(EXTRACTO)).toBe(true);
    expect(pareceNequi('cualquier otro texto')).toBe(false);
  });

  it('extrae el período', () => {
    expect(periodoNequi(EXTRACTO)).toEqual({
      desde: '2026-06-01',
      hasta: '2026-06-30',
      etiqueta: '01/06/2026 — 30/06/2026',
    });
  });

  it('parsea cada línea de movimiento con fecha, monto y dirección', () => {
    const movimientos = parsearNequi(EXTRACTO);
    expect(movimientos).toHaveLength(4);

    expect(movimientos[0]).toMatchObject({
      fecha: '2026-06-30',
      descripcion: 'De MARIA EJEMPLO',
      montoCop: 3000,
      tipo: 'ingreso',
    });
    expect(movimientos[1]).toMatchObject({
      fecha: '2026-06-27',
      montoCop: 4000,
      tipo: 'gasto',
    });
  });

  it('nunca produce un monto negativo', () => {
    for (const mov of parsearNequi(EXTRACTO)) {
      expect(mov.montoCop).toBeGreaterThanOrEqual(0);
    }
  });

  it('ignora líneas que no son movimientos', () => {
    expect(parsearNequi('Resumen\nSaldo anterior\n$44,880.44')).toEqual([]);
  });
});
