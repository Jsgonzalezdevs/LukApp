import { describe, expect, it } from 'vitest';
import { aplicarAbono, convertirCotizacion, saldoPendiente, totalesNegocio, type DocumentoNegocio } from './modelo';

const documento: DocumentoNegocio = {
  id: 'f1', tipo: 'por_cobrar', estado: 'enviado', contraparte: 'Cliente', concepto: 'Diseño', totalCop: 500_000,
  fecha: '2026-10-02', vence: '2026-10-30', abonos: [{ id: 'a1', montoCop: 200_000, fecha: '2026-10-10', nota: '' }], cotizacionOrigenId: null,
};

describe('registro para independientes y negocios', () => {
  it('valida abonos y calcula saldo sin permitir pagar de más', () => {
    expect(saldoPendiente(documento)).toBe(300_000);
    expect(aplicarAbono(documento, { id: 'a2', montoCop: 300_001, fecha: '2026-10-12', nota: '' })).toBeNull();
    expect(saldoPendiente(aplicarAbono(documento, { id: 'a2', montoCop: 300_000, fecha: '2026-10-12', nota: '' })!)).toBe(0);
  });

  it('distingue el mes devengado de la caja efectivamente recibida', () => {
    expect(totalesNegocio([documento], '2026-10', 'devengo').ingresosCop).toBe(500_000);
    expect(totalesNegocio([documento], '2026-10', 'caja').ingresosCop).toBe(200_000);
  });

  it('convierte una cotización en cuenta por cobrar enlazada sin sobrescribirla', () => {
    const cotizacion = { ...documento, id: 'c1', tipo: 'cotizacion' as const, abonos: [] };
    expect(convertirCotizacion(cotizacion, 'f2', '2026-10-21')).toMatchObject({ tipo: 'por_cobrar', cotizacionOrigenId: 'c1', totalCop: 500_000 });
  });
});
