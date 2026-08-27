import { describe, expect, it } from 'vitest';
import { calcularResumenVaquita, type Vaquita } from './vaquitasColombia';

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
});
