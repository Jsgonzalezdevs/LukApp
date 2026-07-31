import { getStore } from '@netlify/blobs';
import { tokenValido } from './_lib/auth.ts';

/**
 * Poll endpoint for a job started by `analizar-extracto`.
 *
 * Synchronous and deliberately trivial — it only reads one blob, so it finishes
 * far inside the ~10s synchronous budget that made the analysis itself a
 * background function.
 */
const ALMACEN = 'analisis-extractos';

// After this long with no result the job is treated as lost. Netlify caps
// background functions at 15 minutes, so anything past that will never arrive.
const MINUTOS_MAX = 16;

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req: Request): Promise<Response> => {
  if (!tokenValido(req.headers.get('authorization'), process.env.ANALISTA_TOKEN)) {
    return json({ estado: 'error', codigo: 'sin-autorizacion', mensaje: 'Token inválido.' }, 401);
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return json({ estado: 'error', codigo: 'fallo-interno', mensaje: 'Falta el id.' }, 400);
  }

  const store = getStore(ALMACEN);
  const registro = (await store.get(id, { type: 'json' })) as
    | { estado: string; desde?: string }
    | null;

  // A missing key is normal right after starting: the client generates the id and
  // may poll before the background function has written anything.
  if (!registro) return json({ estado: 'procesando' });

  if (registro.estado === 'procesando' && registro.desde) {
    const minutos = (Date.now() - new Date(registro.desde).getTime()) / 60_000;
    if (minutos > MINUTOS_MAX) {
      return json({
        estado: 'error',
        codigo: 'fallo-interno',
        mensaje: 'El análisis excedió el tiempo máximo y se perdió. Intenta de nuevo.',
      });
    }
  }

  return json(registro);
};
