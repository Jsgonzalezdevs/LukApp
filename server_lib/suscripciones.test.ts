import { describe, expect, it } from 'vitest';
import {
  esRecursoDeCupo,
  fechaPremiumValida,
  mensajeCupoAgotado,
  validarConfiguracionPlan,
} from './suscripciones';

describe('suscripciones', () => {
  it('solo reconoce recursos que el servidor puede cobrar por cupo', () => {
    expect(esRecursoDeCupo('dictado')).toBe(true);
    expect(esRecursoDeCupo('asesor_ia')).toBe(true);
    expect(esRecursoDeCupo('inventado')).toBe(false);
  });

  it('explica el cupo agotado con el plan y el límite vigente', () => {
    expect(mensajeCupoAgotado('extracto', { plan_codigo: 'normal', limite: 1 }))
      .toBe('Alcanzaste el límite de 1 extracto PDF de tu plan Normal este mes.');
  });

  it('normaliza una configuración válida sin aceptar precios fraccionados', () => {
    expect(validarConfiguracionPlan({
      precioMensualCop: 9900,
      precioAnualCop: 79900,
      limiteDictadosMensual: 60,
      limiteAsesorIaMensual: 5,
      limiteExtractosMensual: 1,
      limiteEspaciosCompartidos: 1,
      limiteIntegrantesPorEspacio: 4,
      activo: true,
    })).toMatchObject({ precioMensualCop: 9900, limiteEspaciosCompartidos: 1 });

    expect(() => validarConfiguracionPlan({
      precioMensualCop: 9900.5,
      precioAnualCop: 79900,
      limiteDictadosMensual: 60,
      limiteAsesorIaMensual: 5,
      limiteExtractosMensual: 1,
      limiteEspaciosCompartidos: 1,
      limiteIntegrantesPorEspacio: 4,
      activo: true,
    })).toThrow('precio mensual');
  });

  it('acepta solo vigencias Premium futuras', () => {
    expect(fechaPremiumValida('2030-01-01T00:00:00.000Z')).toBe('2030-01-01T00:00:00.000Z');
    expect(() => fechaPremiumValida('2020-01-01T00:00:00.000Z')).toThrow('futuro');
  });
});
