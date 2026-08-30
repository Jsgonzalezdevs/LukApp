import { describe, expect, it } from 'vitest';
import { parseTransferenciaVoz } from './parseTransferenciaVoz';

const CUENTAS = [
  { id: 'nequi', nombre: 'Nequi' },
  { id: 'banco', nombre: 'Bancolombia' },
  { id: 'efectivo', nombre: 'Efectivo' },
];

describe('parseTransferenciaVoz', () => {
  it('extrae monto, origen y destino de una transferencia dictada', () => {
    expect(parseTransferenciaVoz('Transfiere 50 mil de Nequi a Bancolombia', CUENTAS)).toMatchObject({
      origenId: 'nequi', destinoId: 'banco', montoCop: 50000,
    });
  });

  it('no convierte un gasto o una transferencia incompleta en movimiento interno', () => {
    expect(parseTransferenciaVoz('pagué 50 mil desde Nequi', CUENTAS)).toBeNull();
    expect(parseTransferenciaVoz('transfiere 50 mil de Nequi', CUENTAS)).toBeNull();
  });
});
