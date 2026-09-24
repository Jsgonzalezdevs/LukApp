/**
 * Conserva el punto de extensión que usaban despliegues anteriores.
 *
 * La protección real vive en autenticación, RLS y el servidor. Bloquear DevTools
 * o reemplazar `console` no protege el código público y sí ocultaba errores
 * reales, rompía accesos del navegador y dificultaba el soporte.
 */
export const activarProteccionCodigo = (): void => undefined;
