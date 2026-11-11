import { describe, expect, it } from 'vitest';
import { evaluarRequisitosContrasena, validarContrasenaSegura } from './seguridad';

describe('validarContrasenaSegura', () => {
  it('acepta 6 caracteres con mayúscula, minúscula y especial, sin número', () => {
    expect(validarContrasenaSegura('Clave!', ['julian', 'julian@lukapp.app'])).toBeNull();
    expect(validarContrasenaSegura('RíoSeguro!2026')).toBeNull();
  });

  it('rechaza claves cortas o sin complejidad', () => {
    expect(validarContrasenaSegura('Cl!ve')).toMatch(/6 caracteres/i);
    expect(validarContrasenaSegura('solominusculas!')).toMatch(/mayúscula/i);
    expect(validarContrasenaSegura('SOLOMAYUSCULAS!')).toMatch(/minúscula/i);
    expect(validarContrasenaSegura('SinSimbolo123A')).toMatch(/especial/i);
  });

  it('no permite que la contraseña coincida con el usuario o correo', () => {
    expect(validarContrasenaSegura('ClaveSegura!', ['claveSegura!'])).toMatch(/igual/i);
  });
});

describe('evaluarRequisitosContrasena', () => {
  it('marca cada requisito por separado a medida que se cumple', () => {
    const cumplidos = (clave: string) =>
      evaluarRequisitosContrasena(clave).filter((r) => r.cumple).map((r) => r.id);
    expect(cumplidos('')).toEqual([]);
    expect(cumplidos('a')).toEqual(['minuscula']);
    expect(cumplidos('aB')).toEqual(['mayuscula', 'minuscula']);
    expect(cumplidos('aB!xyz')).toEqual(['largo', 'mayuscula', 'minuscula', 'especial']);
  });
});
