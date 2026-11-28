/**
 * Rutas del panel de superadmin: usuarios, roles, términos, solicitudes,
 * racha regalada, impersonación, auditoría y analítica de visitas.
 */
import { Router } from 'express';
import { type AuditLog, type ClienteAdmin, auditLogs, clienteAdmin, contextoDe, exigirAdmin, exigirGestionUsuarios, exigirPermiso, exigirUsuario, faltaTablaDocumentosLegales, fechaBogotaHoy, registrarAuditoria } from '../nucleo.ts';
import { type BonoRacha, calcularRacha, inicioDeRachaActual } from '../../src/features/lukapp/lib/racha.ts';
import { type CambiosUsuario, motivoParaNoBorrar, motivoParaRechazar } from '../superadmin.ts';
import { bogotaDate } from '../../src/features/lukapp/lib/localDate.ts';
import { validarContrasenaSegura } from '../../src/lib/seguridad.ts';

export const rutasSuperadmin = Router();

// ----------------------------------------------------------------------
// ENDPOINT: Crear Usuario (Superadmin)
// ----------------------------------------------------------------------
rutasSuperadmin.post('/api/crear-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'crear_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { email, password, usuario, rol } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }
    // Un rol delegado puede crear usuarios normales, pero solamente un
    // superadmin fijo puede crear o conceder acceso de administrador.
    if (rol === 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
    }

    // La excepción de complejidad es exclusiva de cuentas administradoras y
    // se decide en el servidor: un cliente manipulado no puede usarla para
    // debilitar la contraseña de una cuenta normal.
    if (rol !== 'admin') {
      const errorPassword = validarContrasenaSegura(password, [usuario, email]);
      if (errorPassword) return res.status(400).json({ error: errorPassword });
    }

    const { data: newUser, error: createError } = await cliente.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { usuario: usuario || '' }
    });

    if (createError) throw createError;

    if (rol === 'admin' && newUser.user) {
      const { error: perfilError } = await cliente
        .from('perfiles')
        .update({ rol: 'admin' })
        .eq('id', newUser.user.id);
      if (perfilError) {
        await cliente.auth.admin.deleteUser(newUser.user.id);
        throw perfilError;
      }
    }

    await registrarAuditoria(cliente,
      acceso.email || 'admin',
      'Creó usuario',
      email,
      `Usuario: ${usuario || '-'}, Rol: ${rol || 'usuario'}`,
      acceso.userId,
    );

    return res.status(200).json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Usuarios del Superadmin
