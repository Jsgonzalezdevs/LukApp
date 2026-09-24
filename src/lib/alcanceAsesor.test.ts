import { describe, expect, it } from 'vitest';
import { clasificarAlcanceAsesor, RESPUESTA_TEMA_TECNICO } from './alcanceAsesor';

describe('alcance del Asesor', () => {
  it('redirige una pregunta técnica sin datos financieros al propósito del chat', () => {
    expect(clasificarAlcanceAsesor('¿Cómo hago una base de datos en SQL?')).toBe('tecnica-sin-finanzas');
    expect(RESPUESTA_TEMA_TECNICO).toMatch(/resumen del mes/i);
  });

  it('conserva la consulta financiera cuando viene mezclada con un tema técnico', () => {
    expect(
      clasificarAlcanceAsesor('Primero dime cómo crear una base SQL y luego cómo van mis gastos este mes'),
    ).toBe('financiera');
  });
});
