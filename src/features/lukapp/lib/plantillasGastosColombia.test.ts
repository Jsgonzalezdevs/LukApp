import { describe, expect, it } from 'vitest';
import { PLANTILLAS_GASTOS_COLOMBIA } from './plantillasGastosColombia';

describe('plantillasGastosColombia', () => {
  it('contiene las categorías principales del gasto en Colombia', () => {
    const ids = PLANTILLAS_GASTOS_COLOMBIA.map((p) => p.id);
    expect(ids).toContain('arriendo');
    expect(ids).toContain('servicios_publicos');
    expect(ids).toContain('mercado_quincenal');
    expect(ids).toContain('transporte_publico');
  });

  it('cada plantilla tiene emoji, monto sugerido positivo y descripción', () => {
    for (const plantilla of PLANTILLAS_GASTOS_COLOMBIA) {
      expect(plantilla.emoji).toBeTruthy();
      expect(plantilla.montoSugerido).toBeGreaterThan(0);
      expect(plantilla.nombre).toBeTruthy();
    }
  });
});
