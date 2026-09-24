import { describe, it, expect } from 'vitest';
import { activarProteccionCodigo } from './proteccionCodigo';

describe('activarProteccionCodigo', () => {
  it('se ejecuta sin ocultar la consola que permite diagnosticar errores', () => {
    const errorOriginal = console.error;
    expect(() => activarProteccionCodigo()).not.toThrow();
    expect(console.error).toBe(errorOriginal);
  });
});
