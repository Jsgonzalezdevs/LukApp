import { describe, expect, it } from 'vitest';
import { detectarPropuestaAsesor } from './propuestasAsesor';

describe('detectarPropuestaAsesor', () => {
  it('propone un límite de presupuesto solo si identifica categoría y monto', () => {
    expect(detectarPropuestaAsesor('Quiero poner un presupuesto de 300 mil para comida')).toMatchObject({
      tipo: 'presupuesto', categoria: 'comida', montoCop: 300_000,
    });
    expect(detectarPropuestaAsesor('Quiero poner un presupuesto de 300 mil')).toBeNull();
  });

  it('propone una meta editable y conserva su nombre', () => {
    expect(detectarPropuestaAsesor('Quiero crear una meta de 2 millones para viajar a Europa')).toMatchObject({
      tipo: 'meta', nombre: 'Viajar a Europa', objetivoCop: 2_000_000, fechaObjetivo: null,
    });
  });

  it('no convierte una consulta o un monto ambiguo en una acción', () => {
    expect(detectarPropuestaAsesor('¿Qué es un presupuesto de 300 mil para comida?')).toBeNull();
    expect(detectarPropuestaAsesor('Quiero una meta para viajar')).toBeNull();
  });
});