// `last_sign_in_at` pertenece a Auth, no a perfiles. Se mezcla aquí con el
// cliente de service-role para mantener esa información fuera del navegador.
// ----------------------------------------------------------------------
rutasSuperadmin.get('/api/superadmin/usuarios', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const acceso = await exigirGestionUsuarios(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    let { data: perfiles, error: errorPerfiles } = await cliente
      .from('perfiles')
      .select('id, email, usuario, rol, rol_personalizado_id, created_at, ultimo_acceso_app_at')
      .order('created_at', { ascending: false });
    // Durante un despliegue la app puede llegar antes que la migración. No
    // ocultamos a todos los usuarios: volvemos temporalmente al dato de Auth.
    const migracionPendiente = errorPerfiles?.code === '42703';
    if (migracionPendiente) {
      const respaldo = await cliente
        .from('perfiles')
        .select('id, email, usuario, rol, rol_personalizado_id, created_at')
        .order('created_at', { ascending: false });
      perfiles = respaldo.data as typeof perfiles;
      errorPerfiles = respaldo.error;
    }
    if (errorPerfiles) throw errorPerfiles;

    // `listUsers` es paginado. Acortar a la primera página haría que el
    // último acceso desapareciera justamente cuando el proyecto crezca.
    const usuariosAuth = [] as Array<{ id: string; last_sign_in_at?: string | null }>;
    for (let pagina = 1; ; pagina += 1) {
      const resultado = await cliente.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (resultado.error) throw resultado.error;
      usuariosAuth.push(...resultado.data.users);
      if (resultado.data.users.length < 1000) break;
    }

    const ultimoAccesoPorId = new Map(
      usuariosAuth.map((usuario) => [usuario.id, usuario.last_sign_in_at ?? null]),
    );
    return res.status(200).json({
      usuarios: (perfiles ?? []).map((perfil) => ({
        ...perfil,
        // Las cuentas existentes conservan el último inicio de Auth hasta que
        // vuelvan a abrir LukApp y quede registrado su acceso real.
        ultimo_acceso_at: (!migracionPendiente ? perfil.ultimo_acceso_app_at : null) ?? ultimoAccesoPorId.get(perfil.id) ?? null,
      })),
    });
  } catch (error: any) {
    console.error('Error cargando usuarios del superadmin:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Analítica de tráfico (Superadmin)
// ----------------------------------------------------------------------
// La lectura pasa por el servidor, igual que los demás datos del superadmin.
// Así el navegador no queda atado a la caché del esquema de PostgREST ni a una
// política RLS que cambie mientras se despliega una migración.
export const RANGOS_ANALITICA = new Set([7, 30, 90]);
export const CAMPOS_VISITA_BASE = 'ruta,referente,pais,dispositivo,visitante,creado_en';
export const CAMPOS_VISITA_ENRIQUECIDOS = `${CAMPOS_VISITA_BASE},utm_source,utm_medium,utm_campaign,utm_content,idioma,sistema,navegador,pantalla,zona_horaria`;

export interface VisitaAnaliticaServidor {
  creado_en: string;
  visitante: string;
  [campo: string]: unknown;
}

rutasSuperadmin.get('/api/superadmin/visitas', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(503).json({ error: 'La analítica todavía no está configurada.' });

  const dias = typeof req.query.dias === 'string' ? Number(req.query.dias) : Number.NaN;
  if (!Number.isInteger(dias) || !RANGOS_ANALITICA.has(dias)) {
    return res.status(400).json({ error: 'El rango de analítica no es válido.' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'ver_visitantes');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const hoy = fechaBogotaHoy();
    const inicioRango = new Date(`${hoy}T00:00:00-05:00`);
    inicioRango.setUTCDate(inicioRango.getUTCDate() - (dias - 1));
    const desde = `${inicioRango.toISOString().slice(0, 10)}T00:00:00-05:00`;
    const inicioHoy = Date.parse(`${hoy}T00:00:00-05:00`);

    const consultaEnriquecida = await cliente
      .from('visitas')
      .select(CAMPOS_VISITA_ENRIQUECIDOS)
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false });
    let error = consultaEnriquecida.error;
    let visitas = (consultaEnriquecida.data ?? []) as VisitaAnaliticaServidor[];

    // Las columnas de contexto son opcionales. Si un despliegue de la app
    // llega antes que su migración, el tráfico base sigue siendo útil y no se
    // convierte en ceros silenciosos para quien administra el portafolio.
    if (error?.code === '42703' || error?.code === 'PGRST204') {
      const consultaBase = await cliente
        .from('visitas')
        .select(CAMPOS_VISITA_BASE)
        .gte('creado_en', desde)
        .order('creado_en', { ascending: false });
      error = consultaBase.error;
      visitas = (consultaBase.data ?? []) as VisitaAnaliticaServidor[];
    }
    if (error) throw error;

    const visitasDeHoy = visitas.filter((visita) => Date.parse(visita.creado_en) >= inicioHoy);

    return res.status(200).json({
      visitas,
      hoy: {
        fecha: hoy,
        visitas_hoy: visitasDeHoy.length,
        unicos_hoy: new Set(visitasDeHoy.map((visita) => visita.visitante)).size,
      },
    });
  } catch (error) {
    console.error('Error cargando analítica de tráfico:', error);
    return res.status(500).json({ error: 'No se pudo cargar la analítica de tráfico.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Editar Usuario (Superadmin)
// ----------------------------------------------------------------------
rutasSuperadmin.post('/api/editar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'editar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId, email, usuario, password, rol, rolPersonalizadoId } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el usuario a editar.' });
    }

    // Solo se manda a la guarda lo que de verdad viene: no tocar un campo es
    // distinto de vaciarlo, y las reglas dependen de esa diferencia.
    const cambios: CambiosUsuario = {};
    if (typeof email === 'string') cambios.email = email;
    if (typeof usuario === 'string') cambios.usuario = usuario;
    if (typeof password === 'string') cambios.password = password;
    if (rol === 'admin' || rol === 'usuario') cambios.rol = rol;
    // null quita el rol personalizado asignado; string lo cambia; ausente no
    // lo toca — la misma distinción que el resto de campos de arriba.
    if (rolPersonalizadoId === null || typeof rolPersonalizadoId === 'string') {
      cambios.rolPersonalizadoId = rolPersonalizadoId;
    }

    const ctx = await contextoDe(cliente, userId);
    if (!ctx.existe) return res.status(404).json({ error: 'Ese usuario ya no existe.' });

    // Las credenciales de la cuenta actual no se modifican desde este panel.
    // Así el único ajuste permitido sobre sí mismo es el rol, como se muestra
    // en la interfaz de Superadmin.
    if (acceso.userId === userId && (
      cambios.email !== undefined ||
      cambios.usuario !== undefined ||
      cambios.password !== undefined ||
      cambios.rolPersonalizadoId !== undefined
    )) {
      return res.status(403).json({ error: 'Tu propia cuenta solo puede cambiar de rol desde Superadmin.' });
    }

    const motivo = motivoParaRechazar(cambios, {
      editorId: acceso.userId,
      objetivoId: userId,
      objetivoRol: ctx.objetivoRol,
      totalAdmins: ctx.totalAdmins,
    });
    if (motivo) return res.status(400).json({ error: motivo });

    const rolFinal = cambios.rol ?? ctx.objetivoRol;
    const errorPassword = cambios.password === undefined || rolFinal === 'admin'
      ? null
      : validarContrasenaSegura(cambios.password, [cambios.usuario ?? ctx.objetivoUsuario, cambios.email ?? ctx.objetivoEmail]);
    if (errorPassword) return res.status(400).json({ error: errorPassword });

    // Ningún permiso delegado puede modificar una cuenta superadmin ni
    // conceder o retirar ese acceso: ambos cambios requieren un superadmin fijo.
    if (ctx.objetivoRol === 'admin' || cambios.rol === 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
    }

    // El correo y la contraseña viven en auth; el usuario, el correo y el rol
    // se reflejan en `perfiles`, que es lo que lee el panel. El usuario va a la
    // metadata de auth además, para que el trigger de alta no lo pierda.
    const authUpdate: Record<string, unknown> = {};
    if (cambios.email !== undefined) authUpdate.email = cambios.email;
    if (cambios.password !== undefined) authUpdate.password = cambios.password;
    if (cambios.usuario !== undefined) authUpdate.user_metadata = { usuario: cambios.usuario };

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await cliente.auth.admin.updateUserById(userId, authUpdate);
      if (error) throw error;
    }

    const perfilUpdate: Record<string, unknown> = {};
    if (cambios.usuario !== undefined) perfilUpdate.usuario = cambios.usuario.trim();
    if (cambios.email !== undefined) perfilUpdate.email = cambios.email;
    if (cambios.rol !== undefined) perfilUpdate.rol = cambios.rol;
    if (cambios.rolPersonalizadoId !== undefined) perfilUpdate.rol_personalizado_id = cambios.rolPersonalizadoId;

    if (Object.keys(perfilUpdate).length > 0) {
      const { error } = await cliente.from('perfiles').update(perfilUpdate).eq('id', userId);
      if (error) {
        // Un usuario repetido choca contra el índice único; un rol
        // personalizado inexistente choca contra la referencia — los dos se
        // traducen a un mensaje que se entiende, no al error crudo de Postgres.
        const dup = error.code === '23505';
        const rolInexistente = error.code === '23503';
        return res.status(dup || rolInexistente ? 409 : 500).json({
          error: dup
            ? 'Ese nombre de usuario ya está tomado.'
            : rolInexistente
              ? 'Ese rol personalizado ya no existe.'
              : error.message,
        });
      }
    }

    await registrarAuditoria(cliente,
      acceso.email,
      cambios.rol === 'admin' && ctx.objetivoRol !== 'admin'
        ? 'Otorgó rol de administrador'
        : 'Editó usuario',
      cambios.email || userId,
      Object.keys(cambios).join(', '),
      acceso.userId,
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error editando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINTS: Términos y condiciones administrables
// ----------------------------------------------------------------------
rutasSuperadmin.get('/api/legal/terminos', async (_req, res) => {
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase.' });
  try {
    const { data, error } = await cliente
      .from('documentos_legales')
      .select('contenido, actualizado_en')
      .eq('clave', 'terminos_y_condiciones')
      .maybeSingle();
    if (error && !faltaTablaDocumentosLegales(error)) throw error;
    res.set('Cache-Control', 'no-store, max-age=0');
    return res.json({ contenido: data?.contenido ?? null, actualizadoEn: data?.actualizado_en ?? null, migracionPendiente: Boolean(error) });
  } catch (error: any) {
    console.error('Error leyendo términos y condiciones:', error);
    return res.status(500).json({ error: 'No se pudieron cargar los términos y condiciones.' });
  }
});

rutasSuperadmin.get('/api/superadmin/legal/terminos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase.' });
  try {
    const admin = await exigirAdmin(cliente, token);
    if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
    const { data, error } = await cliente
      .from('documentos_legales')
      .select('contenido, actualizado_en')
      .eq('clave', 'terminos_y_condiciones')
      .maybeSingle();
    if (error && !faltaTablaDocumentosLegales(error)) throw error;
    return res.json({ contenido: data?.contenido ?? null, actualizadoEn: data?.actualizado_en ?? null, migracionPendiente: Boolean(error) });
  } catch (error: any) {
    console.error('Error cargando términos para superadmin:', error);
    return res.status(500).json({ error: 'No se pudieron cargar los términos y condiciones.' });
  }
});

rutasSuperadmin.put('/api/superadmin/legal/terminos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase.' });
  try {
    const admin = await exigirAdmin(cliente, token);
    if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
    const contenido = typeof req.body?.contenido === 'string' ? req.body.contenido.trim() : '';
    if (contenido.length < 80) return res.status(400).json({ error: 'Escribe al menos 80 caracteres para publicar los términos.' });
    if (contenido.length > 120000) return res.status(400).json({ error: 'Los términos superan el límite de 120.000 caracteres.' });

    const actualizadoEn = new Date().toISOString();
    const { data, error } = await cliente
      .from('documentos_legales')
      .upsert({
        clave: 'terminos_y_condiciones',
        contenido,
        actualizado_en: actualizadoEn,
        actualizado_por: admin.userId,
      }, { onConflict: 'clave' })
      .select('contenido, actualizado_en')
      .single();
    if (error && faltaTablaDocumentosLegales(error)) {
      return res.status(503).json({ error: 'Falta aplicar la migración de términos y condiciones en Supabase antes de publicar.' });
    }
    if (error) throw error;
    await registrarAuditoria(cliente, admin.email, 'Actualizó términos y condiciones', undefined, `${contenido.length} caracteres`, admin.userId);
    return res.json({ success: true, contenido: data.contenido, actualizadoEn: data.actualizado_en });
  } catch (error: any) {
    console.error('Error publicando términos y condiciones:', error);
    return res.status(500).json({ error: 'No se pudieron publicar los términos y condiciones.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINTS: historial del flujo anterior de aprobación cruzada.
// No se crean solicitudes nuevas: una asignación hecha por un superadmin se
// aplica directamente en /api/editar-usuario.
// ----------------------------------------------------------------------
rutasSuperadmin.get('/api/solicitudes-superadmin', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase.' });
  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const { data, error } = await cliente
      .from('solicitudes_superadmin')
      .select('id, objetivo_id, solicitada_por, creada_en')
      .eq('estado', 'pendiente')
      .order('creada_en', { ascending: true });
    if (error) throw error;
    const ids = [...new Set((data ?? []).flatMap((s) => [s.objetivo_id, s.solicitada_por]))];
    const { data: perfiles, error: errorPerfiles } = await cliente
      .from('perfiles').select('id, email, usuario').in('id', ids);
    if (errorPerfiles) throw errorPerfiles;
    const porId = new Map((perfiles ?? []).map((p) => [p.id, p]));
    return res.json({ solicitudes: (data ?? []).map((s) => ({
      id: s.id, creadaEn: s.creada_en,
      objetivo: porId.get(s.objetivo_id), solicitante: porId.get(s.solicitada_por),
    })) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'No se pudieron cargar las solicitudes.' });
  }
});

rutasSuperadmin.post('/api/solicitudes-superadmin/:id/aprobar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar Supabase.' });
  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const { error } = await cliente.rpc('aprobar_solicitud_superadmin', {
      p_solicitud_id: req.params.id, p_aprobador_id: acceso.userId,
    });
    if (error) return res.status(409).json({ error: error.message });
    await registrarAuditoria(cliente, acceso.email, 'Aprobó nuevo superadmin', req.params.id, undefined, acceso.userId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'No se pudo aprobar la solicitud.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Racha regalada (Superadmin)
// La racha sale de los días con movimientos; el equipo puede sumar días sin
// tocar el libro de la persona. Se calcula aquí para que el panel muestre el
// número real sin necesitar acceso a las finanzas de nadie.
// ----------------------------------------------------------------------
export const MAX_DIAS_RACHA_POR_VEZ = 365;

export const leerRachaDe = async (cliente: ClienteAdmin, userId: string) => {
  const fechasMovimientos: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await cliente
      .from('transacciones')
      .select('occurred_on')
      .eq('user_id', userId)
      .order('occurred_on', { ascending: false })
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer los movimientos: ${error.message}`);
    fechasMovimientos.push(...(data ?? []).map((f) => String(f.occurred_on)));
    if (!data || data.length < 1000) break;
  }

  const { data: filasBonos, error: errorBonos } = await cliente
    .from('racha_bonos')
    .select('inicio_racha, dias')
    .eq('user_id', userId);
  if (errorBonos) throw new Error(`No se pudieron leer los días regalados: ${errorBonos.message}`);
  const bonos: BonoRacha[] = (filasBonos ?? []).map((f) => ({ inicioRacha: String(f.inicio_racha), dias: Number(f.dias) }));

  // Los días salvados con protector cuentan igual que en la app. Sin ellos,
  // el panel mostraba otra racha y, peor, pegaba el regalo a un inicio que la
  // app no reconoce: los días sumados nunca le aparecían a la persona.
  const { data: filasProtegidos, error: errorProtegidos } = await cliente
    .from('racha_dias_protegidos')
    .select('dia')
    .eq('user_id', userId);
  if (errorProtegidos) throw new Error(`No se pudieron leer los días protegidos: ${errorProtegidos.message}`);
  const hoy = bogotaDate();
  const diasProtegidos = (filasProtegidos ?? []).map((f) => String(f.dia)).filter((d) => d <= hoy);

  const movimientos = [...new Set(fechasMovimientos)].map((occurredOn) => ({ occurredOn }));
  const info = calcularRacha(movimientos, hoy, bonos, diasProtegidos);
  const inicio = inicioDeRachaActual([...fechasMovimientos, ...diasProtegidos], hoy);
  // Solo lo regalado a la racha de ahora: un bono de una racha que ya se
  // cortó no está sumando nada y confundiría al leer el panel.
  const diasRegalados = bonos.filter((b) => b.inicioRacha === inicio).reduce((t, b) => t + b.dias, 0);
  return { hoy, info, inicio, diasRegalados };
};

export const resumenRacha = (r: Awaited<ReturnType<typeof leerRachaDe>>) => ({
  rachaActual: r.info.rachaActual,
  rachaMaxima: r.info.rachaMaxima,
  anotadoHoy: r.info.anotadoHoy,
  diasRegalados: r.diasRegalados,
});

rutasSuperadmin.get('/api/superadmin/racha', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const acceso = await exigirPermiso(cliente, token, 'editar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    if (!userId) return res.status(400).json({ error: 'Falta el usuario.' });

    return res.status(200).json(resumenRacha(await leerRachaDe(cliente, userId)));
  } catch (error: any) {
    console.error('Error leyendo la racha:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

rutasSuperadmin.post('/api/superadmin/racha', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const acceso = await exigirPermiso(cliente, token, 'editar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId, accion, dias } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el usuario.' });
    }

    const ctx = await contextoDe(cliente, userId);
    if (!ctx.existe) return res.status(404).json({ error: 'Ese usuario ya no existe.' });

    if (accion === 'quitar') {
      const { error } = await cliente.from('racha_bonos').delete().eq('user_id', userId);
      if (error) throw error;
      await registrarAuditoria(cliente, acceso.email, 'Quitó los días de racha regalados', ctx.objetivoEmail || userId, undefined, acceso.userId);
      return res.status(200).json(resumenRacha(await leerRachaDe(cliente, userId)));
    }

    if (accion !== 'sumar' || !Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_RACHA_POR_VEZ) {
      return res.status(400).json({ error: `Escribe cuántos días sumar, de 1 a ${MAX_DIAS_RACHA_POR_VEZ}.` });
    }

    const antes = await leerRachaDe(cliente, userId);
    const { error } = await cliente.from('racha_bonos').insert({
      user_id: userId,
      inicio_racha: antes.inicio,
      dias,
      otorgado_por: acceso.userId,
    });
    if (error) throw error;

    const despues = await leerRachaDe(cliente, userId);
    await registrarAuditoria(cliente,
      acceso.email,
      'Sumó días de racha',
      ctx.objetivoEmail || userId,
      `+${dias} días (racha ${antes.info.rachaActual} → ${despues.info.rachaActual})`,
      acceso.userId,
    );
    return res.status(200).json(resumenRacha(despues));
  } catch (error: any) {
    console.error('Error sumando racha:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Eliminar Usuario (Superadmin)
// ----------------------------------------------------------------------
rutasSuperadmin.post('/api/eliminar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'eliminar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el usuario a eliminar.' });
    }

    const ctx = await contextoDe(cliente, userId);
    if (!ctx.existe) return res.status(404).json({ error: 'Ese usuario ya no existe.' });

    const motivo = motivoParaNoBorrar({
      editorId: acceso.userId,
      objetivoId: userId,
      objetivoRol: ctx.objetivoRol,
      totalAdmins: ctx.totalAdmins,
    });
    if (motivo) return res.status(400).json({ error: motivo });

    // Un permiso delegado no puede borrar a un superadmin: solo el admin fijo.
    if (ctx.objetivoRol === 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) {
        return res.status(403).json({ error: 'Solo un superadmin puede eliminar a otro superadmin.' });
      }
    }

    // Borra la cuenta de auth; la fila de `perfiles` se va sola por la llave
    // foránea con `on delete cascade` contra auth.users.
    const { error } = await cliente.auth.admin.deleteUser(userId);
    if (error) throw error;

    await registrarAuditoria(cliente,
      acceso.email,
      'Eliminó usuario',
      userId,
      `Rol: ${ctx.objetivoRol}`,
      acceso.userId,
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Impersonar Usuario (Superadmin)
// Usa auth.admin.generateLink para obtener un token_hash. El frontend lo
// intercambia via supabase.auth.verifyOtp() — llamada pura a la API de
// Supabase, sin abrir ninguna URL ni redirigir al localhost.
// ----------------------------------------------------------------------
rutasSuperadmin.post('/api/impersonar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'impersonar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el userId del usuario a impersonar.' });
    }

    if (userId === acceso.userId) {
      return res.status(400).json({ error: 'No puedes impersonarte a ti mismo.' });
    }

    // Un permiso delegado no puede asumir la sesión de un superadmin: eso le
    // daría todo lo que el superadmin puede hacer, incluido borrar cuentas.
    const objetivo = await contextoDe(cliente, userId);
    if (objetivo.objetivoRol === 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) {
        return res.status(403).json({ error: 'Solo un superadmin puede asumir la cuenta de otro superadmin.' });
      }
    }

    // Obtener datos del usuario objetivo
    const { data: userTarget, error: getUserError } = await cliente.auth.admin.getUserById(userId);
    if (getUserError || !userTarget.user) {
      return res.status(404).json({ error: 'El usuario objetivo no existe.' });
    }

    // Generar magic link para obtener el token_hash.
    const { data: linkData, error: linkError } = await cliente.auth.admin.generateLink({
      type: 'magiclink',
      email: userTarget.user.email!,
    });

    if (linkError || !linkData?.properties?.action_link) {
      return res.status(500).json({ error: linkError?.message || 'No se pudo generar el token de acceso.' });
    }

    const tokenHash = linkData.properties.hashed_token
      || (() => {
          const u = new URL(linkData.properties.action_link);
          return u.searchParams.get('token');
        })();

    if (!tokenHash) {
      return res.status(500).json({ error: 'No se pudo extraer el token del link generado.' });
    }

    await registrarAuditoria(cliente,
      acceso.email,
      'Inició sesión de asesoría (Impersonación)',
      userTarget.user.email,
      `ID: ${userId}`,
      acceso.userId,
    );

    return res.status(200).json({
      success: true,
      tokenHash,
      email: userTarget.user.email,
      usuario: userTarget.user.user_metadata?.usuario || userTarget.user.email,
    });
  } catch (error: any) {
    console.error('Error impersonando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Obtener Logs de Auditoría (Superadmin)
// ----------------------------------------------------------------------
rutasSuperadmin.get('/api/auditoria-logs', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirPermiso(cliente, token, 'ver_auditoria');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { data, error } = await cliente
    .from('registro_auditoria')
    .select('id, creado_en, actor_email, accion, objetivo, detalle')
    .order('creado_en', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[auditoria] No se pudo leer el historial persistente:', error.message);
    return res.status(200).json({ success: true, logs: auditLogs, persistente: false });
  }
  const logs: AuditLog[] = (data ?? []).map((registro) => ({
    id: registro.id,
    timestamp: registro.creado_en,
    adminEmail: registro.actor_email,
    action: registro.accion,
    targetUser: registro.objetivo ?? undefined,
    details: registro.detalle ?? undefined,
  }));
  return res.status(200).json({ success: true, logs, persistente: true });
});

// ----------------------------------------------------------------------
// ROLES PERSONALIZADOS
//
// Gestionar el catálogo de roles es admin-only puro (exigirAdmin, no
// exigirPermiso): si se delegara con un permiso, alguien con `editar_usuario`
// podría crearse un rol con todo marcado y auto-asignárselo, escalando sus
// propios privilegios. Solo /api/mis-permisos usa exigirUsuario, porque ahí
// cada quien solo puede leer lo suyo.
// ----------------------------------------------------------------------

rutasSuperadmin.get('/api/roles', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const [{ data: roles, error: errRoles }, { data: permisos, error: errPermisos }] = await Promise.all([
    cliente.from('roles').select('id, nombre, descripcion, permisos_por_rol(permiso)').order('nombre'),
    cliente.from('permisos').select('clave, descripcion').order('clave'),
  ]);
  if (errRoles) return res.status(500).json({ error: errRoles.message });
  if (errPermisos) return res.status(500).json({ error: errPermisos.message });

  return res.status(200).json({
    success: true,
    roles: (roles ?? []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: (r.permisos_por_rol ?? []).map((p: any) => p.permiso),
    })),
    catalogoPermisos: permisos ?? [],
  });
});

rutasSuperadmin.post('/api/crear-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { nombre, descripcion, permisos } = req.body ?? {};
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    return res.status(400).json({ error: 'El rol necesita un nombre.' });
  }
  const permisosLimpios: string[] = Array.isArray(permisos) ? permisos.filter((p) => typeof p === 'string') : [];

  const id = `rol-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { error: errCrear } = await cliente
    .from('roles')
    .insert({ id, nombre: nombre.trim(), descripcion: typeof descripcion === 'string' ? descripcion : null });
  if (errCrear) {
    const dup = errCrear.code === '23505';
    return res.status(dup ? 409 : 500).json({ error: dup ? 'Ya existe un rol con ese nombre.' : errCrear.message });
  }

  if (permisosLimpios.length > 0) {
    const { error: errPermisos } = await cliente
      .from('permisos_por_rol')
      .insert(permisosLimpios.map((permiso) => ({ rol_id: id, permiso })));
    if (errPermisos) return res.status(500).json({ error: errPermisos.message });
  }

  await registrarAuditoria(cliente, acceso.email, 'Creó rol', nombre, `Permisos: ${permisosLimpios.join(', ') || 'ninguno'}`, acceso.userId);
  return res.status(200).json({ success: true, id });
});

rutasSuperadmin.post('/api/editar-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { id, nombre, descripcion, permisos } = req.body ?? {};
  if (typeof id !== 'string' || id === '') return res.status(400).json({ error: 'Falta el rol a editar.' });

  const cambiosRol: Record<string, unknown> = {};
  if (typeof nombre === 'string' && nombre.trim() !== '') cambiosRol.nombre = nombre.trim();
  if (typeof descripcion === 'string' || descripcion === null) cambiosRol.descripcion = descripcion;

  if (Object.keys(cambiosRol).length > 0) {
    const { error } = await cliente.from('roles').update(cambiosRol).eq('id', id);
    if (error) {
      const dup = error.code === '23505';
      return res.status(dup ? 409 : 500).json({ error: dup ? 'Ya existe un rol con ese nombre.' : error.message });
    }
  }

  // Los permisos se reemplazan enteros cuando vienen en el body: borrar todo
  // y volver a insertar es más simple y menos propenso a errores que calcular
  // el diff entre lo que había y lo que se marcó ahora.
  if (Array.isArray(permisos)) {
    const permisosLimpios: string[] = permisos.filter((p) => typeof p === 'string');
    const { error: errBorrar } = await cliente.from('permisos_por_rol').delete().eq('rol_id', id);
    if (errBorrar) return res.status(500).json({ error: errBorrar.message });

    if (permisosLimpios.length > 0) {
      const { error: errInsertar } = await cliente
        .from('permisos_por_rol')
        .insert(permisosLimpios.map((permiso) => ({ rol_id: id, permiso })));
      if (errInsertar) return res.status(500).json({ error: errInsertar.message });
    }
  }

  await registrarAuditoria(cliente, acceso.email, 'Editó rol', nombre || id, undefined, acceso.userId);
  return res.status(200).json({ success: true });
});

