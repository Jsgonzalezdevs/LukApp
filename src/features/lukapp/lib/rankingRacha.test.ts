import { describe, expect, it } from 'vitest';
import {
  armarRanking,
  hitoPorCelebrar,
  ligaDeRacha,
  mensajeRival,
  rachaEnRiesgo,
  siguienteLiga,
  ultimosDias,
} from './rankingRacha';

const cruda = (posicion: number, apodo: string, actual: number, yo = false, visible = true) => ({
  posicion,
  user_id: `u${posicion}`,
  apodo,
  racha_actual: actual,
  racha_maxima: actual,
  soy_yo: yo,
  visible,
  total_participantes: 5,
});

describe('ligas', () => {
  it('sin racha no hay liga', () => expect(ligaDeRacha(0)).toBeNull());
  it('sube en los umbrales', () => {
    expect(ligaDeRacha(3)?.nombre).toBe('Bronce');
    expect(ligaDeRacha(29)?.nombre).toBe('Oro');
    expect(ligaDeRacha(500)?.nombre).toBe('Leyenda');
  });
  it('la siguiente liga es null en la cima', () => {
    expect(siguienteLiga(7)?.nombre).toBe('Oro');
    expect(siguienteLiga(100)).toBeNull();
  });
});

describe('mensajeRival', () => {
  it('dice cuánto falta para pasar al de arriba', () => {
    const r = armarRanking([cruda(1, 'ana', 10), cruda(2, 'luis', 6, true)]);
    expect(mensajeRival(r)).toContain('Te faltan 5 días para pasar a ana');
  });
  it('si empatan, un día más lo pasa', () => {
    const r = armarRanking([cruda(1, 'ana', 6), cruda(2, 'luis', 6, true)]);
    expect(mensajeRival(r)).toContain('Un día más');
  });
  it('en el primer lugar habla de la ventaja', () => {
    const r = armarRanking([cruda(1, 'luis', 9, true), cruda(2, 'ana', 4)]);
    expect(mensajeRival(r)).toContain('5 días de ventaja');
  });
  it('no habla si la persona está oculta', () => {
    const r = armarRanking([cruda(1, 'ana', 9), cruda(2, 'luis', 4, true, false)]);
    expect(mensajeRival(r)).toBeNull();
  });
});

describe('ultimosDias', () => {
  it('marca anotados, perdidos y el hoy pendiente', () => {
    const dias = ultimosDias(new Set(['2026-11-20']), '2026-11-21', 3);
    expect(dias.map((d) => d.estado)).toEqual(['perdido', 'anotado', 'hoy-pendiente']);
  });
});

describe('rachaEnRiesgo', () => {
  it('solo avisa con racha, sin anotar y de tarde', () => {
    expect(rachaEnRiesgo(5, false, 19)).toBe(true);
    expect(rachaEnRiesgo(5, false, 10)).toBe(false);
    expect(rachaEnRiesgo(5, true, 19)).toBe(false);
    expect(rachaEnRiesgo(1, false, 19)).toBe(false);
  });
});

describe('ultimosDias con protectores', () => {
  it('distingue el día protegido del perdido', () => {
    const dias = ultimosDias(new Set(['2026-11-21']), '2026-11-21', 3, new Set(['2026-11-20']));
    expect(dias.map((d) => d.estado)).toEqual(['perdido', 'protegido', 'anotado']);
  });
});

describe('hitoPorCelebrar', () => {
  const hitos = [3, 7, 14, 30];
  it('celebra solo el más alto y da por vistos los demás', () => {
    expect(hitoPorCelebrar(16, hitos, new Set())).toEqual({ celebrar: 14, marcar: [3, 7, 14] });
  });
  it('no repite lo ya celebrado', () => {
    expect(hitoPorCelebrar(16, hitos, new Set([3, 7, 14])).celebrar).toBeNull();
  });
  it('celebra un hito nuevo encima de los anteriores', () => {
    expect(hitoPorCelebrar(30, hitos, new Set([3, 7, 14]))).toEqual({ celebrar: 30, marcar: [30] });
  });
  it('sin racha no hay nada que celebrar', () => {
    expect(hitoPorCelebrar(2, hitos, new Set()).celebrar).toBeNull();
  });
});
