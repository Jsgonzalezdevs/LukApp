import { describe, expect, it } from 'vitest';
import { calcularResumenVaquita, textoParaCompartirVaquita, type Vaquita } from './vaquitasColombia';

describe('vaquitasColombia - calcularResumenVaquita', () => {
  it('calcula recolección, faltantes y liquidación entre amigos', () => {
    const vaquita: Vaquita = {
      id: 'vaca-1',
      nombre: 'Asado Fin de Semana',
      emoji: '🥩',
      metaCop: 150_000,
      participantes: [
        { nombre: 'Carlos', cuotaComprometida: 50_000, aportadoCop: 50_000 },
        { nombre: 'Andrés', cuotaComprometida: 50_000, aportadoCop: 50_000 },
        { nombre: 'María', cuotaComprometida: 50_000, aportadoCop: 0 },
      ],
      gastos: [
        {
          id: 'g-1',
          descripcion: 'Carne y carbón',
          montoCop: 100_000,
          pagadoPor: 'Carlos',
          fecha: '2026-08-27',
        },
      ],
      creadaEn: '2026-08-27',
    };

    const resumen = calcularResumenVaquita(vaquita);

    expect(resumen.totalRecolectado).toBe(100_000);
    expect(resumen.totalGastado).toBe(100_000);
    expect(resumen.pendientesPorPagar).toHaveLength(1);
    expect(resumen.pendientesPorPagar[0].nombre).toBe('María');
    expect(resumen.pendientesPorPagar[0].faltante).toBe(50_000);

    // Liquidación: María le debe a Carlos
    expect(resumen.liquidacionesSugeridas).toHaveLength(1);
    expect(resumen.liquidacionesSugeridas[0].deudor).toBe('María');
    expect(resumen.liquidacionesSugeridas[0].acreedor).toBe('Carlos');
    expect(resumen.liquidacionesSugeridas[0].montoCop).toBe(50_000);
  });

  it('prepara un resumen para enviar con la firma de LukApp', () => {
    const vaquita: Vaquita = {
      id: 'vaca-2', nombre: 'Regalo', emoji: '🐮', metaCop: 40_000, gastos: [], creadaEn: '2026-09-13',
      participantes: [
        { nombre: 'Persona 1', cuotaComprometida: 20_000, aportadoCop: 20_000 },
        { nombre: 'Persona 2', cuotaComprometida: 20_000, aportadoCop: 0 },
      ],
    };

    expect(textoParaCompartirVaquita(vaquita)).toContain('Persona 1: Pagó');
    expect(textoParaCompartirVaquita(vaquita)).toContain('Persona 2: Faltan');
    expect(textoParaCompartirVaquita(vaquita)).toContain('Creado con LukApp');
  });
});
