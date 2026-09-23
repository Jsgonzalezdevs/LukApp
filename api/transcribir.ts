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
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const noSePudo = (motivo: string): Response =>
  new Response(JSON.stringify({ offline: true, error: motivo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const responderJson = (estado: number, cuerpo: Record<string, unknown>): Response =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * La misma barrera que usa Express cuando Vercel atiende esta ruta. No basta
 * con proteger el servidor principal: de lo contrario el borde conservaría
 * una URL pública capaz de gastar la llave de transcripción sin tocar cupos.
 */
const consumirDictadoFinal = async (
  req: Request,
  modo: ModoTranscripcion,
): Promise<Response | null> => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return responderJson(503, {
      offline: true,
      error: 'La transcripción segura necesita configurar Supabase en el servidor.',
    });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return responderJson(401, { offline: true, error: 'Inicia sesión para usar el registro por voz.' });

  const cliente = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: usuario, error: errorUsuario } = await cliente.auth.getUser(token);
  if (errorUsuario || !usuario.user) {
    return responderJson(401, { offline: true, error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
  }
  if (modo === 'parcial') {
    // Una nota larga podía mandar varios segmentos a Whisper. Evitarlos aquí
    // mantiene el límite de 60/300 en notas reales terminadas, no en trozos
    // invisibles de una sola frase.
    return noSePudo('La vista previa por voz no está disponible.');
  }

  const { data, error } = await cliente.rpc('consumir_cupo_plan', {
    p_usuario: usuario.user.id,
    p_recurso: 'dictado',
  });
  if (error) {
    console.error('[transcribir] No se pudo revisar el cupo:', error.message);
    return responderJson(503, { offline: true, error: 'No se pudo verificar tu plan. Inténtalo de nuevo.' });
  }
  const cupo = Array.isArray(data) ? data[0] : data;
  if (!cupo?.permitido) {
    const limite = Number(cupo?.limite) || 0;
    const nombrePlan = cupo?.plan_codigo === 'premium' ? 'Premium' : 'Normal';
    const etiqueta = limite === 1 ? 'registro por voz' : 'registros por voz';
    return responderJson(429, {
      offline: true,
      codigo: 'cupo-agotado',
      error: `Alcanzaste el límite de ${limite} ${etiqueta} de tu plan ${nombrePlan} este mes.`,
    });
  }

  return null;
};

const devolverDictadoFinal = async (req: Request): Promise<void> => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !serviceRole || !token) return;
  const cliente = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: usuario } = await cliente.auth.getUser(token);
  if (!usuario.user) return;
  const { error } = await cliente.rpc('devolver_cupo_plan', {
    p_usuario: usuario.user.id,
    p_recurso: 'dictado',
  });
  if (error) console.error('[transcribir] No se pudo devolver el cupo:', error.message);
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const audio = await req.blob();
  if (audio.size === 0) return noSePudo('No llegó audio');

  const tipo = req.headers.get('content-type') ?? 'audio/webm';
  const modo: ModoTranscripcion =
    req.headers.get('x-lukapp-transcription-mode') === 'parcial' ? 'parcial' : 'final';
  if (modo === 'parcial') return noSePudo('La vista previa por voz no está disponible.');
  const denegada = await consumirDictadoFinal(req, modo);
  if (denegada) return denegada;
  const vocabulario = leerVocabularioPersonal(
    req.headers.get('x-lukapp-vocabulario'),
  );
  const resultado = await transcribirAudio(audio, tipo, {
    entorno: process.env,
    modo,
    vocabulario,
    onError: (mensaje) => console.error(mensaje),
  });

  if (modo === 'final' && ('offline' in resultado || !resultado.text)) {
    await devolverDictadoFinal(req);
  }

  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
