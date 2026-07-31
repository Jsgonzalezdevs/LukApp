import { getStore } from '@netlify/blobs';
import { tokenValido } from './_lib/auth.ts';

/**
 * Step 1 of 2 for analyzing a statement. SYNCHRONOUS on purpose — this is the
 * half of the round trip that actually carries the PDF bytes, and Netlify's
 * own documented limits are asymmetric in exactly the way this design needs:
 * a normal synchronous function accepts up to ~6 MB of request body (~4.5 MB
 * of binary once base64 inflation is accounted for), while a BACKGROUND
 * function — which is what `analizar-extracto` must be, since a synchronous
 * function's ~10s execution budget is far too short for an AI pass over a
 * multi-page statement — is capped at a hard, non-configurable 256 KB
 * request body. That 256 KB ceiling is what produced the real "413 Payload
 * Too Large" this project hit in testing: the base64-encoded PDF was going
 * straight into the background function's own request body.
 *
 * So the PDF and the "please analyze this" trigger are deliberately two
 * separate calls: the big bytes land here, in a function shaped for big
 * bytes, and get parked in Netlify Blobs; `analizar-extracto` is then
 * triggered with nothing but a job id — comfortably under 256 KB — and reads
 * the PDF back out of Blobs itself.
 */
const ALMACEN = 'analisis-extractos';

// Comfortably under Netlify's documented ~4.5 MB effective binary limit for a
// base64-encoded request body (6 MB request cap, ~33% base64 inflation) —
// leaves headroom for the JSON envelope and matches Netlify's own guidance
// rather than the looser 6 MB this project originally assumed before hitting
// a real 413 in production.
const MAX_BYTES_PDF = 4 * 1024 * 1024;

const esIdValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[0-9a-f-]{8,64}$/i.test(valor);

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req: Request): Promise<Response> => {
  if (!tokenValido(req.headers.get('authorization'), process.env.ANALISTA_TOKEN)) {
    return json({ ok: false, codigo: 'sin-autorizacion', mensaje: 'Token inválido o ausente.' }, 401);
  }

  let cuerpo: { jobId?: unknown; pdfBase64?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return json({ ok: false, codigo: 'pdf-invalido', mensaje: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { jobId, pdfBase64 } = cuerpo;
  if (!esIdValido(jobId)) {
    return json({ ok: false, codigo: 'fallo-interno', mensaje: 'Falta el id o no es válido.' }, 400);
  }
  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    return json({ ok: false, codigo: 'pdf-invalido', mensaje: 'No llegó el contenido del PDF.' }, 400);
  }

  // base64 inflates by ~4/3, so recover the real byte count before comparing.
  const bytesReales = Math.floor((pdfBase64.length * 3) / 4);
  if (bytesReales > MAX_BYTES_PDF) {
    return json(
      {
        ok: false,
        codigo: 'pdf-muy-grande',
        mensaje: `El PDF pesa ${(bytesReales / 1024 / 1024).toFixed(1)} MB y el límite es 4 MB.`,
      },
      413,
    );
  }

  const store = getStore(ALMACEN);
  // @netlify/blobs' BlobInput is `string | ArrayBuffer | Blob` — a Node
  // Buffer is a Uint8Array, not an ArrayBuffer, so it is wrapped in a Blob
  // rather than passed directly.
  const bytes = Buffer.from(pdfBase64, 'base64');
  // Prefixed so this never collides with the `jobId`-keyed result blob that
  // analizar-extracto writes once it finishes.
  await store.set(`pdf:${jobId}`, new Blob([bytes]));

  return json({ ok: true });
};
