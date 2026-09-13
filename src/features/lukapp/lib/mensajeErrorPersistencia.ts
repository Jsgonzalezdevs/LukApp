/** Convierte errores técnicos de almacenamiento en mensajes que orientan. */
export const mensajeDeErrorPersistencia = (error: unknown, hayConexion = typeof navigator === 'undefined' ? true : navigator.onLine): string => {
  const detalle = error instanceof Error ? error.message : '';
  const texto = detalle.toLowerCase();

  if (!hayConexion || texto.includes('network') || texto.includes('fetch')) {
    return 'No hay conexión estable. El cambio queda guardado en este dispositivo y se intentará sincronizar después.';
  }
  if (texto.includes('401') || texto.includes('jwt') || texto.includes('session')) {
    return 'Tu sesión venció. Inicia sesión de nuevo para sincronizar tus cambios.';
  }
  if (texto.includes('403') || texto.includes('permission') || texto.includes('rls')) {
    return 'No tienes permiso para guardar este cambio en la cuenta actual.';
  }
  if (texto.includes('constraint') || texto.includes('validation') || texto.includes('invalid')) {
    return 'El cambio tiene un dato inválido. Revísalo e inténtalo de nuevo.';
  }
  return detalle || 'No se pudo guardar el cambio. Inténtalo de nuevo; tus datos locales no se han borrado.';
};
