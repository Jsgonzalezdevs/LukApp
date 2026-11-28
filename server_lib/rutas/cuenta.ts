/**
 * Rutas de la cuenta de cada persona: borrar la cuenta, contraseña, apodo,
 * último acceso, comprobantes por correo, avisos de racha y atajos de iPhone.
 */
import { Router } from 'express';
import { CUENTA_DEMO, clienteAdmin, contextoDe, exigirUsuario, rateLimiter, registrarAuditoria } from '../nucleo.ts';
import { type DestinoAviso, cronAutorizado, enviarAvisosRacha } from '../avisosRacha.ts';
import { esUltimoAdmin } from '../superadmin.ts';
import express from 'express';
import { generarLlave, hashLlave, idDesdeClaveIdempotencia, llaveDeCabecera, movimientoDesdeAtajo, normalizarNotificacionNequi, pistaDeLlave, seleccionarCuentaNequi, vistaPreviaDesdeAtajo } from '../atajos.ts';
import { randomUUID } from 'node:crypto';
import { validarApodo } from '../../src/lib/apodo.ts';
import { validarFirmaWebhookResend } from '../firmaWebhookResend.ts';

export const rutasCuenta = Router();

// ----------------------------------------------------------------------
// COMPROBANTES POR CORREO
// Cada usuario recibe un alias aleatorio; el webhook solo guarda metadatos y
// procedencia. Nunca convierte un adjunto en movimiento sin revisión humana.
// ----------------------------------------------------------------------
rutasCuenta.post('/api/comprobantes-correo/webhook', async (req, res) => {
  if (!validarFirmaWebhookResend({
    secreto: process.env.RESEND_WEBHOOK_SECRET,
    id: req.get('svix-id'),
    marcaTiempo: req.get('svix-timestamp'),
    firmas: req.get('svix-signature'),
    cuerpo: (req as express.Request & { rawBody?: Buffer }).rawBody,
  })) return res.status(401).json({ error: 'Firma de correo inválida.' });
  const evento = req.body as {
    type?: string;
    data?: { email_id?: string; message_id?: string; from?: string; to?: string[]; subject?: string;
      created_at?: string; attachments?: Array<{ id?: string; filename?: string; content_type?: string }> };
  };
  if (evento.type !== 'email.received') return res.status(200).json({ ok: true, ignorado: true });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(503).json({ error: 'Servicio de correo no disponible.' });
  const dato = evento.data;
  if (!dato?.email_id || !dato.message_id || !Array.isArray(dato.to)) return res.status(400).json({ error: 'El correo recibido está incompleto.' });
  const dominio = process.env.COMPROBANTES_EMAIL_DOMINIO?.trim().toLowerCase();
  if (!dominio) return res.status(503).json({ error: 'La recepción de comprobantes no está configurada.' });
  const destinos = dato.to.map((correo) => correo.trim().toLowerCase());
  const direccion = destinos.find((correo) => correo.endsWith(`@${dominio}`));
  const alias = direccion?.split('@')[0];
  if (alias && !/^[0-9a-f-]{36}$/.test(alias)) return res.status(200).json({ ok: true, ignorado: true });
  if (!alias) return res.status(200).json({ ok: true, ignorado: true });
  try {
    const { data: destino, error: errorDestino } = await cliente.from('comprobantes_correo_destinos')
      .select('user_id').eq('alias', alias).maybeSingle();
    if (errorDestino) throw errorDestino;
    if (!destino) return res.status(200).json({ ok: true, ignorado: true });
    const adjuntos = (dato.attachments ?? []).slice(0, 12).map((archivo) => ({
      id: String(archivo.id ?? '').slice(0, 120),
      nombre: String(archivo.filename ?? 'comprobante').replace(/[\\/\\\\\\x00-\\x1f]/g, '_').slice(0, 180),
      tipo: String(archivo.content_type ?? 'application/octet-stream').slice(0, 120),
    }));
    const { error } = await cliente.from('comprobantes_correo').upsert({
      user_id: destino.user_id,
      resend_email_id: dato.email_id,
      message_id: dato.message_id,
      remitente: String(dato.from ?? '').slice(0, 320),
      destinatario: direccion ?? '',
      asunto: String(dato.subject ?? '').slice(0, 300),
      recibido_en: dato.created_at ?? new Date().toISOString(),
      adjuntos,
    }, { onConflict: 'message_id', ignoreDuplicates: true });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[comprobantes-correo] No se pudo registrar el correo:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'No se pudo registrar el comprobante.' });
  }
});

