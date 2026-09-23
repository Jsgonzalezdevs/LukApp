import { describe, expect, it } from 'vitest';
import { validarContrasenaSegura } from './seguridad';

describe('validarContrasenaSegura', () => {
  it('acepta una contraseña larga con las cuatro familias requeridas', () => {
    expect(validarContrasenaSegura('RíoSeguro!2026', ['julian', 'julian@lukapp.app'])).toBeNull();
  });

  it('rechaza claves cortas o sin complejidad', () => {
    expect(validarContrasenaSegura('Clave!1')).toMatch(/12 caracteres/i);
    expect(validarContrasenaSegura('solominusculas!12')).toMatch(/mayúscula/i);
    expect(validarContrasenaSegura('SOLOMAYUSCULAS!12')).toMatch(/minúscula/i);
    expect(validarContrasenaSegura('SinNumeroEspecial!')).toMatch(/número/i);
    expect(validarContrasenaSegura('SinSimbolo123A')).toMatch(/especial/i);
  });

  it('no permite que la contraseña coincida con el usuario o correo', () => {
    expect(validarContrasenaSegura('ClaveSegura!12', ['claveSegura!12'])).toMatch(/igual/i);
    expect(validarContrasenaSegura('CorreoSeguro!12', ['correoSeguro!12'])).toMatch(/igual/i);
  });
});
