/** El límite incluye leer el cuerpo, no solo recibir las cabeceras HTTP. */
export async function fetchConLimite(url: string, init: RequestInit, limiteMs: number): Promise<Response> {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', cancelar, { once: true });
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const respuesta = await globalThis.fetch(url, { ...init, signal: controller.signal });
        const cuerpo = await respuesta.arrayBuffer();
        return new Response(cuerpo.byteLength ? cuerpo : null, {
          status: respuesta.status, statusText: respuesta.statusText, headers: respuesta.headers,
        });
      })(),
      new Promise<never>((_, reject) => {
        temporizador = setTimeout(() => {
          controller.abort();
          reject(new Error('tiempo-agotado'));
        }, Math.max(0, limiteMs));
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
    init.signal?.removeEventListener('abort', cancelar);
  }
}
