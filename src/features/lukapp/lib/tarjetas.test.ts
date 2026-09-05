import { describe, expect, it } from 'vitest';
import type { Cajita } from '../data/modelos';
import { clasificarCompraTarjeta, fechasTarjeta, resumenTarjeta } from './tarjetas';

const tarjeta = (extra: Partial<Cajita> = {}): Cajita => ({
  id: 't1', nombre: 'Visa', icon: 'credit-card', tipo: 'tarjeta', metaCop: null,
  tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null, ...extra,
});

describe('tarjetas', () => {
  it('calcula corte y pago con rollover de mes', () => {
    const fechas = fechasTarjeta(tarjeta({ diaCorte: 15, diaPago: 5 }), '2026-01-20');
    expect(fechas.corte).toBe('2026-02-15');
    expect(fechas.pago).toBe('2026-03-05');
  });

  it('no inventa cupo ni fechas en tarjetas antiguas', () => {
    const resumen = resumenTarjeta(tarjeta(), 100_000, [], [], '2026-09', '2026-09-05');
    expect(resumen.cupoDisponibleCop).toBeNull();
    expect(resumen.fechaCorteSiguiente).toBeNull();
    expect(resumen.fechaPagoSiguiente).toBeNull();
  });

  it('nunca muestra cupo negativo', () => {
    const resumen = resumenTarjeta(tarjeta({ limiteCreditoCop: 50_000 }), 100_000, [], [], '2026-09', '2026-09-05');
    expect(resumen.cupoDisponibleCop).toBe(0);
  });

  it.each([
    ['antes del corte', '2026-09-04', '2026-09-04', 'antes-del-corte', '2026-09', 'actual'],
    ['en el corte', '2026-09-05', '2026-09-04', 'en-el-corte', '2026-09', 'actual'],
    ['después del corte', '2026-09-06', '2026-09-06', 'despues-del-corte', '2026-10', 'actual'],
    ['rollover enero', '2026-12-06', '2026-12-06', 'despues-del-corte', '2027-01', 'actual'],
  ])('%s pertenece al extracto definido', (_nombre, compra, referencia, posicion, extracto, posicionExtracto) => {
    expect(clasificarCompraTarjeta(tarjeta({ diaCorte: 5 }), compra, referencia)).toMatchObject({ posicion, extracto, posicionExtracto });
  });

  it('ajusta corte 31 al último día real del mes', () => {
    const tarjeta31 = tarjeta({ diaCorte: 31, diaPago: 20 });
    expect(clasificarCompraTarjeta(tarjeta31, '2026-02-28', '2026-02-15').extracto).toBe('2026-02');
    expect(fechasTarjeta(tarjeta31, '2026-02-01').corte).toBe('2026-02-28');
    expect(fechasTarjeta(tarjeta31, '2026-04-01').corte).toBe('2026-04-30');
  });

  it('devuelve desconocido cuando falta configuración o la fecha es incompleta', () => {
    expect(clasificarCompraTarjeta(tarjeta(), '2026-09-01', '2026-09-01').extracto).toBeNull();
    expect(clasificarCompraTarjeta(tarjeta({ diaCorte: 5 }), '2026-09', '2026-09-01').posicion).toBe('desconocida');
  });
});
