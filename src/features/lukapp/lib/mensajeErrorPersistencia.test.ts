import { describe, expect, it } from 'vitest';
import { mensajeDeErrorPersistencia } from './mensajeErrorPersistencia';

describe('mensajeDeErrorPersistencia', () => {
  it('explica que un error de red se conserva localmente', () => {
    expect(mensajeDeErrorPersistencia(new Error('fetch failed'), true)).toMatch(/guardado en este dispositivo/);
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
