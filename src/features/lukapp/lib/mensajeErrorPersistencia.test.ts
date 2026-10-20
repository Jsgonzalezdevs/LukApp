import { describe, expect, it } from 'vitest';
import { mensajeDeErrorPersistencia } from './mensajeErrorPersistencia';

describe('mensajeDeErrorPersistencia', () => {
  it('no promete un guardado local que el repositorio no ha confirmado', () => {
    expect(mensajeDeErrorPersistencia(new Error('fetch failed'), true)).toMatch(/No se pudo confirmar el guardado/);
  });
  it('distingue una sesión vencida', () => {
    expect(mensajeDeErrorPersistencia(new Error('JWT expired'), true)).toMatch(/sesión venció/);
  });
  it('mantiene el detalle útil de un error local desconocido', () => {
    expect(mensajeDeErrorPersistencia(new Error('disco lleno'), true)).toBe('disco lleno');
  });
  it('distingue datos inválidos', () => {
    expect(mensajeDeErrorPersistencia(new Error('invalid input'), true)).toMatch(/dato inválido/);
  });
});
