/**
 * Piezas que comparten todas las rutas de la API: el cliente de Supabase con
 * service_role, las guardas de sesión y permisos, la auditoría y el limitador.
 * No registra rutas: cada tema de la API vive en server_lib/rutas/.
 */
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import { urlSupabaseDelServidor } from './configuracionSupabase.ts';

export const MAX_BYTES_AUDIO = 8 * 1024 * 1024; // 8 MB

// ----------------------------------------------------------------------
// SEGURIDAD: Rate Limiter en Memoria para APIs
// ----------------------------------------------------------------------
export const rateLimiter = (maxPeticiones = 120, ventanaMs = 60000) => {
  // Cada middleware conserva su propio contador. Compartir el mapa hacía que
  // salud, memoria y el límite específico del asesor se sumaran entre sí.
  const peticionesPorIp = new Map<string, { count: number; resetTime: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ahora = Date.now();
  const registro = peticionesPorIp.get(ip);

  if (!registro || ahora > registro.resetTime) {
    peticionesPorIp.set(ip, { count: 1, resetTime: ahora + ventanaMs });
    return next();
  }

  registro.count++;
  if (registro.count > maxPeticiones) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor espera un momento.' });
  }

  return next();
  };
};

// ----------------------------------------------------------------------
// AUDITORÍA: Registro de Actividad para Superadmin
// ----------------------------------------------------------------------
export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetUser?: string;
  details?: string;
}

export const auditLogs: AuditLog[] = [];

export const registrarAuditoria = async (
  cliente: ClienteAdmin,
  adminEmail: string,
  action: string,
  targetUser?: string,
  details?: string,
  actorId?: string,
) => {
  const registro: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    adminEmail,
    action,
    targetUser,
    details,
  };
  auditLogs.unshift(registro);
  if (auditLogs.length > 500) auditLogs.pop();

  const { error } = await cliente.from('registro_auditoria').insert({
    creado_en: registro.timestamp,
    actor_id: actorId ?? null,
    actor_email: adminEmail,
    accion: action,
    objetivo: targetUser ?? null,
    detalle: details ?? null,
  });
  if (error) console.error('[auditoria] No se pudo persistir el registro:', error.message);
};

// ----------------------------------------------------------------------
// Cliente admin + comprobación de que quien llama es administrador.
// ----------------------------------------------------------------------
export const clienteAdmin = () => {
  const supabaseUrl = urlSupabaseDelServidor(process.env);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export type ClienteAdmin = NonNullable<ReturnType<typeof clienteAdmin>>;

// Render puede desplegar el servidor antes de que Supabase ejecute la
// migración. En ese intervalo la lectura legal debe volver al texto incluido,
// no convertir la pantalla de Superadmin en un error 500.
export const faltaTablaDocumentosLegales = (error: { code?: string; message?: string } | null): boolean =>
  error?.code === '42P01'
  || error?.code === 'PGRST205'
  || /documentos_legales.*does not exist|could not find.*documentos_legales/i.test(error?.message ?? '');

/**
 * La API que puede consumir IA o procesar documentos es privada por defecto.
 * Un servidor sin Supabase no debe convertirse, por un error de despliegue, en
 * un proxy público de las llaves de IA. El modo local se habilita solo de forma
 * explícita y únicamente fuera de producción para pruebas manuales.
 */
export const sePermiteApiLocalSinSesion = (): boolean =>
  process.env.NODE_ENV !== 'production'
  && !process.env.RENDER
  && process.env.PERMITIR_API_SIN_SESION_EN_LOCAL === 'true';

export const exigirConfiguracionSegura = (
  cliente: ClienteAdmin | null,
  res: express.Response,
  servicio: string,
): boolean => {
  if (cliente || sePermiteApiLocalSinSesion()) return true;
  res.status(503).json({
    error: `${servicio} requiere que el servidor valide la sesión. Inténtalo de nuevo más tarde.`,
  });
  return false;
};

export const esRegistro = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

export const textoNoVacio = (valor: unknown, maximo = 200): string | null =>
  typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= maximo
    ? valor.trim()
    : null;

export const enteroPositivoSeguro = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null;

/**
 * Cuenta de demostración compartida (alias `demo` en el inicio de sesión). Su
 * contraseña la conocen muchas personas, así que no puede borrarse ni
 * convertirse en administradora desde la aplicación.
 */
export const CUENTA_DEMO = 'demofestech@lukapp.app';

/** El id y correo del que llama si es admin; si no, el estado y mensaje a devolver. */
export const exigirAdmin = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil, error: errorPerfil } = await cliente
    .from('perfiles')
    .select('rol')
    .eq('id', llamador.user.id)
    .maybeSingle();

  if (errorPerfil) return { status: 503, error: 'No se pudieron verificar los permisos.' };

  if (perfil?.rol !== 'admin') return { status: 403, error: 'No tienes permisos de administrador' };
  return { userId: llamador.user.id, email: llamador.user.email ?? '' };
};

