import { describe, expect, it } from 'vitest';
import { calcularResumenVaquita, repartirCuota, type Vaquita } from './vaquitasColombia';

describe('vaquitasColombia - calcularResumenVaquita', () => {
  it('reparte pesos enteros sin perder ni crear plata por redondeo', () => {
    expect(repartirCuota(100, 3)).toEqual([34, 33, 33]);
    expect(repartirCuota(100, 3).reduce((suma, cuota) => suma + cuota, 0)).toBe(100);
    expect(repartirCuota(0, 3)).toEqual([0, 0, 0]);
    expect(repartirCuota(100, 0)).toEqual([]);
  });

  it('muestra el saldo real del proyecto y señala cuando sus gastos superan los aportes', () => {
    const vaquita: Vaquita = {
      id: 'proyecto-1', nombre: 'Paseo', emoji: '🚌', metaCop: 100_000,
      participantes: [
        { nombre: 'Yo', cuotaComprometida: 50_000, aportadoCop: 40_000 },
        { nombre: 'Ana', cuotaComprometida: 50_000, aportadoCop: 20_000 },
      ],
      gastos: [{ id: 'g1', descripcion: 'Bus', montoCop: 70_000, pagadoPor: 'Yo', fecha: '2026-10-21' }],
      creadaEn: '2026-10-21',
    };
    const resumen = calcularResumenVaquita(vaquita);
    expect(resumen.totalRecolectado).toBe(60_000);
    expect(resumen.totalGastado).toBe(70_000);
    expect(resumen.saldoDisponible).toBe(-10_000);
    expect(resumen.pendientesPorPagar).toEqual([{ nombre: 'Yo', faltante: 10_000 }, { nombre: 'Ana', faltante: 30_000 }]);
  });

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
