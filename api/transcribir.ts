/**
 * Convierte a texto lo que la persona dictó.
 *
 * Vive en Vercel y no solo en el Express de Render: la PWA se sirve desde
 * Vercel y `/api/transcribir` debe existir en el mismo origen. El audio llega
 * como cuerpo crudo; este borde lo convierte a multipart al hablar con el
 * proveedor de voz.
 */
import {
  leerVocabularioPersonal,
  transcribirAudio,
  type ModoTranscripcion,
} from '../server_lib/transcripcion';

export const config = { runtime: 'edge' };

const noSePudo = (motivo: string): Response =>
  new Response(JSON.stringify({ offline: true, error: motivo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const audio = await req.blob();
  if (audio.size === 0) return noSePudo('No llegó audio');

  const tipo = req.headers.get('content-type') ?? 'audio/webm';
  const modo: ModoTranscripcion =
    req.headers.get('x-lukapp-transcription-mode') === 'parcial' ? 'parcial' : 'final';
  const vocabulario = leerVocabularioPersonal(
    req.headers.get('x-lukapp-vocabulario'),
  );
  const resultado = await transcribirAudio(audio, tipo, {
    entorno: process.env,
    modo,
    vocabulario,
    onError: (mensaje) => console.error(mensaje),
  });

  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
