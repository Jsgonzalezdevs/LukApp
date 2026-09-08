/** Limita también operaciones que no admiten AbortSignal, como obtener sesión. */
export async function esperarConLimite<T>(operacion: Promise<T>, milisegundos: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operacion,
      new Promise<never>((_, reject) => {
        temporizador = setTimeout(() => reject(new Error('tiempo-agotado')), milisegundos);
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}
