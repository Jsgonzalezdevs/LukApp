import { describe, it, expect } from 'vitest';
import { redactarTexto } from './redactar';

describe('redactarTexto — lo que SÍ debe redactar', () => {
  it('redacta el número de cuenta en una línea etiquetada', () => {
    const salida = redactarTexto('Cuenta: 1234567890');
    expect(salida).not.toContain('1234567890');
    expect(salida).toContain('[DATO PERSONAL OCULTO]');
  });

  it('redacta cédula, NIT, titular, nombre y dirección', () => {
    const entrada = [
      'Cédula: 79876543',
      'NIT: 900123456',
      'Titular: Julian Gonzalez',
      'Nombre del cliente: Julian Gonzalez',
      'Dirección: Calle 10 # 5-45',
    ].join('\n');
    const salida = redactarTexto(entrada);
    expect(salida).not.toMatch(/79876543|900123456|Julian Gonzalez|Calle 10/);
  });

  it('no depende de mayúsculas ni de acentos en la etiqueta', () => {
    expect(redactarTexto('CÉDULA: 12345678')).not.toContain('12345678');
    expect(redactarTexto('cedula: 12345678')).not.toContain('12345678');
    expect(redactarTexto('Dirección: Cra 5')).not.toContain('Cra 5');
    expect(redactarTexto('direccion: Cra 5')).not.toContain('Cra 5');
  });

  it('redacta una corrida larga de dígitos sin separadores aunque no tenga etiqueta', () => {
    // Un número de cuenta o de tarjeta mencionado dentro de una descripción,
    // no solo en el encabezado.
    const salida = redactarTexto('Transferencia a cuenta 3001234567 - Nequi');
    expect(salida).not.toContain('3001234567');
    expect(salida).toContain('[DATO PERSONAL OCULTO]');
  });

  it('conserva la etiqueta y solo reemplaza el valor', () => {
    const salida = redactarTexto('Titular: Julian Gonzalez');
    expect(salida).toBe('Titular: [DATO PERSONAL OCULTO]');
  });
});

describe('redactarTexto — lo que NO debe tocar (la razón de ser de esta función)', () => {
  it('nunca borra un monto en pesos agrupado con puntos', () => {
    for (const monto of ['45.000', '1.234.567', '999.999', '12.345.678']) {
      expect(redactarTexto(`Compra Éxito ${monto}`)).toContain(monto);
    }
  });

  it('no borra un monto agrupado incluso si es de 8+ dígitos totales', () => {
    // 12.345.678 son 8 dígitos en total, pero agrupados — no es una cuenta.
    expect(redactarTexto('Pago 12.345.678')).toContain('12.345.678');
  });

  it('no borra un monto con coma decimal', () => {
    expect(redactarTexto('Total 45.000,00')).toContain('45.000,00');
  });

  it('deja intactas las líneas de movimientos normales', () => {
    const linea = '15/07/2026  MERCADO EXITO BOGOTA  45.000';
    expect(redactarTexto(linea)).toBe(linea);
  });

  it('no redacta números cortos (menos de 8 dígitos seguidos)', () => {
    expect(redactarTexto('Ref: 1234567')).toContain('1234567');
  });
});

describe('redactarTexto — casos borde', () => {
  it('no revienta con texto vacío', () => {
    expect(redactarTexto('')).toBe('');
  });

  it('es determinístico', () => {
    const entrada = 'Cuenta: 1234567890\nCompra 45.000';
    expect(redactarTexto(entrada)).toBe(redactarTexto(entrada));
  });

  it('redacta varias líneas sensibles en el mismo texto sin afectar las demás', () => {
    const entrada = [
      'Titular: Julian Gonzalez',
      '15/07/2026  MERCADO EXITO  45.000',
      'Cuenta: 1234567890',
      '16/07/2026  NETFLIX  38.000',
    ].join('\n');
    const salida = redactarTexto(entrada);
    expect(salida).toContain('MERCADO EXITO  45.000');
    expect(salida).toContain('NETFLIX  38.000');
    expect(salida).not.toContain('Julian Gonzalez');
    expect(salida).not.toContain('1234567890');
  });
});
