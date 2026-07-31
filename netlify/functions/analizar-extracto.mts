import { PDFParse } from 'pdf-parse';
import { tokenValido } from './_lib/auth.ts';
import { analizarConPlantilla, detectarBanco } from './_lib/plantillas/index.ts';

/**
 * Reads a bank statement PDF and returns a spending report — computed
 * entirely with local, per-bank templates (see `_lib/plantillas/`). No AI
 * call, no third party, no API key: the statement text never leaves this
 * function.
 *
 * SYNCHRONOUS, and a single request: parsing a PDF's text and matching it
 * against a template takes milliseconds, nowhere near the ~10s budget, so
 * there is no need for the background-function + Blobs-staging + polling
 * dance an AI call would require. The PDF travels directly in this request's
 * body, comfortably under Netlify's ~6 MB synchronous request-body cap.
 */
const MAX_BYTES_PDF = 4 * 1024 * 1024;

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req: Request): Promise<Response> => {
  if (!tokenValido(req.headers.get('authorization'), process.env.ANALISTA_TOKEN)) {
    return json({ ok: false, codigo: 'sin-autorizacion', mensaje: 'Token inválido o ausente.' }, 401);
  }

  let cuerpo: { pdfBase64?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return json({ ok: false, codigo: 'pdf-invalido', mensaje: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { pdfBase64 } = cuerpo;
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

  let textoCrudo: string;
  try {
    const parser = new PDFParse({ data: new Uint8Array(Buffer.from(pdfBase64, 'base64')) });
    const resultado = await parser.getText();
    textoCrudo = resultado.text;
    await parser.destroy();
  } catch {
    return json(
      {
        ok: false,
        codigo: 'pdf-invalido',
        mensaje: 'No se pudo leer el texto del PDF. Puede estar corrupto o protegido con contraseña.',
      },
      422,
    );
  }

  if (!textoCrudo.trim()) {
    return json(
      {
        ok: false,
        codigo: 'pdf-invalido',
        mensaje: 'El PDF no tiene texto extraíble — probablemente es un escaneo sin capa de texto.',
      },
      422,
    );
  }

  if (!detectarBanco(textoCrudo)) {
    return json(
      {
        ok: false,
        codigo: 'banco-no-soportado',
        mensaje: 'Este extracto no coincide con ninguna plantilla soportada (Nequi, Nu, Bancolombia).',
      },
      422,
    );
  }

  const resultado = analizarConPlantilla(textoCrudo);
  if (!resultado) {
    return json(
      {
        ok: false,
        codigo: 'sin-movimientos',
        mensaje: 'Se reconoció el banco pero no se pudo leer ningún movimiento de este extracto.',
      },
      422,
    );
  }

  return json({ ok: true, resultado });
};
