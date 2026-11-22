import { describe, expect, it } from 'vitest';
import { diasDeRegalo, leerRegaloPremium, palabraDias } from './regaloPremium';

describe('diasDeRegalo', () => {
  it('cuenta días de calendario en Bogotá, no horas', () => {
    // Otorgado al mediodía del 22, vence el 29 a las 23:59 de Bogotá.
    expect(diasDeRegalo('2026-11-22T17:00:00Z', '2026-11-30T04:59:59Z')).toBe(7);
  });

  it('no se corre un día por la noche en Bogotá (ya es mañana en UTC)', () => {
    // 22 de noviembre, 9 p. m. en Bogotá = 23 en UTC.
    expect(diasDeRegalo('2026-11-23T02:00:00Z', '2026-12-23T04:59:59Z')).toBe(30);
  });

  it('un regalo que vence el mismo día cuenta como uno', () => {
    expect(diasDeRegalo('2026-11-22T13:00:00Z', '2026-11-23T04:59:59Z')).toBe(1);
  });

  it('devuelve 0 con fechas inválidas', () => {
    expect(diasDeRegalo('no', '2026-11-23T04:59:59Z')).toBe(0);
  });
});

describe('leerRegaloPremium', () => {
  it('acepta un regalo bien formado', () => {
    expect(leerRegaloPremium({ regalo: { id: 4, dias: 30, venceEn: '2026-12-22T04:59:59Z' } }))
      .toEqual({ id: 4, dias: 30, venceEn: '2026-12-22T04:59:59Z' });
  });

  it('descarta lo que no sirve para pintar el pop-up', () => {
    expect(leerRegaloPremium({ regalo: null })).toBeNull();
    expect(leerRegaloPremium({ regalo: { id: 4, dias: 0, venceEn: '2026-12-22T04:59:59Z' } })).toBeNull();
    expect(leerRegaloPremium({ regalo: { id: '4', dias: 3, venceEn: '2026-12-22T04:59:59Z' } })).toBeNull();
    expect(leerRegaloPremium({ regalo: { id: 4, dias: 3, venceEn: 'mañana' } })).toBeNull();
    expect(leerRegaloPremium('hola')).toBeNull();
  });
});

describe('palabraDias', () => {
  it('singular y plural', () => {
    expect(palabraDias(1)).toBe('día');
    expect(palabraDias(15)).toBe('días');
  });
});
