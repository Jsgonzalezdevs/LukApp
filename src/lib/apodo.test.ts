import { describe, expect, it } from 'vitest';
import { validarApodo } from './apodo';

describe('validarApodo', () => {
  it('acepta nombres normales, con tildes y espacios, y los deja limpios', () => {
    expect(validarApodo('  María  José ')).toEqual({ ok: true, apodo: 'María José' });
    expect(validarApodo('juan_23')).toEqual({ ok: true, apodo: 'juan_23' });
  });

  it('rechaza nombres muy cortos, muy largos o sin letras', () => {
    expect(validarApodo('jo').ok).toBe(false);
    expect(validarApodo('a'.repeat(25)).ok).toBe(false);
    expect(validarApodo('12345').ok).toBe(false);
    expect(validarApodo(undefined).ok).toBe(false);
  });

  it('rechaza símbolos que podrían romper cómo se ve en el ranking', () => {
    expect(validarApodo('<script>').ok).toBe(false);
    expect(validarApodo('hola@correo').ok).toBe(false);
  });

  it('no deja hacerse pasar por el equipo de LukApp', () => {
    expect(validarApodo('Admin').ok).toBe(false);
    expect(validarApodo('Soporte LukApp').ok).toBe(false);
    expect(validarApodo('luki_oficial').ok).toBe(false);
    expect(validarApodo('L.u.k.i').ok).toBe(false);
  });
});