rutasCuenta.get('/api/comprobantes-correo/destino', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Inicia sesión para consultar tu correo de comprobantes.' });
  const dominio = process.env.COMPROBANTES_EMAIL_DOMINIO?.trim().toLowerCase();
  if (!dominio) return res.status(503).json({ error: 'La recepción por correo todavía no está configurada.' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(503).json({ error: 'Servicio de correo no disponible.' });
  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const { data, error } = await cliente.from('comprobantes_correo_destinos')
      .upsert({ user_id: acceso.userId }, { onConflict: 'user_id' })
      .select('alias').single();
    if (error) throw error;
    return res.json({ direccion: `${data.alias}@${dominio}` });
  } catch (error) {
    console.error('[comprobantes-correo] No se pudo crear el destino:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'No se pudo preparar tu dirección de comprobantes.' });
  }
});

rutasCuenta.get('/api/comprobantes-correo/:id/adjunto/:adjuntoId', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Inicia sesión para abrir el adjunto.' });
  const llaveCorreo = process.env.RESEND_API_KEY;
  if (!llaveCorreo) return res.status(503).json({ error: 'La descarga de adjuntos no está configurada.' });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !/^[0-9a-f-]{36}$/i.test(req.params.adjuntoId)) {
    return res.status(400).json({ error: 'El adjunto no es válido.' });
  }
  const cliente = clienteAdmin();
  if (!cliente) return res.status(503).json({ error: 'Servicio de correo no disponible.' });
  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const { data: comprobante, error: errorComprobante } = await cliente.from('comprobantes_correo')
      .select('resend_email_id,adjuntos').eq('id', req.params.id).eq('user_id', acceso.userId).maybeSingle();
    if (errorComprobante) throw errorComprobante;
    if (!comprobante) return res.status(404).json({ error: 'No encontramos ese comprobante en tu cuenta.' });
    const adjuntos = Array.isArray(comprobante.adjuntos) ? comprobante.adjuntos as Array<{ id?: string }> : [];
    if (!adjuntos.some((archivo) => archivo.id === req.params.adjuntoId)) {
      return res.status(404).json({ error: 'Ese archivo no pertenece al comprobante.' });
    }
    const respuesta = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(comprobante.resend_email_id)}/attachments`, {
      headers: { authorization: `Bearer ${llaveCorreo}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) throw new Error(`Resend respondió ${respuesta.status} al buscar el adjunto.`);
    const resultado = await respuesta.json() as { data?: Array<{ id?: string; filename?: string; content_type?: string; size?: number; download_url?: string; expires_at?: string }> };
    const archivo = resultado.data?.find((candidato) => candidato.id === req.params.adjuntoId);
    if (!archivo?.download_url || !archivo.expires_at) return res.status(404).json({ error: 'El archivo ya no está disponible para descargar.' });
    if (!/\.(pdf|jpe?g|png|webp|tiff?|csv|xlsx)$/i.test(archivo.filename ?? '')) {
      return res.status(415).json({ error: 'Este archivo no es compatible con el importador de LukApp.' });
    }
    if (Number(archivo.size) > 4 * 1024 * 1024) return res.status(413).json({ error: 'El adjunto supera el límite de 4 MB del importador.' });
    const url = new URL(archivo.download_url);
    if (url.protocol !== 'https:' || url.hostname !== 'inbound-cdn.resend.com') {
      return res.status(502).json({ error: 'El enlace seguro del adjunto no es válido.' });
    }
    return res.json({ url: url.toString(), nombre: String(archivo.filename ?? 'comprobante').slice(0, 180), vence: archivo.expires_at });
  } catch (error) {
    console.error('[comprobantes-correo] No se pudo preparar el adjunto:', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'No se pudo preparar la descarga del comprobante.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Registrar apertura de LukApp
// Solo escribe la fila ligada al token recibido; el id nunca viene del cliente
// ni se puede sustituir por el de otra persona.
// ----------------------------------------------------------------------
rutasCuenta.post('/api/registrar-ultimo-acceso', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { error } = await cliente
      .from('perfiles')
      .update({ ultimo_acceso_app_at: new Date().toISOString() })
      .eq('id', acceso.userId);
    // Si la migración todavía no llegó a producción no devolvemos 500: la
    // apertura de finanzas sigue funcionando y el panel usa Auth como respaldo.
    if (error?.code === '42703') return res.status(204).end();
    if (error) throw error;
    return res.status(204).end();
  } catch (error: any) {
    console.warn('No se pudo registrar el último acceso:', error.message || error);
    return res.status(500).json({ error: 'No se pudo registrar el último acceso.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Aviso push antes de perder la racha
// Lo dispara un cron externo (Render Cron Job, cron-job.org...) hacia las
// 7 pm de Bogotá con el secreto en `x-cron-secret`. La función SQL decide a
// quién avisar y marca el aviso del día, así que llamarlo dos veces no
// duplica notificaciones.
// ----------------------------------------------------------------------
rutasCuenta.post('/api/racha/avisos', async (req, res) => {
  if (!cronAutorizado(req.headers['x-cron-secret'], process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const llavePrivada = process.env.VAPID_PRIVATE_KEY?.trim();
  const llavePublica = process.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!llavePrivada || !llavePublica) {
    return res.status(500).json({ error: 'Faltan las llaves VAPID para enviar notificaciones.' });
  }
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });

  try {
    // El nombre va en una variable para que TypeScript no exija los tipos de un
    // paquete que solo este endpoint usa.
    const nombreModulo = 'web-push';
    const webpush = (await import(nombreModulo)).default as {
      setVapidDetails: (asunto: string, publica: string, privada: string) => void;
      sendNotification: (suscripcion: unknown, carga: string) => Promise<unknown>;
    };
    webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:soporte@lukapp.app', llavePublica, llavePrivada);

    const { data, error } = await cliente.rpc('usuarios_racha_en_riesgo');
    if (error) throw error;
    const destinos = (data ?? []) as DestinoAviso[];

    const resultado = await enviarAvisosRacha(
      destinos,
      async (destino, carga) => { await webpush.sendNotification(destino.suscripcion, JSON.stringify(carga)); },
      async (destino) => {
        await cliente.from('suscripciones_push').delete().eq('user_id', destino.user_id).eq('endpoint', destino.endpoint);
      },
    );
    return res.json({ destinatarios: destinos.length, ...resultado });
  } catch (error: any) {
    console.error('No se pudieron enviar los avisos de racha:', error?.message || error);
    return res.status(500).json({ error: 'No se pudieron enviar los avisos de racha.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Eliminar Mi Propia Cuenta
//
// Distinto de /api/eliminar-usuario: ese es para que un admin borre a OTRO
// usuario y por diseño rechaza borrarse a sí mismo (motivoParaNoBorrar). Este
// es lo opuesto -- cualquiera con sesión puede borrar SU PROPIA cuenta, así
// que usa exigirUsuario y no exigirPermiso/exigirAdmin. La única guarda que
// sí se reusa es la de no dejar el sistema sin ningún administrador.
// ----------------------------------------------------------------------
rutasCuenta.post('/api/mi-cuenta/eliminar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    if (acceso.email.toLowerCase() === CUENTA_DEMO) {
      return res.status(403).json({ error: 'La cuenta de demostración no se puede eliminar.' });
    }

    const ctx = await contextoDe(cliente, acceso.userId);
    if (esUltimoAdmin(ctx)) {
      return res.status(400).json({
        error: 'Eres el único administrador. Asigna otro admin antes de eliminar tu cuenta.',
      });
    }

    // Borra la cuenta de auth; perfiles y el resto de tus datos se van solos
    // por `on delete cascade` contra auth.users.
    const { error } = await cliente.auth.admin.deleteUser(acceso.userId);
    if (error) throw error;

    await registrarAuditoria(cliente, acceso.email, 'Eliminó su propia cuenta', acceso.userId, undefined, acceso.userId);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando cuenta propia:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// La contraseña nunca llega a la API ni se almacena en el historial. El
// navegador la actualiza directamente con Supabase y esta ruta deja constancia
// del evento una vez que el cambio fue aceptado.
rutasCuenta.post('/api/mi-cuenta/contrasena-cambiada', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirUsuario(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  await registrarAuditoria(cliente, acceso.email, 'Cambió su contraseña', acceso.email, undefined, acceso.userId);
  return res.status(200).json({ success: true });
});

// El apodo se cambia aquí y no con un UPDATE desde el navegador: así pasan
// las reglas de validarApodo (nombres reservados incluidos) y queda auditado.
rutasCuenta.post('/api/mi-cuenta/apodo', rateLimiter(10, 60_000), async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Inicia sesión para cambiar tu nombre.' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(503).json({ error: 'No se pudo cambiar tu nombre. Inténtalo de nuevo.' });

  const acceso = await exigirUsuario(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const validacion = validarApodo(req.body?.apodo);
  if ('error' in validacion) return res.status(400).json({ error: validacion.error });
  const { apodo } = validacion;

  const { data: anterior } = await cliente.from('perfiles').select('usuario').eq('id', acceso.userId).maybeSingle();
  if (anterior?.usuario === apodo) return res.status(200).json({ ok: true, apodo });

  // El índice único es quien manda; esta consulta solo da un mensaje claro
  // antes de chocar. Se excluye a la persona para que pueda cambiar mayúsculas.
  const { data: ocupado } = await cliente
    .from('perfiles')
    .select('id')
    .ilike('usuario', apodo.replace(/[\\%_]/g, (caracter) => `\\${caracter}`))
    .neq('id', acceso.userId)
    .limit(1);
  if (ocupado && ocupado.length > 0) return res.status(409).json({ error: 'Ese nombre ya lo tiene otra persona. Prueba con otro.' });

  const { error } = await cliente.from('perfiles').update({ usuario: apodo }).eq('id', acceso.userId);
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ese nombre ya lo tiene otra persona. Prueba con otro.' });
    console.error('[apodo] No se pudo actualizar:', error.message);
    return res.status(500).json({ error: 'No se pudo cambiar tu nombre. Inténtalo de nuevo.' });
  }

  await registrarAuditoria(cliente, acceso.email, 'Cambió su nombre de usuario', acceso.email, `${anterior?.usuario ?? '(sin nombre)'} → ${apodo}`, acceso.userId);
  return res.status(200).json({ ok: true, apodo });
});

// ----------------------------------------------------------------------
// REGISTRO AUTOMÁTICO: llaves para que un Atajo de iOS anote un gasto solo.
//
// Dos familias de ruta muy distintas conviven aquí:
//
//   /api/atajos/llave*    — las administra el DUEÑO, con su sesión de Supabase
//                            de siempre (Authorization: Bearer <access_token>).
//   /api/atajo/movimiento — la llama el TELÉFONO, sin sesión: se autentica con
//                            la llave misma, que es su única credencial.
//
// Por eso este segundo grupo no pasa por `exigirUsuario`: no hay JWT de
// Supabase que exigir, la llave hace ese papel.
// ----------------------------------------------------------------------

rutasCuenta.post('/api/atajos/llave', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase en el servidor' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const etiqueta =
      typeof req.body?.etiqueta === 'string' && req.body.etiqueta.trim()
        ? req.body.etiqueta.trim().slice(0, 60)
        : 'Mi iPhone';

    const llave = generarLlave();
    const { error } = await cliente.from('llaves_atajo').insert({
      id: randomUUID(),
      user_id: acceso.userId,
      hash: hashLlave(llave),
      pista: pistaDeLlave(llave),
      etiqueta,
    });
    if (error) throw error;

    // Única vez que la llave existe en texto plano fuera de la memoria del
    // teléfono que la va a guardar: el servidor solo guardó su hash, así que
    // si esta respuesta se pierde, la única salida es revocar y crear otra.
    return res.status(200).json({ llave, pista: pistaDeLlave(llave), etiqueta });
  } catch (error: any) {
    console.error('Error creando llave de atajo:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

rutasCuenta.get('/api/atajos/llave', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase en el servidor' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { data, error } = await cliente
      .from('llaves_atajo')
      .select('id, pista, etiqueta, creada_en, usada_en, revocada_en')
      .eq('user_id', acceso.userId)
      .order('creada_en', { ascending: false });
    if (error) throw error;

    return res.status(200).json({ llaves: data ?? [] });
  } catch (error: any) {
    console.error('Error listando llaves de atajo:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

rutasCuenta.post('/api/atajos/revocar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase en el servidor' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    if (!id) return res.status(400).json({ error: 'Falta el id de la llave' });

    // El `eq('user_id', ...)` es lo que impide que alguien revoque la llave de
    // otro adivinando su id: sin sesión válida de ESE dueño, la fila no
    // aparece y no pasa nada, en vez de un error que confirme que el id existe.
    const { error } = await cliente
      .from('llaves_atajo')
      .update({ revocada_en: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', acceso.userId)
      .is('revocada_en', null);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error revocando llave de atajo:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

rutasCuenta.post('/api/atajo/movimiento', async (req, res) => {
  const llave =
    llaveDeCabecera(req.headers.authorization) ||
    llaveDeCabecera(req.headers['x-api-key'] as string | undefined);

  if (!llave) return res.status(401).json({ error: 'Falta la llave' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase en el servidor' });

  try {
    const { data: fila, error: errorLlave } = await cliente
      .from('llaves_atajo')
      .select('user_id, revocada_en')
      .eq('hash', hashLlave(llave))
      .single();

    // Mismo mensaje tanto si la llave no existe como si fue revocada: decir
    // "esta llave fue revocada" a quien no la tiene confirmaría que otra
    // llave, la que sí probó, existe de verdad.
    if (errorLlave || !fila || fila.revocada_en) {
      return res.status(401).json({ error: 'Llave inválida o revocada' });
    }

    let cuerpo = req.body ?? {};
    if (cuerpo.origen === 'nequi') {
      const idCliente = cuerpo.id ?? cuerpo.uuid ?? cuerpo.transaction_id;
      const idEstable = typeof idCliente === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idCliente);
      const claveIdempotencia = cuerpo.idempotency_key;
      if (claveIdempotencia !== undefined && (
        typeof claveIdempotencia !== 'string'
        || !claveIdempotencia.trim()
        || claveIdempotencia.length > 256
      )) {
        return res.status(400).json({ error: 'La clave de idempotencia debe ser texto de hasta 256 caracteres' });
      }
      const idConClave = !idCliente && typeof claveIdempotencia === 'string'
        && typeof cuerpo.notificacion === 'string'
        ? idDesdeClaveIdempotencia(fila.user_id, claveIdempotencia, cuerpo.notificacion)
        : null;
      const idempotente = idEstable || idConClave !== null;
      if (cuerpo.solo_prueba !== true && !idempotente) {
        return res.status(400).json({
          error: 'Antes de guardar, el Atajo debe enviar «id» o una «idempotency_key» estable y reutilizarla si reintenta el mismo aviso',
        });
      }

      const normalizacion = normalizarNotificacionNequi(
        idConClave ? { ...cuerpo, id: idConClave } : cuerpo,
      );
      if ('error' in normalizacion) return res.status(400).json({ error: normalizacion.error });
      cuerpo = { ...normalizacion.cuerpo, solo_prueba: cuerpo.solo_prueba, id_estable: idempotente };

      const { data: cuentas, error: errorCuentas } = await cliente
        .from('cajitas')
        .select('id, nombre, tipo, clase_cuenta, archived_at')
        .eq('user_id', fila.user_id)
        .eq('tipo', 'cuenta')
        .is('archived_at', null);
      if (errorCuentas) throw errorCuentas;

      const cuentaId = cuerpo.cuentaId;
      const cuenta = seleccionarCuentaNequi(cuentas ?? [], cuentaId);
      if (!cuenta) {
        return res.status(400).json({
          error: typeof cuentaId === 'string'
            ? 'La cuenta seleccionada no es una billetera Nequi activa de tu usuario'
            : 'Crea o selecciona una única cuenta activa tipo billetera cuyo nombre incluya Nequi',
        });
      }
      cuerpo = { ...cuerpo, cuenta_id: cuenta.id };
      if (cuerpo.solo_prueba === true) cuerpo.cuenta = cuenta.nombre;
    }

    if (cuerpo.solo_prueba === true) {
      const previa = vistaPreviaDesdeAtajo(cuerpo);
      if ('error' in previa) return res.status(400).json({ error: previa.error });
      return res.status(200).json({
        success: true,
        solo_prueba: true,
        idempotencia: cuerpo.id_estable === true,
        movimiento: { ...previa.vista, ...(typeof cuerpo.cuenta === 'string' ? { cuenta: cuerpo.cuenta } : {}) },
      });
    }

    const resultado = movimientoDesdeAtajo(cuerpo, fila.user_id);
    if ('error' in resultado) return res.status(400).json({ error: resultado.error });

    const { error: errorInsertar } = await cliente.from('transacciones').insert(resultado.fila);
    // Un choque de id primario es un reintento del propio Atajo repitiendo la
    // misma petición, no un fallo: el movimiento ya quedó guardado la primera
    // vez, así que se responde éxito en vez de un error que Atajos le mostraría
    // a la persona sin que haya nada roto de verdad.
    if (errorInsertar && !errorInsertar.message.includes('duplicate key')) {
      throw errorInsertar;
    }

    // Best-effort: si esto falla no se pierde el gasto, solo la fecha de "última
    // vez usada" que se enseña en el panel.
    void cliente
      .from('llaves_atajo')
      .update({ usada_en: new Date().toISOString() })
      .eq('hash', hashLlave(llave))
      .then(() => {});

    return res.status(201).json({ success: true, id: resultado.fila.id });
  } catch (error: any) {
    console.error('Error registrando movimiento de atajo:', error);
    return res.status(500).json({ error: 'No se pudo registrar el movimiento. Inténtalo de nuevo.' });
  }
});
