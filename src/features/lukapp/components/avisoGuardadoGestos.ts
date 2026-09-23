/** Un gesto intencional evita cerrar el aviso mientras la persona solo navega. */
export const debeCerrarPorDeslizamiento = (desplazamientoY: number, velocidadY: number): boolean =>
  desplazamientoY > 72 || velocidadY > 520;
