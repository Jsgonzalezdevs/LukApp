/** Reglas compartidas para contraseñas. Nunca registran ni transforman la clave. */
export const LARGO_MINIMO_CONTRASENA = 12;

const especial = /[^A-Za-z0-9\s]/;
const normalizar = (valor: string) => valor.trim().toLocaleLowerCase('es-CO');

export const validarContrasenaSegura = (
  contrasena: string,
  identificadores: Array<string | null | undefined> = [],
): string | null => {
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }
  if (!/[a-z]/.test(contrasena)) return 'La contraseña debe incluir una letra minúscula.';
  if (!/[A-Z]/.test(contrasena)) return 'La contraseña debe incluir una letra mayúscula.';
  if (!/\d/.test(contrasena)) return 'La contraseña debe incluir un número.';
  if (!especial.test(contrasena)) return 'La contraseña debe incluir un carácter especial.';

  const claveNormalizada = normalizar(contrasena);
  const coincide = identificadores
    .filter((valor): valor is string => typeof valor === 'string')
    .map(normalizar)
    .filter(Boolean)
    .some((identificador) => identificador === claveNormalizada);
  if (coincide) return 'La contraseña no puede ser igual al nombre de usuario ni al correo.';
  return null;
};
