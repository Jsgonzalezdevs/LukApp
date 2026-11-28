import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { urlSupabaseDelServidor } from './server_lib/configuracionSupabase.ts';
import {
  CABECERAS_API_SEGURAS,
  esOrigenCorsPermitido,
  origenesCorsPermitidos,
} from './server_lib/seguridadHttp.ts';
import { MAX_BYTES_AUDIO, rateLimiter } from './server_lib/nucleo.ts';
import { rutasPagos } from './server_lib/rutas/pagos.ts';
import { rutasSuperadmin } from './server_lib/rutas/superadmin.ts';
import { rutasCuenta } from './server_lib/rutas/cuenta.ts';
import { rutasExtractosVoz } from './server_lib/rutas/extractosVoz.ts';
import { rutasAsesor } from './server_lib/rutas/asesor.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Express no debe revelar la tecnología de la que parte la API.
app.disable('x-powered-by');

// Las respuestas de API pueden contener información financiera. Aplicar estas
// cabeceras antes de CORS también protege las preflight que CORS responde solo.
app.use('/api', (req, res, next) => {
  for (const [nombre, valor] of Object.entries(CABECERAS_API_SEGURAS)) {
    res.setHeader(nombre, valor);
  }
  const protocoloDelProxy = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (req.secure || protocoloDelProxy === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

const origenesCors = origenesCorsPermitidos(process.env);
app.use('/api', cors({
  origin: (origen, callback) => callback(null, esOrigenCorsPermitido(origen, origenesCors)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Authorization',
    'Content-Type',
    'X-Api-Key',
    'X-Lukapp-Transcription-Mode',
    'X-Lukapp-Vocabulario',
  ],
  credentials: false,
  maxAge: 86_400,
  optionsSuccessStatus: 204,
}));

app.use('/api', rateLimiter(120, 60000));
// Las acciones que alteran cuentas no necesitan el límite amplio del resto de
// la API. Es una segunda barrera ante automatización y fuerza bruta.
app.use(['/api/crear-usuario', '/api/editar-usuario', '/api/solicitudes-superadmin', '/api/superadmin/legal/terminos', '/api/superadmin/racha'], rateLimiter(12, 60000));
// Estos límites van antes de leer el cuerpo: así una ráfaga no fuerza a
// deserializar PDFs, audios o prompts costosos antes de ser rechazada.
app.use('/api/analizar-extracto', rateLimiter(6, 60000));
app.use('/api/asesor-ia', rateLimiter(12, 60000));
app.use('/api/finanzas-insights-ia', rateLimiter(6, 60000));
app.use('/api/transcribir', rateLimiter(12, 60000));
app.use('/api/atajo/movimiento', rateLimiter(20, 60000));
app.use('/api/transcribir', (req, res, next) => {
  const contenido = Number(req.get('content-length'));
  if (Number.isFinite(contenido) && contenido > MAX_BYTES_AUDIO) {
    return res.status(413).json({ offline: true, error: 'El audio supera el límite de 8 MB.' });
  }
  return next();
});

// PDF de hasta 4 MB en base64 ocupa cerca de 5.4 MB; 6 MB deja margen sin
// aceptar de forma innecesaria cuerpos enormes. El audio se limita por ruta.
app.use(express.json({
  // Documentos de contexto de hasta 4 MB llegan codificados en base64; el
  // margen permite el aumento de tamaño sin aceptar cuerpos arbitrarios.
  limit: '6mb',
  // Resend firma los bytes originales del webhook; conservarlos aquí permite
  // validar la firma antes de confiar en el JSON ya interpretado.
  verify: (req, _res, buffer) => { (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); },
}));
app.use(express.raw({ type: 'audio/*', limit: MAX_BYTES_AUDIO }));
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (typeof error === 'object' && error && (error as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
  }
  return next(error);
});

// Cada tema de la API vive en server_lib/rutas/. Van después del cuerpo y los
// limitadores de arriba, que dependen de correr antes que cualquier ruta.
app.use(rutasSuperadmin);
app.use(rutasCuenta);
app.use(rutasAsesor);
app.use(rutasPagos);
app.use(rutasExtractosVoz);

/**
 * Señal de vida del servicio, y si hay un modelo detrás.
 *
 * Sin autenticación a propósito: es lo que pinga el keep-alive para que el plan
 * gratuito de Render no duerma el servicio, y no revela nada — solo dice si hay
 * alguna llave configurada, nunca cuál ni su valor.
 *
 * No llama al modelo: mirar `process.env` cuesta cero y no gasta cuota, así que
 * el chat puede consultarlo al abrirse sin penalización.
 */
app.get('/api/salud', (_req, res) => {
  const proveedores = {
    groq: Boolean(process.env.GROQ_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
  };
  return res.status(200).json({
    ok: true,
    ia: Object.values(proveedores).some(Boolean),
    proveedores,
    // Diagnóstico seguro: confirma que Render puede escribir telemetría, sin
    // revelar URL, llaves ni ningún dato de Supabase.
    telemetriaPersistenteConfigurada: Boolean(
      urlSupabaseDelServidor(process.env)
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    version: process.env.npm_package_version || 'desconocida',
  });
});

// ----------------------------------------------------------------------
// RENDER STATICS (PRODUCCIÓN)
// ----------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));

// Express 5 upgraded to path-to-regexp v8, which REJECTS unnamed wildcards: the
// old '/ecosistema*' and '*' throw "Missing parameter name" at startup, taking
// the whole server down before it can listen. The replacement syntax is a named
// wildcard, and `{...}` makes the segment optional so one route still covers
// both the bare path and everything under it — '/ecosistema/*splat' alone would
// not match a plain '/ecosistema'.
const shellEcosistema = (_req: express.Request, res: express.Response) =>
  res.sendFile(path.join(__dirname, 'dist', 'ecosistema', 'index.html'));

app.get('/ecosistema{/*splat}', shellEcosistema);
app.get('/finanzas{/*splat}', shellEcosistema);
app.get('/superadmin{/*splat}', shellEcosistema);
app.get('/estadisticas{/*splat}', shellEcosistema);

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Servidor Web/API corriendo en el puerto ${PORT}`);
});
