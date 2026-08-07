import { describe, expect, it } from 'vitest';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar';

describe('categorizarDescripcion', () => {
  it('reconoce comercios conocidos', () => {
    expect(categorizarDescripcion('COMPRA EN MAKRO IBAG')).toBe('mercado');
    expect(categorizarDescripcion('COMPRA EN UBER RIDES')).toBe('transporte');
    expect(categorizarDescripcion('COMPRA EN SPOTIFY')).toBe('entretenimiento');
  });

  it('cae en categoría genérica por palabra clave si no hay comercio', () => {
    expect(categorizarDescripcion('PAGO DE ARRIENDO')).toBe('servicios');
  });

  it('usa otros cuando nada coincide', () => {
    expect(categorizarDescripcion('MOVIMIENTO DESCONOCIDO XYZ')).toBe('otros');
  });
});

describe('exclusionDeDescripcion', () => {
  it('detecta pagos de tarjeta', () => {
    expect(exclusionDeDescripcion('Pagaste tu tarjeta')).toBe('pago-tarjeta');
  });

  it('detecta traslados propios entre Nequi y el banco', () => {
    expect(exclusionDeDescripcion('TRANSFERENCIA DESDE NEQUI')).toBe('traslado-propio');
    expect(exclusionDeDescripcion('TRANSFERENCIAS A NEQUI')).toBe('traslado-propio');
    expect(exclusionDeDescripcion('Recarga desde Bancolombia')).toBe('traslado-propio');
  });

  it('no marca movimientos reales', () => {
    expect(exclusionDeDescripcion('COMPRA EN FARMATODO')).toBeNull();
  });
});