/**
 * El id del que llama, si su sesión es de verdad.
 *
 * A diferencia de `exigirAdmin` no mira el rol: para hablar con el asesor basta
 * con haber iniciado sesión. Lo que cierra es que la ruta quede abierta a
 * cualquiera que sepa la URL — y detrás de esa ruta hay una llave de un modelo
 * con cuota, así que sin esta comprobación se la gasta un extraño.
 */
export const exigirUsuario = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };
  return { userId: llamador.user.id, email: llamador.user.email ?? '' };
};

/**
 * El id del que llama, si tiene el permiso pedido; si no, el estado y mensaje
 * a devolver.
 *
 * 'admin' pasa siempre sin consultar roles personalizados — la misma garantía
 * que `exigirAdmin`: el rol fijo nunca depende de que `permisos_por_rol` esté
 * bien poblada. Para el resto, se busca su rol_personalizado_id y se revisa si
 * ese rol tiene `permiso` marcado.
 */
export const exigirPermiso = async (
  cliente: ClienteAdmin,
  token: string,
  permiso: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil, error: errorPerfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', llamador.user.id)
    .maybeSingle();

  if (errorPerfil) return { status: 503, error: 'No se pudieron verificar los permisos.' };

  if (perfil?.rol === 'admin') {
    return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  if (perfil?.rol_personalizado_id) {
    const { data: concedido, error: errorPermiso } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id)
      .eq('permiso', permiso)
      .maybeSingle();
    if (errorPermiso) return { status: 503, error: 'No se pudieron verificar los permisos.' };
    if (concedido) return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  return { status: 403, error: 'No tienes permiso para esta acción.' };
};

/** Comprueba cualquiera de los permisos que permiten administrar usuarios.
 * La lista se lee desde Auth con service-role, así que nunca se entrega el
 * historial de acceso a alguien que solo pueda ver otra pestaña del panel. */
export const exigirGestionUsuarios = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil, error: errorPerfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', llamador.user.id)
    .maybeSingle();

  if (errorPerfil) return { status: 503, error: 'No se pudieron verificar los permisos.' };

  if (perfil?.rol === 'admin') return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  if (!perfil?.rol_personalizado_id) return { status: 403, error: 'No tienes permiso para esta acción.' };

  const { data: concedido, error: errorPermiso } = await cliente
    .from('permisos_por_rol')
    .select('permiso')
    .eq('rol_id', perfil.rol_personalizado_id)
    .in('permiso', ['crear_usuario', 'editar_usuario', 'eliminar_usuario', 'impersonar_usuario'])
    .limit(1)
    .maybeSingle();

  if (errorPermiso) return { status: 503, error: 'No se pudieron verificar los permisos.' };

  return concedido
    ? { userId: llamador.user.id, email: llamador.user.email ?? '' }
    : { status: 403, error: 'No tienes permiso para esta acción.' };
};

export const fechaBogotaHoy = (): string => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
};

/** Rol actual del objetivo y cuántos admins hay, para las guardas de bloqueo. */
export const contextoDe = async (cliente: ClienteAdmin, objetivoId: string) => {
  const { data: objetivo, error: errorObjetivo } = await cliente
    .from('perfiles')
    .select('rol, email, usuario')
    .eq('id', objetivoId)
    .single();

  // PGRST116 = "single() esperaba una fila y no encontró ninguna" -- eso es
  // legítimamente "no existe", y `existe: objetivo !== null` ya lo cubre más
  // abajo. Cualquier OTRO error (red, timeout, Supabase caído) no es lo
  // mismo que "no es admin": tratarlo como tal abriría la guarda del último
  // administrador en vez de bloquearla, así que se propaga como fallo real.
  if (errorObjetivo && errorObjetivo.code !== 'PGRST116') {
    throw new Error(`No se pudo leer el perfil objetivo: ${errorObjetivo.message}`);
  }

  const { count, error: errorConteo } = await cliente
    .from('perfiles')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'admin');

  if (errorConteo) {
    throw new Error(`No se pudo contar administradores: ${errorConteo.message}`);
  }

  return {
    objetivoRol: (objetivo?.rol === 'admin' ? 'admin' : 'usuario') as 'admin' | 'usuario',
    totalAdmins: count ?? 0,
    existe: objetivo !== null,
    objetivoEmail: objetivo?.email ?? '',
    objetivoUsuario: objetivo?.usuario ?? '',
  };
};
