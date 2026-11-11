/** Reglas compartidas para contraseñas. Nunca registran ni transforman la clave. */
export const LARGO_MINIMO_CONTRASENA = 6;

const especial = /[^A-Za-z0-9\s]/;
const normalizar = (valor: string) => valor.trim().toLocaleLowerCase('es-CO');

export interface RequisitoContrasena {
  id: 'largo' | 'mayuscula' | 'minuscula' | 'especial';
  /** Lo que ve el usuario en el checklist del registro. */
  texto: string;
  /** El mensaje cuando el formulario solo tiene sitio para una línea. */
  error: string;
  cumple: (contrasena: string) => boolean;
}

/* Una sola lista alimenta la validación y el checklist visual: si alguien
   cambia una regla, el registro la enseña sin tocar la pantalla. */
export const REQUISITOS_CONTRASENA: readonly RequisitoContrasena[] = [
  {
    id: 'largo',
    texto: `Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`,
    error: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    cumple: (c) => c.length >= LARGO_MINIMO_CONTRASENA,
  },
  {
    id: 'mayuscula',
    texto: 'Una mayúscula',
    error: 'La contraseña debe incluir una letra mayúscula.',
    cumple: (c) => /[A-Z]/.test(c),
  },
  {
    id: 'minuscula',
    texto: 'Una minúscula',
    error: 'La contraseña debe incluir una letra minúscula.',
    cumple: (c) => /[a-z]/.test(c),
  },
  {
    id: 'especial',
    texto: 'Un carácter especial (!@#$…)',
    error: 'La contraseña debe incluir un carácter especial.',
    cumple: (c) => especial.test(c),
  },
];

export const evaluarRequisitosContrasena = (contrasena: string) =>
  REQUISITOS_CONTRASENA.map((requisito) => ({
    id: requisito.id,
    texto: requisito.texto,
    cumple: requisito.cumple(contrasena),
  }));

export const coincideConIdentificador = (
  contrasena: string,
  identificadores: Array<string | null | undefined> = [],
): boolean => {
  const claveNormalizada = normalizar(contrasena);
  return identificadores
    .filter((valor): valor is string => typeof valor === 'string')
    .map(normalizar)
    .filter(Boolean)
    .some((identificador) => identificador === claveNormalizada);
};

export const validarContrasenaSegura = (
  contrasena: string,
  identificadores: Array<string | null | undefined> = [],
): string | null => {
  const pendiente = REQUISITOS_CONTRASENA.find((requisito) => !requisito.cumple(contrasena));
  if (pendiente) return pendiente.error;
  if (coincideConIdentificador(contrasena, identificadores)) {
    return 'La contraseña no puede ser igual al nombre de usuario ni al correo.';
  }
  return null;
};