rutasSuperadmin.post('/api/eliminar-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { id } = req.body ?? {};
  if (typeof id !== 'string' || id === '') return res.status(400).json({ error: 'Falta el rol a eliminar.' });

  // Quien lo tuviera asignado queda sin rol personalizado (on delete set null
  // en perfiles.rol_personalizado_id) -- vuelve a comportarse como 'usuario'
  // sin ningún permiso, no como si el borrado fallara a medias.
  const { error } = await cliente.from('roles').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  await registrarAuditoria(cliente, acceso.email, 'Eliminó rol', id, undefined, acceso.userId);
  return res.status(200).json({ success: true });
});

/**
 * Los permisos efectivos del que llama, para que el frontend sepa qué
 * mostrar. 'admin' no necesita listar sus permisos uno por uno -- el
 * frontend ya lo trata aparte -- así que viaja con `permisos: []` y `rol:
 * 'admin'` alcanza para que sepa que puede todo.
 *
 * Sin este endpoint, la única forma de que alguien con un rol personalizado
 * viera sus propios permisos sería abrir RLS de lectura en permisos_por_rol a
 * cualquier autenticado -- y con eso cualquiera podría listar el catálogo
 * entero de roles del sistema. El cliente de service-role evita ese trueque.
 */
rutasSuperadmin.get('/api/mis-permisos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const quien = await exigirUsuario(cliente, token);
  if ('error' in quien) return res.status(quien.status).json({ error: quien.error });

  const { data: perfil, error: errorPerfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', quien.userId)
    .maybeSingle();

  if (errorPerfil) return res.status(503).json({ error: 'No se pudo cargar esta pantalla. Inténtalo de nuevo.' });

  const rol = perfil?.rol === 'admin' ? 'admin' : 'usuario';
  let permisos: string[] = [];

  if (rol !== 'admin' && perfil?.rol_personalizado_id) {
    const { data, error } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id);
    if (error) return res.status(503).json({ error: 'No se pudo cargar esta pantalla. Inténtalo de nuevo.' });
    permisos = (data ?? []).map((p) => p.permiso);
  }

  return res.status(200).json({ rol, permisos });
});
