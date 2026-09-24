import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { esUltimoAdmin, motivoParaNoBorrar, motivoParaRechazar } from './server_lib/superadmin.ts';
import type { CambiosUsuario } from './server_lib/superadmin.ts';
import { validarContrasenaSegura } from './src/lib/seguridad.ts';
import { analizarConPlantilla, detectarBanco } from './server_lib/plantillas/index.ts';
import type { AnalisisResultado, MovimientoExtraido } from './src/features/lukapp/analista/tipos.ts';
import { CATEGORIES, type Category, type TxKind } from './src/features/lukapp/types.ts';
import {
  generarLlave,
  hashLlave,
  llaveDeCabecera,
  movimientoDesdeAtajo,
  pistaDeLlave,
} from './server_lib/atajos.ts';
import {
  CABECERAS_API_SEGURAS,
  esOrigenCorsPermitido,
  origenesCorsPermitidos,
} from './server_lib/seguridadHttp.ts';
import {
  leerVocabularioPersonal,
  transcribirAudio,
  type ModoTranscripcion,
} from './server_lib/transcripcion.ts';
import {
  beneficiosDelPlan,
  esClaveBeneficioPlan,
  fechaPremiumValida,
  mensajeCupoAgotado,
  validarConfiguracionPlan,
  type BeneficioPlan,
  type ClaveBeneficioPlan,
  type CodigoPlan,
  type LimitesPlan,
  type RecursoDeCupo,
  type ResultadoCupo,
} from './server_lib/suscripciones.ts';
import {
  construirPerfilFinancieroCompleto,
  huellaPerfilFinanciero,
  type FilaFinanciera,
} from './server_lib/perfilAsesor.ts';
import {
  MAX_CARACTERES_CONTEXTO_ASESOR,
  MAX_CARACTERES_MEMORIA_ASESOR,
  MAX_CARACTERES_PREGUNTA_ASESOR,
  acotarHistorialAsesor,
  recortarConMuestras,
} from './server_lib/presupuestoAsesor.ts';
import { MODELOS_GROQ_ASESOR } from './server_lib/proveedoresIA.ts';
import {
  centavosWompi,
  checksumEsperadoWompi,
  coincideChecksum,
  configuracionWompi,
  firmaIntegridadWompi,
  type EventoWompi,
} from './server_lib/wompi.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_BYTES_AUDIO = 8 * 1024 * 1024; // 8 MB

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

// ----------------------------------------------------------------------
// SEGURIDAD: Rate Limiter en Memoria para APIs
// ----------------------------------------------------------------------
const rateLimiter = (maxPeticiones = 120, ventanaMs = 60000) => {
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

app.use('/api', rateLimiter(120, 60000));
// Las acciones que alteran cuentas no necesitan el límite amplio del resto de
// la API. Es una segunda barrera ante automatización y fuerza bruta.
app.use(['/api/crear-usuario', '/api/editar-usuario', '/api/solicitudes-superadmin'], rateLimiter(12, 60000));
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
app.use(express.json({ limit: '6mb' }));
app.use(express.raw({ type: 'audio/*', limit: MAX_BYTES_AUDIO }));
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (typeof error === 'object' && error && (error as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
  }
  return next(error);
});

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

const auditLogs: AuditLog[] = [];

const registrarAuditoria = (
  adminEmail: string,
  action: string,
  targetUser?: string,
  details?: string,
) => {
  auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    adminEmail,
    action,
    targetUser,
    details,
  });
  if (auditLogs.length > 500) auditLogs.pop();
};

// ----------------------------------------------------------------------
// ENDPOINT: Crear Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/crear-usuario', async (req, res) => {
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
    const errorPassword = validarContrasenaSegura(password, [usuario, email]);
    if (errorPassword) return res.status(400).json({ error: errorPassword });

    // Un rol delegado puede crear usuarios normales, pero nunca elevarlos.
    // La elevación la solicita y aprueba otro superadmin más abajo.
    if (rol === 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
    }

    const { data: newUser, error: createError } = await cliente.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { usuario: usuario || '' }
    });

    if (createError) throw createError;

    if (rol === 'admin' && newUser.user) {
      const { error: solicitudError } = await cliente.from('solicitudes_superadmin').insert({
        objetivo_id: newUser.user.id,
        solicitada_por: acceso.userId,
      });
      if (solicitudError) {
        await cliente.auth.admin.deleteUser(newUser.user.id);
        throw solicitudError;
      }
    }

    registrarAuditoria(
      acceso.email || 'admin',
      'Creó usuario',
      email,
      `Usuario: ${usuario || '-'}, Rol: ${rol || 'usuario'}`,
    );

    return res.status(200).json({ success: true, user: newUser.user, solicitudPendiente: rol === 'admin' });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// Cliente admin + comprobación de que quien llama es administrador.
// ----------------------------------------------------------------------
const clienteAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

type ClienteAdmin = NonNullable<ReturnType<typeof clienteAdmin>>;

/**
 * La API que puede consumir IA o procesar documentos es privada por defecto.
 * Un servidor sin Supabase no debe convertirse, por un error de despliegue, en
 * un proxy público de las llaves de IA. El modo local se habilita solo de forma
 * explícita y únicamente fuera de producción para pruebas manuales.
 */
const sePermiteApiLocalSinSesion = (): boolean =>
  process.env.NODE_ENV !== 'production'
  && !process.env.RENDER
  && process.env.PERMITIR_API_SIN_SESION_EN_LOCAL === 'true';

const exigirConfiguracionSegura = (
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

interface EstadoPlanServidor {
  codigo: CodigoPlan;
  nombre: string;
  precios: { mensualCop: number; anualCop: number };
  preciosPremium: { mensualCop: number; anualCop: number };
  limitesPremium: {
    dictadosMensual: number | null;
    asesorIaMensual: number | null;
    extractosMensual: number | null;
    espaciosCompartidos: number | null;
    integrantesPorEspacio: number | null;
  };
  limites: {
    dictadosMensual: number | null;
    asesorIaMensual: number | null;
    extractosMensual: number | null;
    espaciosCompartidos: number | null;
    integrantesPorEspacio: number | null;
  };
  beneficios: BeneficioPlan[];
  beneficiosPremium: BeneficioPlan[];
  consumo: { dictados: number; asesorIa: number; extractos: number };
  suscripcion: { id: number; ciclo: 'mensual' | 'anual' | 'cortesia'; venceEn: string; cancelarAlVencer: boolean } | null;
}

type CicloDePago = 'mensual' | 'anual';

interface IntentoPagoWompi {
  id: number;
  referencia: string;
  user_id: string;
  ciclo: CicloDePago;
  monto_cop: number;
  moneda: 'COP';
  ambiente: 'test' | 'prod';
  estado: string;
  checkout_vence_en: string;
  wompi_transaccion_id: string | null;
}

interface TransaccionWompi {
  id: string;
  referencia: string;
  montoCentavos: number;
  moneda: 'COP';
  estado: 'APPROVED' | 'PENDING' | 'DECLINED' | 'VOIDED' | 'ERROR';
}

const esRegistro = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

const textoNoVacio = (valor: unknown, maximo = 200): string | null =>
  typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= maximo
    ? valor.trim()
    : null;

const enteroPositivoSeguro = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null;

const leerTransaccionWompi = (evento: EventoWompi): TransaccionWompi | null => {
  if (!esRegistro(evento.data) || !esRegistro(evento.data.transaction)) return null;
  const transaccion = evento.data.transaction;
  const id = textoNoVacio(transaccion.id);
  const referencia = textoNoVacio(transaccion.reference, 100);
  const montoCentavos = enteroPositivoSeguro(transaccion.amount_in_cents);
  const moneda = transaccion.currency;
  const estado = transaccion.status;
  if (!id || !referencia || !/^[A-Za-z0-9_-]{12,100}$/.test(referencia)
    || !montoCentavos || moneda !== 'COP'
    || !['APPROVED', 'PENDING', 'DECLINED', 'VOIDED', 'ERROR'].includes(String(estado))) {
    return null;
  }
  return { id, referencia, montoCentavos, moneda, estado: estado as TransaccionWompi['estado'] };
};

const vencimientoPremium = (ciclo: CicloDePago, iniciaEn: Date): string => {
  const resultado = new Date(iniciaEn);
  const diaOriginal = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + (ciclo === 'anual' ? 12 : 1));
  const ultimoDia = new Date(Date.UTC(
    resultado.getUTCFullYear(),
    resultado.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  resultado.setUTCDate(Math.min(diaOriginal, ultimoDia));
  return resultado.toISOString();
};

const estadoIntentoDesdeWompi = (estado: TransaccionWompi['estado']): IntentoPagoWompi['estado'] => ({
  APPROVED: 'aprobado',
  PENDING: 'pendiente',
  DECLINED: 'rechazado',
  VOIDED: 'anulado',
  ERROR: 'error',
})[estado];

const configuracionWompiLista = () => configuracionWompi(process.env);

type FilaBeneficioPlan = { plan_codigo: string; clave: string; activo: boolean };

/**
 * Durante un despliegue el servidor nuevo puede iniciar unos segundos antes
 * que la migración que crea el catálogo. Conservamos los beneficios que ya
 * existían antes de dicho catálogo para no desconectar el Asesor ni la cuenta
 * mientras termina la actualización de la base.
 */
const BENEFICIOS_ANTERIORES_AL_CATALOGO: Record<CodigoPlan, Partial<Record<ClaveBeneficioPlan, boolean>>> = {
  normal: {
    dictado: true,
    asesor_ia: true,
    extracto: true,
    espacios_compartidos: true,
    integrantes_espacio: true,
    insights_ia: false,
    pulso_premium: false,
  },
  premium: {
    dictado: true,
    asesor_ia: true,
    extracto: true,
    espacios_compartidos: true,
    integrantes_espacio: true,
    insights_ia: true,
    pulso_premium: true,
  },
};

const esMigracionCatalogoPendiente = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const detalle = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const texto = [detalle.message, detalle.details, detalle.hint]
    .filter((valor): valor is string => typeof valor === 'string')
    .join(' ')
    .toLowerCase();
  return /beneficios_plan|actualizar_plan_con_beneficios/.test(texto)
    && /does not exist|could not find|schema cache|not found/.test(texto);
};

const limitesDePlan = (plan: Record<string, unknown>): LimitesPlan => ({
  dictadosMensual: plan.limite_dictados_mensual === null ? null : Number(plan.limite_dictados_mensual),
  asesorIaMensual: plan.limite_asesor_ia_mensual === null ? null : Number(plan.limite_asesor_ia_mensual),
  extractosMensual: plan.limite_extractos_mensual === null ? null : Number(plan.limite_extractos_mensual),
  espaciosCompartidos: plan.limite_espacios_compartidos === null ? null : Number(plan.limite_espacios_compartidos),
  integrantesPorEspacio: plan.limite_integrantes_por_espacio === null ? null : Number(plan.limite_integrantes_por_espacio),
});

const beneficiosDePlan = (
  filas: readonly FilaBeneficioPlan[],
  codigo: CodigoPlan,
  limites: LimitesPlan,
): BeneficioPlan[] => {
  const seleccion: Partial<Record<ClaveBeneficioPlan, boolean>> = {};
  for (const fila of filas) {
    if (fila.plan_codigo === codigo && esClaveBeneficioPlan(fila.clave)) {
      seleccion[fila.clave] = fila.activo === true;
    }
  }
  return beneficiosDelPlan(seleccion, limites);
};

const beneficiosCompatiblesConVersionAnterior = (codigo: CodigoPlan, limites: LimitesPlan): BeneficioPlan[] =>
  beneficiosDelPlan(BENEFICIOS_ANTERIORES_AL_CATALOGO[codigo], limites);

/** Ejecuta el contador atómico de PostgreSQL antes de gastar IA, voz o PDF. */
const consumirCupo = async (
  cliente: ClienteAdmin,
  userId: string,
  recurso: RecursoDeCupo,
): Promise<ResultadoCupo> => {
  const { data, error } = await cliente.rpc('consumir_cupo_plan', {
    p_usuario: userId,
    p_recurso: recurso,
  });
  if (error) throw new Error(`No se pudo revisar el cupo: ${error.message}`);
  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado || typeof resultado.permitido !== 'boolean'
    || (resultado.plan_codigo !== 'normal' && resultado.plan_codigo !== 'premium')) {
    throw new Error('La respuesta del cupo no es válida.');
  }
  return {
    permitido: resultado.permitido,
    plan_codigo: resultado.plan_codigo,
    limite: resultado.limite === null ? null : Number(resultado.limite),
    usado: Number(resultado.usado) || 0,
    // La RPC anterior a v4.5 no devolvía este campo. Darla por incluida es
    // exactamente su comportamiento histórico y permite desplegar API y
    // migración sin dejar al Asesor fuera de servicio entre ambos pasos.
    incluido: typeof resultado.incluido === 'boolean' ? resultado.incluido : true,
  };
};

const devolverCupo = async (
  cliente: ClienteAdmin,
  userId: string,
  recurso: RecursoDeCupo,
): Promise<void> => {
  const { error } = await cliente.rpc('devolver_cupo_plan', {
    p_usuario: userId,
    p_recurso: recurso,
  });
  if (error) console.error('[planes] No se pudo devolver un cupo tras un fallo:', error.message);
};

/** Forma estable de exponer el plan propio, sin abrir las tablas de cobros por RLS. */
const estadoPlanDe = async (cliente: ClienteAdmin, userId: string): Promise<EstadoPlanServidor> => {
  const periodo = `${fechaBogotaHoy().slice(0, 7)}-01`;
  const ahora = new Date().toISOString();
  const [
    { data: suscripcion, error: errorSuscripcion },
    { data: consumo, error: errorConsumo },
    { data: planes, error: errorPlanes },
    { data: beneficios, error: errorBeneficios },
  ] = await Promise.all([
    cliente
      .from('suscripciones')
      .select('id,ciclo,vence_en,cancelar_al_vencer,plan_codigo')
      .eq('user_id', userId)
      .eq('estado', 'activa')
      .lte('inicia_en', ahora)
      .gt('vence_en', ahora)
      .order('vence_en', { ascending: false })
      .limit(1)
      .maybeSingle(),
    cliente
      .from('consumos_plan_mensual')
      .select('dictados,asesor_ia,extractos')
      .eq('user_id', userId)
      .eq('periodo', periodo)
      .maybeSingle(),
    cliente
      .from('planes_suscripcion')
      .select('codigo,nombre,precio_mensual_cop,precio_anual_cop,limite_dictados_mensual,limite_asesor_ia_mensual,limite_extractos_mensual,limite_espacios_compartidos,limite_integrantes_por_espacio'),
    cliente
      .from('beneficios_plan')
      .select('plan_codigo,clave,activo'),
  ]);
  if (errorSuscripcion) throw new Error(errorSuscripcion.message);
  if (errorConsumo) throw new Error(errorConsumo.message);
  if (errorPlanes) throw new Error(errorPlanes.message);
  if (errorBeneficios && !esMigracionCatalogoPendiente(errorBeneficios)) {
    throw new Error(errorBeneficios.message);
  }

  const codigo: CodigoPlan = suscripcion?.plan_codigo === 'premium' ? 'premium' : 'normal';
  const plan = (planes ?? []).find((candidato) => candidato.codigo === codigo);
  const planPremium = (planes ?? []).find((candidato) => candidato.codigo === 'premium');
  if (!plan || !planPremium) throw new Error('No se encontró la configuración de los planes.');
  const limites = limitesDePlan(plan);
  const limitesPremium = limitesDePlan(planPremium);
  const beneficiosConfigurados = (beneficios ?? []) as FilaBeneficioPlan[];
  const usarCompatibilidad = Boolean(errorBeneficios);

  return {
    codigo,
    nombre: plan.nombre,
    precios: { mensualCop: Number(plan.precio_mensual_cop), anualCop: Number(plan.precio_anual_cop) },
    // Una cuenta Normal cuesta $0. Los botones de compra, en cambio, siempre
    // deben mostrar la fila de Premium: confundir ambas mostraba un precio
    // gratuito aunque el checkout cobrara correctamente el valor de Premium.
    preciosPremium: {
      mensualCop: Number(planPremium.precio_mensual_cop),
      anualCop: Number(planPremium.precio_anual_cop),
    },
    limitesPremium,
    limites,
    beneficios: usarCompatibilidad
      ? beneficiosCompatiblesConVersionAnterior(codigo, limites)
      : beneficiosDePlan(beneficiosConfigurados, codigo, limites),
    beneficiosPremium: usarCompatibilidad
      ? beneficiosCompatiblesConVersionAnterior('premium', limitesPremium)
      : beneficiosDePlan(beneficiosConfigurados, 'premium', limitesPremium),
    consumo: {
      dictados: Number(consumo?.dictados) || 0,
      asesorIa: Number(consumo?.asesor_ia) || 0,
      extractos: Number(consumo?.extractos) || 0,
    },
    suscripcion: suscripcion
      ? {
        id: Number(suscripcion.id),
        ciclo: suscripcion.ciclo,
        venceEn: suscripcion.vence_en,
        cancelarAlVencer: Boolean(suscripcion.cancelar_al_vencer),
      }
      : null,
  };
};

/** El id y correo del que llama si es admin; si no, el estado y mensaje a devolver. */
const exigirAdmin = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol')
    .eq('id', llamador.user.id)
    .single();

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
const exigirUsuario = async (
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
const exigirPermiso = async (
  cliente: ClienteAdmin,
  token: string,
  permiso: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', llamador.user.id)
    .single();

  if (perfil?.rol === 'admin') {
    return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  if (perfil?.rol_personalizado_id) {
    const { data: concedido } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id)
      .eq('permiso', permiso)
      .maybeSingle();
    if (concedido) return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  return { status: 403, error: 'No tienes permiso para esta acción.' };
};

/** Comprueba cualquiera de los permisos que permiten administrar usuarios.
 * La lista se lee desde Auth con service-role, así que nunca se entrega el
 * historial de acceso a alguien que solo pueda ver otra pestaña del panel. */
const exigirGestionUsuarios = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', llamador.user.id)
    .single();

  if (perfil?.rol === 'admin') return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  if (!perfil?.rol_personalizado_id) return { status: 403, error: 'No tienes permiso para esta acción.' };

  const { data: concedido } = await cliente
    .from('permisos_por_rol')
    .select('permiso')
    .eq('rol_id', perfil.rol_personalizado_id)
    .in('permiso', ['crear_usuario', 'editar_usuario', 'eliminar_usuario', 'impersonar_usuario'])
    .limit(1)
    .maybeSingle();

  return concedido
    ? { userId: llamador.user.id, email: llamador.user.email ?? '' }
    : { status: 403, error: 'No tienes permiso para esta acción.' };
};

// ----------------------------------------------------------------------
// ENDPOINT: Usuarios del Superadmin
// `last_sign_in_at` pertenece a Auth, no a perfiles. Se mezcla aquí con el
// cliente de service-role para mantener esa información fuera del navegador.
// ----------------------------------------------------------------------
app.get('/api/superadmin/usuarios', async (req, res) => {
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
// ENDPOINT: Registrar apertura de LukApp
// Solo escribe la fila ligada al token recibido; el id nunca viene del cliente
// ni se puede sustituir por el de otra persona.
// ----------------------------------------------------------------------
app.post('/api/registrar-ultimo-acceso', async (req, res) => {
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
// TELEMETRÍA: Consumo de Tokens y Métricas de IA
// ----------------------------------------------------------------------
export interface PeticionIA {
  id: string;
  timestamp: string;
  usuarioEmail: string;
  proveedor: string;
  modelo: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duracionMs: number;
  exito: boolean;
  motivo?: string;
  promptText?: string;
  respuestaTexto?: string;
}

interface MetricasIAStore {
  fechaActual: string;
  tokensHoy: number;
  llamadasHoy: number;
  llamadasExitosasHoy: number;
  llamadasFallbackHoy: number;
  latenciasMs: number[];
  peticionesRecientes: PeticionIA[];
}

const fechaBogotaHoy = (): string => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
};

/** Evita que un proveedor lento bloquee el chat y fuerce un falso modo local. */
const fetchConTiempoLimite = async (url: string, init: RequestInit, ms = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const metricasIA: MetricasIAStore = {
  fechaActual: fechaBogotaHoy(),
  tokensHoy: 0,
  llamadasHoy: 0,
  llamadasExitosasHoy: 0,
  llamadasFallbackHoy: 0,
  latenciasMs: [],
  peticionesRecientes: [],
};

const asegurarDiaActualMetricas = () => {
  const hoy = fechaBogotaHoy();
  if (metricasIA.fechaActual !== hoy) {
    metricasIA.fechaActual = hoy;
    metricasIA.tokensHoy = 0;
    metricasIA.llamadasHoy = 0;
    metricasIA.llamadasExitosasHoy = 0;
    metricasIA.llamadasFallbackHoy = 0;
    metricasIA.latenciasMs = [];
  }
};

// ----------------------------------------------------------------------
// ENDPOINT: Analítica de tráfico (Superadmin)
// ----------------------------------------------------------------------
// La lectura pasa por el servidor, igual que los demás datos del superadmin.
// Así el navegador no queda atado a la caché del esquema de PostgREST ni a una
// política RLS que cambie mientras se despliega una migración.
const RANGOS_ANALITICA = new Set([7, 30, 90]);
const CAMPOS_VISITA_BASE = 'ruta,referente,pais,dispositivo,visitante,creado_en';
const CAMPOS_VISITA_ENRIQUECIDOS = `${CAMPOS_VISITA_BASE},utm_source,utm_medium,utm_campaign,utm_content,idioma,sistema,navegador,pantalla,zona_horaria`;

interface VisitaAnaliticaServidor {
  creado_en: string;
  visitante: string;
  [campo: string]: unknown;
}

app.get('/api/superadmin/visitas', async (req, res) => {
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

const registrarUsoIA = async (
  peticion: Omit<PeticionIA, 'id' | 'timestamp'>,
  cliente?: ClienteAdmin | null,
  userId?: string,
  idConsulta?: string,
) => {
  asegurarDiaActualMetricas();
  const registro: PeticionIA = {
    // El cliente conserva este id cuando termina en respaldo local. Así una
    // caída de red no duplica la misma pregunta al llegar tarde al servidor.
    id: idConsulta || `req-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    timestamp: new Date().toISOString(),
    ...peticion,
  };

  metricasIA.llamadasHoy += 1;
  if (peticion.exito) {
    metricasIA.llamadasExitosasHoy += 1;
    metricasIA.tokensHoy += peticion.totalTokens;
    metricasIA.latenciasMs.push(peticion.duracionMs);
    if (metricasIA.latenciasMs.length > 50) metricasIA.latenciasMs.shift();
  } else {
    metricasIA.llamadasFallbackHoy += 1;
  }

  metricasIA.peticionesRecientes.unshift(registro);
  if (metricasIA.peticionesRecientes.length > 50) metricasIA.peticionesRecientes.pop();

  // Persistencia en Supabase: si la tabla existe, el historial sobrevive a cualquier reinicio del servidor
  if (cliente) {
    /* `Promise.resolve` envolviendo la consulta: el constructor de Supabase es
       un thenable, no una promesa, así que su `.then()` devuelve `PromiseLike`
       y ahí no existe `.catch`. En ejecución funcionaba de casualidad; para el
       compilador era un acceso a un método inexistente, y era el único punto
       del servidor donde un fallo de red al guardar telemetría podía acabar en
       un rechazo sin capturar. */
    await Promise.resolve(
      cliente
      .from('telemetria_ia')
      .upsert({
        id: registro.id,
        usuario_id: userId || null,
        usuario_email: registro.usuarioEmail,
        proveedor: registro.proveedor,
        modelo: registro.modelo,
        prompt_tokens: registro.promptTokens,
        completion_tokens: registro.completionTokens,
        total_tokens: registro.totalTokens,
        duracion_ms: registro.duracionMs,
        exito: registro.exito,
        motivo: registro.motivo || null,
        prompt_texto: registro.promptText || null,
        respuesta_texto: registro.respuestaTexto || null,
        creado_en: registro.timestamp,
      }, { onConflict: 'id', ignoreDuplicates: true }),
    )
      .then(({ error }) => {
        if (error) {
          // Si la tabla aún no se ha creado en Supabase, no rompe nada (continúa con memoria local)
          console.error('[telemetria_ia] No se pudo persistir la consulta del Asesor:', {
            codigo: error.code,
            mensaje: error.message,
            idConsulta: registro.id,
          });
        }
      })
      .catch((err) => {
        console.error('[telemetria_ia] Error de red al persistir la consulta del Asesor:', {
          idConsulta: registro.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }
};

/** Rol actual del objetivo y cuántos admins hay, para las guardas de bloqueo. */
const contextoDe = async (cliente: ClienteAdmin, objetivoId: string) => {
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

// ----------------------------------------------------------------------
// ENDPOINT: Editar Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/editar-usuario', async (req, res) => {
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

    const motivo = motivoParaRechazar(cambios, {
      editorId: acceso.userId,
      objetivoId: userId,
      objetivoRol: ctx.objetivoRol,
      totalAdmins: ctx.totalAdmins,
    });
    if (motivo) return res.status(400).json({ error: motivo });

    const errorPassword = cambios.password === undefined
      ? null
      : validarContrasenaSegura(cambios.password, [cambios.usuario ?? ctx.objetivoUsuario, cambios.email ?? ctx.objetivoEmail]);
    if (errorPassword) return res.status(400).json({ error: errorPassword });

    if (cambios.rol === 'admin' && ctx.objetivoRol !== 'admin') {
      const admin = await exigirAdmin(cliente, token);
      if ('error' in admin) return res.status(admin.status).json({ error: admin.error });
      const { error: solicitudError } = await cliente.from('solicitudes_superadmin').insert({
        objetivo_id: userId,
        solicitada_por: admin.userId,
      });
      if (solicitudError?.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una solicitud de superadmin pendiente para esta persona.' });
      }
      if (solicitudError) throw solicitudError;
      registrarAuditoria(admin.email, 'Solicitó elevar a superadmin', ctx.objetivoEmail);
      return res.status(202).json({ success: true, solicitudPendiente: true });
    }

    // Ningún permiso delegado puede modificar una cuenta superadmin ni
    // degradarla: ambos cambios requieren un superadmin fijo.
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

    registrarAuditoria(
      acceso.email,
      'Editó usuario',
      cambios.email || userId,
      Object.keys(cambios).join(', '),
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error editando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINTS: Aprobación cruzada de superadmins
// ----------------------------------------------------------------------
app.get('/api/solicitudes-superadmin', async (req, res) => {
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

app.post('/api/solicitudes-superadmin/:id/aprobar', async (req, res) => {
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
    registrarAuditoria(acceso.email, 'Aprobó nuevo superadmin', req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'No se pudo aprobar la solicitud.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Eliminar Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/eliminar-usuario', async (req, res) => {
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

    // Borra la cuenta de auth; la fila de `perfiles` se va sola por la llave
    // foránea con `on delete cascade` contra auth.users.
    const { error } = await cliente.auth.admin.deleteUser(userId);
    if (error) throw error;

    registrarAuditoria(
      acceso.email,
      'Eliminó usuario',
      userId,
      `Rol: ${ctx.objetivoRol}`,
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
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
app.post('/api/mi-cuenta/eliminar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

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

    registrarAuditoria(acceso.email, 'Eliminó su propia cuenta', acceso.userId);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando cuenta propia:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Impersonar Usuario (Superadmin)
// Usa auth.admin.generateLink para obtener un token_hash. El frontend lo
// intercambia via supabase.auth.verifyOtp() — llamada pura a la API de
// Supabase, sin abrir ninguna URL ni redirigir al localhost.
// ----------------------------------------------------------------------
app.post('/api/impersonar-usuario', async (req, res) => {
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

    registrarAuditoria(
      acceso.email,
      'Inició sesión de asesoría (Impersonación)',
      userTarget.user.email,
      `ID: ${userId}`,
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
app.get('/api/auditoria-logs', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirPermiso(cliente, token, 'ver_auditoria');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  return res.status(200).json({ success: true, logs: auditLogs });
});

// ----------------------------------------------------------------------
// ENDPOINT: Métricas de IA y Consumo de Tokens (Superadmin)
// ----------------------------------------------------------------------
app.get('/api/metricas-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirPermiso(cliente, token, 'ver_metricas_ia');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  asegurarDiaActualMetricas();

  const groqKey = Boolean(process.env.GROQ_API_KEY);
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const deepseekKey = Boolean(process.env.DEEPSEEK_API_KEY);

  let proveedorPrincipal = 'Ninguno (Modo Local)';
  let modeloPrincipal = 'Motor de Reglas Heurístico';
  let limiteDiarioTokens = 0;
  let limiteDiarioLlamadas = 0;

  if (groqKey) {
    proveedorPrincipal = 'Groq Cloud';
    modeloPrincipal = 'openai/gpt-oss-120b';
    limiteDiarioTokens = 500000;
    limiteDiarioLlamadas = 14400;
  } else if (openaiKey) {
    proveedorPrincipal = 'OpenAI';
    modeloPrincipal = 'gpt-4o-mini';
    limiteDiarioTokens = 200000;
    limiteDiarioLlamadas = 5000;
  } else if (geminiKey) {
    proveedorPrincipal = 'Google Gemini';
    modeloPrincipal = 'gemini-1.5-flash';
    limiteDiarioTokens = 1000000;
    limiteDiarioLlamadas = 1500;
  } else if (anthropicKey) {
    proveedorPrincipal = 'Anthropic';
    modeloPrincipal = 'claude-3-5-sonnet';
    limiteDiarioTokens = 100000;
    limiteDiarioLlamadas = 1000;
  } else if (deepseekKey) {
    proveedorPrincipal = 'DeepSeek';
    modeloPrincipal = 'deepseek-chat';
    limiteDiarioTokens = 500000;
    limiteDiarioLlamadas = 10000;
  }

  let tokensHoy = metricasIA.tokensHoy;
  let llamadasHoy = metricasIA.llamadasHoy;
  let llamadasExitosasHoy = metricasIA.llamadasExitosasHoy;
  let llamadasFallbackHoy = metricasIA.llamadasFallbackHoy;
  let latenciasMs = metricasIA.latenciasMs;
  let peticionesRecientes = metricasIA.peticionesRecientes;
  let usuariosMasActivos: Array<{ usuarioEmail: string; consultas: number; tokens: number }> = [];
  let origenMetricas: 'supabase' | 'memoria' = 'memoria';
  let diagnosticoTelemetria: string | null = null;

  // Cargar datos persistentes de Supabase si existen
  try {
    const inicioHoyIso = `${metricasIA.fechaActual}T00:00:00-05:00`;
    const { data: filasHoy, error: errHoy } = await cliente
      .from('telemetria_ia')
      .select('*')
      .gte('creado_en', inicioHoyIso)
      .order('creado_en', { ascending: false })
      .limit(200);

    if (errHoy) {
      diagnosticoTelemetria = `Supabase no pudo leer telemetria_ia (${errHoy.code || 'sin código'}). Revisa la migración 0013 y la service role en Render.`;
      console.error('[metricas-ia] Error leyendo telemetria_ia:', { codigo: errHoy.code, mensaje: errHoy.message });
    } else if (filasHoy && filasHoy.length > 0) {
      origenMetricas = 'supabase';
      llamadasHoy = filasHoy.length;
      llamadasExitosasHoy = filasHoy.filter((f) => f.exito).length;
      llamadasFallbackHoy = filasHoy.filter((f) => !f.exito).length;
      tokensHoy = filasHoy.filter((f) => f.exito).reduce((acc, f) => acc + (f.total_tokens || 0), 0);
      latenciasMs = filasHoy.filter((f) => f.exito && f.duracion_ms).map((f) => f.duracion_ms);
      peticionesRecientes = filasHoy.slice(0, 50).map((f) => ({
        id: f.id,
        timestamp: f.creado_en,
        usuarioEmail: f.usuario_email,
        proveedor: f.proveedor,
        modelo: f.modelo,
        promptTokens: f.prompt_tokens,
        completionTokens: f.completion_tokens,
        totalTokens: f.total_tokens,
        duracionMs: f.duracion_ms,
        exito: f.exito,
        motivo: f.motivo || undefined,
        promptText: f.prompt_texto || undefined,
        respuestaTexto: f.respuesta_texto || undefined,
      }));
      const porUsuario = new Map<string, { consultas: number; tokens: number }>();
      filasHoy.forEach((f) => {
        const usuario = f.usuario_email || 'usuario_local';
        const actual = porUsuario.get(usuario) || { consultas: 0, tokens: 0 };
        actual.consultas += 1;
        actual.tokens += Number(f.total_tokens) || 0;
        porUsuario.set(usuario, actual);
      });
      usuariosMasActivos = Array.from(porUsuario.entries())
        .map(([usuarioEmail, datos]) => ({ usuarioEmail, ...datos }))
        .sort((a, b) => b.consultas - a.consultas || b.tokens - a.tokens || a.usuarioEmail.localeCompare(b.usuarioEmail))
        .slice(0, 5);
    } else if (filasHoy && filasHoy.length === 0) {
      origenMetricas = 'supabase';
      // Si hoy aún no hay consultas, traer las más recientes para mantener el historial visible
      const { data: ultimas, error: errUltimas } = await cliente
        .from('telemetria_ia')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50);

      if (!errUltimas && ultimas && ultimas.length > 0) {
        peticionesRecientes = ultimas.map((f) => ({
          id: f.id,
          timestamp: f.creado_en,
          usuarioEmail: f.usuario_email,
          proveedor: f.proveedor,
          modelo: f.modelo,
          promptTokens: f.prompt_tokens,
          completionTokens: f.completion_tokens,
          totalTokens: f.total_tokens,
          duracionMs: f.duracion_ms,
          exito: f.exito,
          motivo: f.motivo || undefined,
          promptText: f.prompt_texto || undefined,
          respuestaTexto: f.respuesta_texto || undefined,
        }));
      }
    }
  } catch (err) {
    diagnosticoTelemetria = 'No se pudo conectar con Supabase para leer telemetria_ia. Revisa los logs de Render.';
    console.error('[metricas-ia] Usando memoria local por error de consulta:', err);
  }

  const latenciaPromedio = latenciasMs.length > 0
    ? Math.round(latenciasMs.reduce((a, b) => a + b, 0) / latenciasMs.length)
    : 0;

  const tokensRestantes = limiteDiarioTokens > 0 ? Math.max(0, limiteDiarioTokens - tokensHoy) : 0;
  const llamadasRestantes = limiteDiarioLlamadas > 0 ? Math.max(0, limiteDiarioLlamadas - llamadasHoy) : 0;
  const porcentajeTokens = limiteDiarioTokens > 0 ? Number(((tokensHoy / limiteDiarioTokens) * 100).toFixed(2)) : 0;
  const porcentajeLlamadas = limiteDiarioLlamadas > 0 ? Number(((llamadasHoy / limiteDiarioLlamadas) * 100).toFixed(2)) : 0;

  return res.status(200).json({
    success: true,
    fecha: metricasIA.fechaActual,
    proveedor: proveedorPrincipal,
    modelo: modeloPrincipal,
    hayIA: Boolean(groqKey || openaiKey || geminiKey || anthropicKey || deepseekKey),
    tokensHoy,
    tokensRestantes,
    limiteDiarioTokens,
    porcentajeTokens,
    llamadasHoy,
    llamadasExitosas: llamadasExitosasHoy,
    llamadasFallback: llamadasFallbackHoy,
    llamadasRestantes,
    limiteDiarioLlamadas,
    porcentajeLlamadas,
    latenciaPromedioMs: latenciaPromedio,
    costoEstimadoCop: 0,
    origenMetricas,
    diagnosticoTelemetria,
    peticionesRecientes,
    usuariosMasActivos,
  });
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

app.get('/api/roles', async (req, res) => {
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

app.post('/api/crear-rol', async (req, res) => {
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

  registrarAuditoria(acceso.email, 'Creó rol', nombre, `Permisos: ${permisosLimpios.join(', ') || 'ninguno'}`);
  return res.status(200).json({ success: true, id });
});

app.post('/api/editar-rol', async (req, res) => {
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

  registrarAuditoria(acceso.email, 'Editó rol', nombre || id);
  return res.status(200).json({ success: true });
});

app.post('/api/eliminar-rol', async (req, res) => {
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

  registrarAuditoria(acceso.email, 'Eliminó rol', id);
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
app.get('/api/mis-permisos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const quien = await exigirUsuario(cliente, token);
  if ('error' in quien) return res.status(quien.status).json({ error: quien.error });

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', quien.userId)
    .single();

  const rol = perfil?.rol === 'admin' ? 'admin' : 'usuario';
  let permisos: string[] = [];

  if (rol !== 'admin' && perfil?.rol_personalizado_id) {
    const { data } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id);
    permisos = (data ?? []).map((p) => p.permiso);
  }

  return res.status(200).json({ rol, permisos });
});

// ----------------------------------------------------------------------
// PLANES, SUSCRIPCIONES Y FACTURACIÓN
// ----------------------------------------------------------------------
// Estas rutas son la única puerta HTTP hacia las tablas de Freemium. No se
// publican políticas RLS para ellas: así un navegador jamás puede alterar un
// cupo, una vigencia o un cobro llamando directamente a Supabase.
app.get('/api/mi-plan', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para consultar tu plan.' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    return res.status(200).json(await estadoPlanDe(cliente, acceso.userId));
  } catch (error: any) {
    console.error('Error consultando el plan propio:', error);
    return res.status(500).json({ error: 'No se pudo consultar tu plan.' });
  }
});

// El navegador jamás elige precio, referencia ni firma. Esta ruta relee el
// Premium desde PostgreSQL, crea (o recupera) una intención de 30 minutos y
// devuelve los campos exactos que el formulario GET de Web Checkout necesita.
app.post('/api/pagos/wompi/checkout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para pagar Premium.' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de pagos todavía no está configurada.' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const ciclo = req.body?.ciclo;
    if (ciclo !== 'mensual' && ciclo !== 'anual') {
      return res.status(400).json({ error: 'Elige el ciclo mensual o anual de Premium.' });
    }

    let wompi;
    try {
      wompi = configuracionWompiLista();
    } catch (error: unknown) {
      console.error('[wompi] Configuración incompleta:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Los pagos con Wompi aún no están habilitados. Inténtalo más tarde.' });
    }

    const estadoActual = await estadoPlanDe(cliente, acceso.userId);
    if (estadoActual.codigo === 'premium' && estadoActual.suscripcion) {
      return res.status(409).json({ error: 'Tu cuenta ya tiene Premium activo. No necesitas hacer otro pago ahora.' });
    }
    if (!estadoActual.beneficiosPremium.some((beneficio) => beneficio.activo)) {
      return res.status(503).json({ error: 'Premium no tiene prestaciones activas para cobrar en este momento.' });
    }

    const { data: premium, error: errorPlan } = await cliente
      .from('planes_suscripcion')
      .select('precio_mensual_cop,precio_anual_cop,activo')
      .eq('codigo', 'premium')
      .single();
    if (errorPlan || !premium || !premium.activo) {
      throw new Error(errorPlan?.message || 'Premium no está disponible para cobrar.');
    }

    const montoCop = Number(ciclo === 'mensual' ? premium.precio_mensual_cop : premium.precio_anual_cop);
    const venceCheckout = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const referenciaNueva = `LUK${ciclo === 'mensual' ? 'M' : 'A'}-${randomBytes(24).toString('hex').toUpperCase()}`;
    const { data: resultadoIntento, error: errorIntento } = await cliente.rpc('crear_intento_pago_wompi', {
      p_usuario: acceso.userId,
      p_ciclo: ciclo,
      p_monto_cop: montoCop,
      p_ambiente: wompi.ambiente,
      p_referencia: referenciaNueva,
      p_checkout_vence_en: venceCheckout,
    });
    if (errorIntento || !resultadoIntento) throw new Error(errorIntento?.message || 'No se pudo preparar el pago.');

    const intento = (Array.isArray(resultadoIntento) ? resultadoIntento[0] : resultadoIntento) as IntentoPagoWompi;
    if (intento.ciclo !== ciclo) {
      return res.status(409).json({
        error: `Ya tienes un checkout ${intento.ciclo} abierto. Termínalo o espera a que venza antes de cambiar el ciclo.`,
      });
    }
    if (intento.ambiente !== wompi.ambiente || intento.moneda !== 'COP') {
      throw new Error('La intención existente no pertenece al ambiente activo.');
    }

    const montoCentavos = centavosWompi(Number(intento.monto_cop));
    const firma = firmaIntegridadWompi(
      intento.referencia,
      montoCentavos,
      intento.checkout_vence_en,
      wompi.secretoIntegridad,
    );

    return res.status(200).json({
      destino: 'https://checkout.wompi.co/p/',
      campos: {
        'public-key': wompi.llavePublica,
        currency: 'COP',
        'amount-in-cents': String(montoCentavos),
        reference: intento.referencia,
        'signature:integrity': firma,
        'redirect-url': wompi.urlRedireccion,
        'expiration-time': intento.checkout_vence_en,
      },
    });
  } catch (error: any) {
    console.error('Error preparando checkout Wompi:', error);
    return res.status(400).json({ error: error.message || 'No se pudo iniciar el checkout de Wompi.' });
  }
});

// Wompi confirma aquí el estado final. La URL de regreso se limita a informar
// al usuario: solo este webhook, validado con el secreto de eventos y contra
// la intención interna, puede cambiar a una persona de Normal a Premium.
app.post('/api/pagos/wompi/webhook', async (req, res) => {
  const cliente = clienteAdmin();
  if (!cliente) {
    console.error('[wompi] Webhook recibido sin cliente de Supabase configurado.');
    return res.status(503).json({ error: 'Servicio de pagos no disponible.' });
  }

  let wompi;
  try {
    wompi = configuracionWompiLista();
  } catch (error: unknown) {
    console.error('[wompi] Webhook recibido con configuración incompleta:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'Servicio de pagos no configurado.' });
  }

  const evento = req.body as EventoWompi;
  const firma = esRegistro(evento?.signature) ? evento.signature : null;
  const checksumCuerpo = firma?.checksum;
  const checksumCabecera = req.get('x-event-checksum');
  const esperado = checksumEsperadoWompi(evento, wompi.secretoEventos);
  if (!esperado || !coincideChecksum(esperado, checksumCuerpo)
    || (checksumCabecera !== undefined && !coincideChecksum(esperado, checksumCabecera))) {
    console.warn('[wompi] Se ignoró un webhook con firma inválida.');
    return res.status(401).json({ error: 'Firma de evento inválida.' });
  }

  // Cada cuenta de Wompi debe tener su propia URL para sandbox y producción.
  // Un evento válido del otro ambiente no puede otorgar beneficios aquí.
  if (evento.event !== 'transaction.updated' || evento.environment !== wompi.ambiente) {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  const transaccion = leerTransaccionWompi(evento);
  if (!transaccion) {
    console.warn('[wompi] Evento firmado con una transacción incompleta.');
    return res.status(200).json({ ok: true, ignorado: true });
  }

  try {
    const { data: datoIntento, error: errorIntento } = await cliente
      .from('intentos_pago_wompi')
      .select('id,referencia,user_id,ciclo,monto_cop,moneda,ambiente,estado,checkout_vence_en,wompi_transaccion_id')
      .eq('referencia', transaccion.referencia)
      .maybeSingle();
    if (errorIntento) throw errorIntento;
    if (!datoIntento) {
      console.warn('[wompi] Se recibió una referencia que LukApp no creó:', transaccion.referencia);
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const intento = datoIntento as IntentoPagoWompi;
    if (intento.ambiente !== wompi.ambiente
      || intento.moneda !== transaccion.moneda
      || centavosWompi(Number(intento.monto_cop)) !== transaccion.montoCentavos
      || (intento.wompi_transaccion_id && intento.wompi_transaccion_id !== transaccion.id)) {
      console.warn('[wompi] El webhook no coincide con su intención interna:', transaccion.referencia);
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const ahora = new Date();
    let suscripcionId: number | null = null;
    if (transaccion.estado === 'APPROVED') {
      const { data: resultadoSuscripcion, error: errorSuscripcion } = await cliente.rpc('activar_premium_pasarela', {
        p_usuario: intento.user_id,
        p_ciclo: intento.ciclo,
        p_pasarela: 'wompi',
        p_referencia_externa: transaccion.id,
        p_valor_cobrado_cop: Number(intento.monto_cop),
        p_inicia_en: ahora.toISOString(),
        p_vence_en: vencimientoPremium(intento.ciclo, ahora),
      });
      if (errorSuscripcion || !resultadoSuscripcion) {
        throw new Error(errorSuscripcion?.message || 'No se pudo activar Premium después del pago.');
      }
      const suscripcion = Array.isArray(resultadoSuscripcion) ? resultadoSuscripcion[0] : resultadoSuscripcion;
      suscripcionId = Number((suscripcion as { id?: unknown }).id);
      if (!Number.isSafeInteger(suscripcionId) || suscripcionId <= 0) {
        throw new Error('La suscripción activada no devolvió un identificador válido.');
      }
    }

    const estado = estadoIntentoDesdeWompi(transaccion.estado);
    const esFinal = estado !== 'pendiente';
    const { error: errorActualizar } = await cliente
      .from('intentos_pago_wompi')
      .update({
        estado,
        wompi_transaccion_id: transaccion.id,
        suscripcion_id: suscripcionId,
        actualizado_en: ahora.toISOString(),
        finalizado_en: esFinal ? ahora.toISOString() : null,
      })
      .eq('id', intento.id);
    if (errorActualizar) throw errorActualizar;

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    // Un 500 hace que Wompi reintente. Es correcto para una caída de base o un
    // fallo transitorio: `activar_premium_pasarela` es idempotente por id de
    // transacción, de modo que el reintento no duplica el beneficio.
    console.error('Error procesando webhook de Wompi:', error);
    return res.status(500).json({ error: 'No se pudo registrar el evento.' });
  }
});

app.get('/api/superadmin/facturacion', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirPermiso(cliente, token, 'ver_facturacion');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const ahora = new Date().toISOString();
    const [
      { data: planes, error: errorPlanes },
      { data: suscripciones, error: errorSuscripciones },
      { data: perfil, error: errorPerfil },
      { data: beneficios, error: errorBeneficios },
    ] = await Promise.all([
      cliente
        .from('planes_suscripcion')
        .select('codigo,nombre,precio_mensual_cop,precio_anual_cop,limite_dictados_mensual,limite_asesor_ia_mensual,limite_extractos_mensual,limite_espacios_compartidos,limite_integrantes_por_espacio,activo,actualizado_en')
        .order('codigo'),
      cliente
        .from('suscripciones')
        .select('id,user_id,ciclo,origen,vence_en,cancelar_al_vencer,valor_cobrado_cop,creada_en')
        .eq('estado', 'activa')
        .lte('inicia_en', ahora)
        .gt('vence_en', ahora)
        .order('vence_en', { ascending: true }),
      cliente.from('perfiles').select('rol').eq('id', acceso.userId).single(),
      cliente.from('beneficios_plan').select('plan_codigo,clave,activo'),
    ]);
    if (errorPlanes) throw errorPlanes;
    if (errorSuscripciones) throw errorSuscripciones;
    if (errorPerfil) throw errorPerfil;
    if (errorBeneficios && !esMigracionCatalogoPendiente(errorBeneficios)) throw errorBeneficios;

    const planPremium = (planes ?? []).find((plan) => plan.codigo === 'premium');
    const activas = suscripciones ?? [];
    const mensuales = activas.filter((suscripcion) => suscripcion.ciclo === 'mensual').length;
    const anuales = activas.filter((suscripcion) => suscripcion.ciclo === 'anual').length;
    const cortesia = activas.filter((suscripcion) => suscripcion.ciclo === 'cortesia').length;
    const estimadoMensualCop = mensuales * Number(planPremium?.precio_mensual_cop ?? 0)
      + anuales * Math.round(Number(planPremium?.precio_anual_cop ?? 0) / 12);
    const esAdminFijo = perfil?.rol === 'admin';
    let wompi: { habilitada: boolean; ambiente: 'test' | 'prod' | null } = { habilitada: false, ambiente: null };
    try {
      const configuracion = configuracionWompiLista();
      wompi = { habilitada: true, ambiente: configuracion.ambiente };
    } catch {
      // La persona con permiso de facturación necesita saber si puede cobrar,
      // pero no necesita —ni debe recibir— cuál de los secretos falta.
    }

    // Un rol con "ver_facturacion" solo recibe agregados. Las identidades y
    // vigencias de cada persona las necesita el superadmin fijo para soporte,
    // pero no una persona a quien se le delegó el resumen contable.
    let detalle: Array<Record<string, unknown>> = [];
    let usuarios: Array<{ id: string; email: string; usuario: string | null }> = [];
    if (esAdminFijo) {
      const { data: perfiles, error: errorPerfiles } = await cliente
        .from('perfiles')
        .select('id,email,usuario')
        .order('email', { ascending: true });
      if (errorPerfiles) throw errorPerfiles;
      const porId = new Map((perfiles ?? []).map((persona) => [persona.id, persona]));
      detalle = activas.map((suscripcion) => ({
        ...suscripcion,
        usuario: porId.get(suscripcion.user_id) ?? null,
      }));
      usuarios = perfiles ?? [];
    }

    const usarCompatibilidad = Boolean(errorBeneficios);
    return res.status(200).json({
      planes: (planes ?? []).map((plan) => ({
        ...plan,
        beneficios: usarCompatibilidad
          ? beneficiosCompatiblesConVersionAnterior(plan.codigo as CodigoPlan, limitesDePlan(plan))
          : beneficiosDePlan(
            (beneficios ?? []) as FilaBeneficioPlan[],
            plan.codigo as CodigoPlan,
            limitesDePlan(plan),
          ),
      })),
      resumen: {
        premiumActivas: activas.length,
        mensuales,
        anuales,
        cortesia,
        estimadoMensualCop,
      },
      puedeAdministrar: esAdminFijo,
      pasarela: { codigo: 'wompi', ...wompi },
      suscripciones: detalle,
      usuarios,
    });
  } catch (error: any) {
    console.error('Error cargando facturación:', error);
    return res.status(500).json({ error: error.message || 'No se pudo cargar la facturación.' });
  }
});

app.put('/api/superadmin/planes/:codigo', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const codigo = req.params.codigo;
    if (codigo !== 'normal' && codigo !== 'premium') {
      return res.status(400).json({ error: 'Solo existen los planes Normal y Premium.' });
    }

    const configuracion = validarConfiguracionPlan(req.body);
    if (!configuracion.activo) {
      return res.status(400).json({ error: 'No se puede desactivar un plan: Normal debe estar siempre disponible y Premium debe respetar beneficios vigentes.' });
    }
    if (codigo === 'normal' && (configuracion.precioMensualCop !== 0 || configuracion.precioAnualCop !== 0)) {
      return res.status(400).json({ error: 'El plan Normal debe ser gratuito para siempre.' });
    }
    if (codigo === 'premium' && (configuracion.precioMensualCop <= 0 || configuracion.precioAnualCop <= 0)) {
      return res.status(400).json({ error: 'Premium debe conservar un precio mensual y anual mayor que cero.' });
    }

    const { data, error } = await cliente.rpc('actualizar_plan_con_beneficios', {
      p_codigo: codigo,
      p_precio_mensual_cop: configuracion.precioMensualCop,
      p_precio_anual_cop: configuracion.precioAnualCop,
      p_limite_dictados_mensual: configuracion.limiteDictadosMensual,
      p_limite_asesor_ia_mensual: configuracion.limiteAsesorIaMensual,
      p_limite_extractos_mensual: configuracion.limiteExtractosMensual,
      p_limite_espacios_compartidos: configuracion.limiteEspaciosCompartidos,
      p_limite_integrantes_por_espacio: configuracion.limiteIntegrantesPorEspacio,
      p_activo: configuracion.activo,
      p_beneficios: configuracion.beneficios,
      p_actor: acceso.userId,
    });
    if (error) {
      if (esMigracionCatalogoPendiente(error)) {
        return res.status(409).json({
          error: 'La configuración de prestaciones aún se está actualizando. Aplica la migración de Premium y vuelve a intentarlo.',
          codigo: 'migracion-premium-pendiente',
        });
      }
      throw error;
    }
    const plan = Array.isArray(data) ? data[0] : data;
    registrarAuditoria(acceso.email, 'Actualizó plan Freemium', codigo);
    return res.status(200).json({ plan });
  } catch (error: any) {
    console.error('Error actualizando plan:', error);
    return res.status(400).json({ error: error.message || 'No se pudo actualizar el plan.' });
  }
});

app.post('/api/superadmin/suscripciones/otorgar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }
    const venceEn = fechaPremiumValida(req.body?.venceEn);
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('otorgar_premium_manual', {
      p_usuario: userId,
      p_vence_en: venceEn,
      p_actor: acceso.userId,
      p_nota: nota || null,
    });
    if (error) throw error;
    registrarAuditoria(acceso.email, 'Otorgó Premium de cortesía', userId, `Hasta ${venceEn}`);
    return res.status(201).json({ suscripcion });
  } catch (error: any) {
    console.error('Error otorgando Premium:', error);
    return res.status(400).json({ error: error.message || 'No se pudo otorgar Premium.' });
  }
});

app.patch('/api/superadmin/suscripciones/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'La suscripción no es válida.' });
    const venceEn = fechaPremiumValida(req.body?.venceEn);
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('administrar_premium_superadmin', {
      p_suscripcion: id,
      p_accion: 'actualizar_vigencia',
      p_actor: acceso.userId,
      p_vence_en: venceEn,
      p_nota: nota || null,
    });
    if (error) throw error;
    registrarAuditoria(acceso.email, 'Actualizó vigencia de Premium', String(id), `Hasta ${venceEn}`);
    return res.status(200).json({ suscripcion });
  } catch (error: any) {
    console.error('Error actualizando vigencia de Premium:', error);
    return res.status(400).json({ error: error.message || 'No se pudo actualizar la vigencia de Premium.' });
  }
});

app.post('/api/superadmin/suscripciones/:id/cancelar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'La suscripción no es válida.' });
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('administrar_premium_superadmin', {
      p_suscripcion: id,
      p_accion: 'cancelar',
      p_actor: acceso.userId,
      p_nota: nota || null,
    });
    if (error) throw error;
    registrarAuditoria(acceso.email, 'Retiró Premium', String(id), 'El acceso fue retirado desde Facturación; el cobro histórico se conserva.');
    return res.status(200).json({ suscripcion });
  } catch (error: any) {
    console.error('Error cancelando Premium:', error);
    return res.status(400).json({ error: error.message || 'No se pudo cancelar Premium.' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Analizar Extracto Bancario
// ----------------------------------------------------------------------
const MAX_BYTES_PDF = 4 * 1024 * 1024; // 4MB

app.post('/api/analizar-extracto', async (req, res) => {
  const cliente = clienteAdmin();
  if (!exigirConfiguracionSegura(cliente, res, 'El análisis de extractos')) return;
  const token = req.headers.authorization?.replace('Bearer ', '');
  let userId: string | null = null;
  if (cliente) {
    if (!token) {
      return res.status(401).json({ ok: false, codigo: 'sin-autorizacion', mensaje: 'Inicia sesión para analizar extractos.' });
    }
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) {
      return res.status(acceso.status).json({ ok: false, codigo: 'sin-autorizacion', mensaje: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    userId = acceso.userId;
  }

  const { pdfBase64 } = req.body;
  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    return res.status(400).json({ ok: false, codigo: 'pdf-invalido', mensaje: 'No llegó el contenido del PDF.' });
  }

  const bytesReales = Math.floor((pdfBase64.length * 3) / 4);
  if (bytesReales > MAX_BYTES_PDF) {
    return res.status(413).json({
      ok: false,
      codigo: 'pdf-muy-grande',
      mensaje: `El PDF pesa ${(bytesReales / 1024 / 1024).toFixed(1)} MB y el límite es 4 MB.`,
    });
  }

  let textoCrudo: string;
  try {
    const parser = new PDFParse({ data: new Uint8Array(Buffer.from(pdfBase64, 'base64')) });
    const resultado = await parser.getText();
    textoCrudo = resultado.text;
    await parser.destroy();
  } catch {
    return res.status(422).json({
      ok: false,
      codigo: 'pdf-invalido',
      mensaje: 'No se pudo leer el texto del PDF. Puede estar corrupto o protegido con contraseña.',
    });
  }

  if (!textoCrudo.trim()) {
    return res.status(422).json({
      ok: false,
      codigo: 'pdf-invalido',
      mensaje: 'El PDF no tiene texto extraíble — probablemente es un escaneo sin capa de texto.',
    });
  }

  // Analizar un extracto desconocido puede requerir IA. El contador se toma
  // justo antes de esa parte costosa y se devuelve si el servicio falla o no
  // logra entregar un resultado útil; los errores del proveedor no se cobran.
  let cupoConsumido = false;
  if (cliente && userId) {
    try {
      const cupo = await consumirCupo(cliente, userId, 'extracto');
      if (!cupo.permitido) {
        return res.status(429).json({
          ok: false,
          codigo: 'cupo-agotado',
          mensaje: mensajeCupoAgotado('extracto', cupo),
        });
      }
      cupoConsumido = true;
    } catch (error) {
      console.error('No se pudo verificar el cupo del extracto:', error);
      return res.status(503).json({ ok: false, codigo: 'fallo-interno', mensaje: 'No se pudo verificar tu plan. Inténtalo de nuevo.' });
    }
  }

  try {
    // Un banco conocido debe pasar primero por su parser determinista. La IA
    // audita esa lectura después, pero no puede sustituirla silenciosamente.
    // Solo los formatos aún no soportados usan IA como lector principal.
    const banco = detectarBanco(textoCrudo);
    let resultado = banco ? analizarConPlantilla(textoCrudo) : null;
    if (resultado) {
      const validacion = await validarExtractoConIA(textoCrudo, resultado);
      if (validacion) {
        resultado = {
          ...resultado,
          advertencias: [...resultado.advertencias, ...validacion.advertencias],
          alertas: [...resultado.alertas, ...validacion.alertas],
        };
      }
    } else {
      resultado = await analizarExtractoConIA(textoCrudo);
    }
    if (!resultado) {
      if (cliente && userId && cupoConsumido) await devolverCupo(cliente, userId, 'extracto');
      return res.status(422).json({
        ok: false,
        codigo: 'sin-movimientos',
        mensaje: 'No se pudo leer ningún movimiento de este extracto. Verifica que el PDF tenga texto seleccionable y vuelve a intentarlo.',
      });
    }

    return res.status(200).json({ ok: true, resultado });
  } catch (error) {
    if (cliente && userId && cupoConsumido) await devolverCupo(cliente, userId, 'extracto');
    console.error('Error analizando extracto:', error);
    return res.status(500).json({
      ok: false,
      codigo: 'fallo-interno',
      mensaje: 'No se pudo analizar el extracto. Inténtalo de nuevo.',
    });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Asesor Financiero con Inteligencia Artificial (LLM)
// Soporta OpenAI, Anthropic Claude, Google Gemini, Groq y DeepSeek.
// Si no hay key configurada, responde { offline: true } para usar el motor local.
// ----------------------------------------------------------------------
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
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    version: process.env.npm_package_version || 'desconocida',
  });
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

app.post('/api/atajos/llave', async (req, res) => {
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

app.get('/api/atajos/llave', async (req, res) => {
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

app.post('/api/atajos/revocar', async (req, res) => {
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

app.post('/api/atajo/movimiento', async (req, res) => {
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

    const resultado = movimientoDesdeAtajo(req.body ?? {}, fila.user_id);
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

// ----------------------------------------------------------------------
// ASESOR E INSIGHTS FINANCIEROS CON IA (Groq / Grok / DeepSeek / Gemini / Claude / OpenAI)
// ----------------------------------------------------------------------
interface ConsultaIAParams {
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role?: string; content?: string; text?: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
}

interface ConsultaIAResult {
  texto: string;
  proveedor: string;
  modelo: string;
  fallos: string[];
}

function limpiarTextoIA(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let res = raw;
  // 1. Eliminar bloques <think>...</think> completos
  res = res.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 2. Si quedó una etiqueta <think> abierta sin cierre
  if (res.includes('<think>')) {
    res = res.replace(/<think>[\s\S]*/gi, '');
  }
  // 3. Eliminar posibles encabezados de pensamiento en inglés
  res = res.replace(/^Here('s| is) a thinking process:[\s\S]*?\n\n/i, '');
  res = res.replace(/^Thinking Process:[\s\S]*?\n\n/i, '');
  return res.trim();
}

const CATEGORIAS_EXTRACTO = new Set<string>(CATEGORIES);
const esFechaExtracto = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);

/**
 * Parses a statement format that has no local template. The model returns only
 * the evidence visible in the PDF; totals are recalculated below rather than
 * trusted from its prose so the person can audit every imported line.
 */
async function analizarExtractoConIA(textoCrudo: string): Promise<AnalisisResultado | null> {
  const textoLimitado = textoCrudo.slice(0, 75_000);
  const respuesta = await consultarModeloIA({
    temperature: 0,
    maxTokens: 8_000,
    responseFormat: { type: 'json_object' },
    systemPrompt: `Eres un lector preciso de extractos bancarios colombianos. Devuelve JSON, sin Markdown. Solo extrae filas que estén explícitas en el PDF. Nunca inventes comercio, fecha, monto, categoría ni referencia. Cada movimiento debe tener fecha YYYY-MM-DD, descripcion literal y legible, montoCop entero positivo, tipo gasto o ingreso, categoria entre: ${CATEGORIES.join(', ')}, confianza alta/media/baja, exclusion null/traslado-propio/pago-tarjeta/reverso/saldo-informativo, contraparte y detalle. detalle debe explicar brevemente por qué se asignó esa categoría y qué concepto del extracto se reconoció. Incluye periodo {desde,hasta,etiqueta}, veredicto, advertencias y movimientos.`,
    userPrompt: `Lee este texto extraído de un PDF bancario. Identifica la entidad aunque no esté en una lista previa y conserva cada movimiento por separado. Si una fecha o monto no se lee con seguridad, no lo inventes: omite la fila y explica la duda en advertencias.\n\n${textoLimitado}`,
  });
  if (!respuesta.texto) return null;

  let bruto: unknown;
  try {
    bruto = JSON.parse(respuesta.texto);
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== 'object') return null;
  const objeto = bruto as Record<string, unknown>;
  const movimientos: MovimientoExtraido[] = Array.isArray(objeto.movimientos)
    ? objeto.movimientos.flatMap((fila): MovimientoExtraido[] => {
        if (!fila || typeof fila !== 'object') return [];
        const mov = fila as Record<string, unknown>;
        const monto = Number(mov.montoCop);
        const tipo: TxKind | null = mov.tipo === 'gasto' || mov.tipo === 'ingreso' ? mov.tipo : null;
        const categoria = typeof mov.categoria === 'string' && CATEGORIAS_EXTRACTO.has(mov.categoria)
          ? mov.categoria as Category
          : 'otros';
        if (!esFechaExtracto(mov.fecha) || typeof mov.descripcion !== 'string' || !tipo || !Number.isFinite(monto) || monto <= 0) return [];
        return [{
          fecha: mov.fecha,
          descripcion: mov.descripcion.trim().slice(0, 180),
          montoCop: Math.round(monto),
          tipo,
          categoria,
          confianza: mov.confianza === 'alta' || mov.confianza === 'media' ? mov.confianza : 'baja',
          exclusion: mov.exclusion === 'traslado-propio' || mov.exclusion === 'pago-tarjeta' || mov.exclusion === 'reverso' || mov.exclusion === 'saldo-informativo' ? mov.exclusion : null,
          contraparte: typeof mov.contraparte === 'string' ? mov.contraparte.trim().slice(0, 120) || null : null,
          detalle: typeof mov.detalle === 'string' ? mov.detalle.trim().slice(0, 240) || null : null,
        }];
      })
    : [];
  if (movimientos.length === 0) return null;
  const ingresos = movimientos.filter((m) => m.exclusion === null && m.tipo === 'ingreso').reduce((total, m) => total + m.montoCop, 0);
  const gastos = movimientos.filter((m) => m.exclusion === null && m.tipo === 'gasto').reduce((total, m) => total + m.montoCop, 0);
  const periodo = objeto.periodo && typeof objeto.periodo === 'object' ? objeto.periodo as Record<string, unknown> : {};
  const advertencias = Array.isArray(objeto.advertencias) ? objeto.advertencias.filter((a): a is string => typeof a === 'string').slice(0, 8) : [];
  return {
    periodo: { desde: esFechaExtracto(periodo.desde) ? periodo.desde : '', hasta: esFechaExtracto(periodo.hasta) ? periodo.hasta : '', etiqueta: typeof periodo.etiqueta === 'string' ? periodo.etiqueta.slice(0, 80) : 'Extracto bancario' },
    veredicto: typeof objeto.veredicto === 'string' ? objeto.veredicto.slice(0, 500) : `Se reconocieron ${movimientos.length} movimientos para tu revisión.`,
    metricas: [{ etiqueta: 'Total ingresos', valorCop: ingresos, nota: null }, { etiqueta: 'Total gastos', valorCop: gastos, nota: null }, { etiqueta: 'Balance del período', valorCop: ingresos - gastos, nota: null }],
    alertas: [],
    recomendaciones: [],
    movimientos,
    advertencias: [...advertencias, `Lectura asistida por IA (${respuesta.proveedor || 'proveedor configurado'}). Revisa cada movimiento antes de importarlo.`],
  };
}

interface ValidacionExtractoIA {
  advertencias: string[];
  alertas: AnalisisResultado['alertas'];
}

/** Audits parser output against the PDF without being allowed to rewrite it. */
async function validarExtractoConIA(
  textoCrudo: string,
  resultado: AnalisisResultado,
): Promise<ValidacionExtractoIA | null> {
  const respuesta = await consultarModeloIA({
    temperature: 0,
    maxTokens: 1_500,
    responseFormat: { type: 'json_object' },
    systemPrompt: `Eres un auditor de extractos bancarios. Compara el texto original con la lista extraída por un parser determinista. Devuelve JSON con valido (boolean), discrepancias (array de strings) y filasDudosas (array de números, índices desde 0). No corrijas ni inventes datos. Marca si falta una fila, sobra una fila, un monto/signo/fecha no coincide o una exclusión parece incorrecta.`,
    userPrompt: `Texto original del extracto:\n${textoCrudo.slice(0, 75_000)}\n\nResultado del parser (fuente de verdad):\n${JSON.stringify(resultado.movimientos)}`,
  });
  if (!respuesta.texto) return null;

  try {
    const objeto = JSON.parse(respuesta.texto) as Record<string, unknown>;
    const discrepancias = Array.isArray(objeto.discrepancias)
      ? objeto.discrepancias.filter((d): d is string => typeof d === 'string').slice(0, 8)
      : [];
    const filasDudosas = Array.isArray(objeto.filasDudosas)
      ? objeto.filasDudosas.filter((i): i is number => Number.isInteger(i) && i >= 0)
      : [];
    if (objeto.valido === true && discrepancias.length === 0 && filasDudosas.length === 0) {
      return { advertencias: ['La IA validó que el parser coincide con el extracto.'], alertas: [] };
    }
    return {
      advertencias: [
        'La IA encontró diferencias o filas que requieren revisión. Los datos mostrados siguen siendo los del parser y no se corrigieron automáticamente.',
        ...discrepancias,
      ],
      alertas: [{
        severidad: 'alta',
        titulo: 'Revisión necesaria antes de importar',
        detalle: `${discrepancias.length + filasDudosas.length} posible${discrepancias.length + filasDudosas.length === 1 ? '' : 's'} diferencia${discrepancias.length + filasDudosas.length === 1 ? '' : 's'} detectada${discrepancias.length + filasDudosas.length === 1 ? '' : 's'} por la validación automática.`,
      }],
    };
  } catch {
    return {
      advertencias: ['La validación automática no pudo confirmar el resultado; revisa las filas antes de importar.'],
      alertas: [],
    };
  }
}

async function consultarModeloIA(params: ConsultaIAParams): Promise<ConsultaIAResult> {
  const {
    systemPrompt,
    userPrompt,
    history = [],
    maxTokens = 500,
    temperature = 0.6,
    responseFormat,
  } = params;
  type RespuestaChat = { choices?: { message?: { content?: string } }[] };
  type RespuestaGemini = { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  type RespuestaClaude = { content?: { text?: string }[] };
  const groqKey = process.env.GROQ_API_KEY;
  const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const historialAcotado = acotarHistorialAsesor(history);

  const fallos: string[] = [];
  let texto = '';
  let proveedor = '';
  let modelo = 'desconocido';

  // 1. Groq (modelos directos en español, sin volcar etiquetas de pensamiento)
  if (groqKey) {
    for (const modeloGroq of MODELOS_GROQ_ASESOR) {
      try {
        const bodyPayload: any = {
          model: modeloGroq.id,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          reasoning_effort: modeloGroq.esfuerzoRazonamiento,
        };
        if (responseFormat) {
          bodyPayload.response_format = responseFormat;
        }

        const res = await fetchConTiempoLimite('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify(bodyPayload),
        });
        if (res.ok) {
          const data = (await res.json()) as RespuestaChat;
          const raw = data.choices?.[0]?.message?.content || '';
          const cleaned = limpiarTextoIA(raw);
          if (cleaned) {
            texto = cleaned;
            proveedor = 'Groq';
            modelo = modeloGroq.id;
            break;
          }
          fallos.push(`groq-${modeloGroq.id}:sin-texto`);
        } else {
          fallos.push(`groq-${modeloGroq.id}:${res.status}`);
        }
      } catch (err: any) {
        fallos.push(`groq-${modeloGroq.id}:${err.message}`);
      }
    }
  }

  // 2. xAI Grok
  if (!texto && grokKey) {
    const grokModelos = ['grok-2', 'grok-beta'];
    for (const m of grokModelos) {
      try {
        const res = await fetchConTiempoLimite('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${grokKey}` },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: systemPrompt },
              ...historialAcotado,
              { role: 'user', content: userPrompt },
            ],
            temperature,
            max_tokens: maxTokens,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as RespuestaChat;
          const raw = data.choices?.[0]?.message?.content || '';
          const cleaned = limpiarTextoIA(raw);
          if (cleaned) {
            texto = cleaned;
            proveedor = 'xAI (Grok)';
            modelo = m;
            break;
          }
        } else {
          fallos.push(`grok-${m}:${res.status}`);
        }
      } catch (err: any) {
        fallos.push(`grok-${m}:${err.message}`);
      }
    }
  }

  // 3. DeepSeek
  if (!texto && deepseekKey) {
    try {
      const res = await fetchConTiempoLimite('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RespuestaChat;
        const raw = data.choices?.[0]?.message?.content || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'DeepSeek';
          modelo = 'deepseek-chat';
        }
      } else {
        fallos.push(`deepseek:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`deepseek:${err.message}`);
    }
  }

  // 4. OpenAI
  if (!texto && openaiKey) {
    try {
      const res = await fetchConTiempoLimite('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6).map((msg: any) => ({
              role: msg.role === 'bot' || msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.text || msg.content || '',
            })),
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RespuestaChat;
        const raw = data.choices?.[0]?.message?.content || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'OpenAI';
          modelo = 'gpt-4o-mini';
        }
      } else {
        fallos.push(`openai:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`openai:${err.message}`);
    }
  }

  // 5. Google Gemini
  if (!texto && geminiKey) {
    try {
      const res = await fetchConTiempoLimite(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...historialAcotado.map((mensaje) => ({
              role: mensaje.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: mensaje.content }],
            })),
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RespuestaGemini;
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'Google Gemini';
          modelo = 'gemini-1.5-flash';
        }
      } else {
        fallos.push(`gemini:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`gemini:${err.message}`);
    }
  }

  // 6. Anthropic Claude
  if (!texto && anthropicKey) {
    try {
      const clRes = await fetchConTiempoLimite('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          system: systemPrompt,
          messages: [
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
        }),
      });
      if (clRes.ok) {
        const data = (await clRes.json()) as RespuestaClaude;
        const raw = data.content?.[0]?.text || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'Claude Haiku';
          modelo = 'claude-3-5-haiku-20241022';
        }
      } else {
        fallos.push(`claude:${clRes.status}`);
      }
    } catch (err: any) {
      fallos.push(`claude:${err.message}`);
    }
  }

  return { texto, proveedor, modelo, fallos };
}

/** Persistencia del asesor: el servidor valida identidad y Supabase aplica RLS. */
app.get('/api/asesor/conversaciones', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { data, error } = await cliente.from('ia_conversaciones').select('*').eq('usuario_id', quien.userId).order('actualizado_en', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: 'No se pudieron cargar las conversaciones.' });
  return res.json({ conversaciones: data ?? [] });
});

app.post('/api/asesor/conversaciones', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.slice(0, 120) : 'Nueva conversación';
  const { data, error } = await cliente.from('ia_conversaciones').insert({ usuario_id: quien.userId, titulo }).select().single();
  if (error) return res.status(500).json({ error: 'No se pudo crear la conversación.' });
  return res.status(201).json({ conversacion: data });
});

app.get('/api/asesor/conversaciones/:id/mensajes', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });

  const { data: conversacion, error: errorConversacion } = await cliente
    .from('ia_conversaciones')
    .select('id')
    .eq('id', req.params.id)
    .eq('usuario_id', quien.userId)
    .maybeSingle();
  if (errorConversacion) return res.status(500).json({ error: 'No se pudo validar la conversación.' });
  if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada.' });

  const { data, error } = await cliente
    .from('ia_mensajes')
    .select('id,rol,texto,proveedor,creado_en')
    .eq('conversacion_id', conversacion.id)
    .eq('usuario_id', quien.userId)
    .order('creado_en', { ascending: true })
    .limit(300);
  if (error) return res.status(500).json({ error: 'No se pudieron cargar los mensajes.' });
  return res.json({ mensajes: data ?? [] });
});

app.post('/api/asesor/mensajes', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { conversacionId, rol, texto, proveedor } = req.body ?? {};
  if (typeof conversacionId !== 'string' || !['user', 'assistant'].includes(rol) || typeof texto !== 'string' || !texto.trim()) return res.status(400).json({ error: 'Mensaje inválido.' });
  const { data: conversacion } = await cliente.from('ia_conversaciones').select('id').eq('id', conversacionId).eq('usuario_id', quien.userId).maybeSingle();
  if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada.' });
  const { error } = await cliente.from('ia_mensajes').insert({ conversacion_id: conversacionId, usuario_id: quien.userId, rol, texto: texto.slice(0, 12000), proveedor: typeof proveedor === 'string' ? proveedor.slice(0, 80) : null });
  if (error) return res.status(500).json({ error: 'No se pudo guardar el mensaje.' });
  await cliente.from('ia_conversaciones').update({ actualizado_en: new Date().toISOString() }).eq('id', conversacionId).eq('usuario_id', quien.userId);
  return res.status(201).json({ ok: true });
});

app.get('/api/asesor/memoria', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { data, error } = await cliente.from('ia_memoria_usuario').select('id,clave,valor,fuente,activa,actualizado_en').eq('usuario_id', quien.userId).eq('activa', true).order('actualizado_en', { ascending: false });
  if (error) return res.status(500).json({ error: 'No se pudo cargar la memoria.' });
  return res.json({ memoria: data ?? [] });
});

app.delete('/api/asesor/memoria/:id', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { error } = await cliente.from('ia_memoria_usuario').update({ activa: false }).eq('id', req.params.id).eq('usuario_id', quien.userId);
  if (error) return res.status(500).json({ error: 'No se pudo olvidar ese dato.' });
  return res.json({ ok: true });
});

app.post('/api/asesor-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  let sesionVerificada: { userId: string; email: string } | null = null;
  if (!exigirConfiguracionSegura(cliente, res, 'El Asesor IA')) return;
  if (cliente && !token) {
    return res.status(401).json({ error: 'Inicia sesión para usar una consulta del Asesor IA.' });
  }
  if (cliente && token) {
    const quienLlama = await exigirUsuario(cliente, token);
    if ('status' in quienLlama) {
      return res.status(quienLlama.status).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    sesionVerificada = quienLlama;
  }
  const { prompt, history, finanzasContext, memoriaUsuario, idConsulta } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Falta el prompt del usuario' });
  }
  let usuarioEmail = 'usuario_local';
  let userId = 'local_user';
  let cupoConsumido = false;
  let perfilFinancieroCompleto: Record<string, unknown> | null = null;

  if (cliente && sesionVerificada) {
    usuarioEmail = sesionVerificada.email || 'usuario';
    userId = sesionVerificada.userId;
    try {
      // En una sesión autenticada el asesor no confía en un resumen enviado
      // por el navegador: relee el historial financiero de su dueña desde el
      // servidor. El filtro user_id es obligatorio incluso con service_role.
      perfilFinancieroCompleto = await leerPerfilFinancieroParaIA(cliente, userId);

      const cupo = await consumirCupo(cliente, userId, 'asesor_ia');
      if (!cupo.permitido) {
        return res.status(429).json({ error: mensajeCupoAgotado('asesor_ia', cupo), codigo: 'cupo-agotado' });
      }
      cupoConsumido = true;
    } catch (error) {
      console.error('No se pudo verificar el cupo del Asesor:', error);
      return res.status(503).json({ error: 'No se pudo preparar tu perfil financiero. Inténtalo de nuevo.' });
    }
  }

  const identificadorConsulta = typeof idConsulta === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(idConsulta)
    ? idConsulta
    : undefined;

  if (!cliente) {
    // Este aviso es deliberadamente explícito: el chat sigue funcionando, pero
    // el operador sabe por qué el panel no puede tener datos persistentes.
    console.error('[telemetria_ia] No hay SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY; la consulta del Asesor no podrá persistirse.');
  }

  /** El perfil contiene series extensas. Antes el límite era 60.000 caracteres
   * (unos 16.000 tokens), mayor que la cuota de 8.000 TPM de Groq: por eso la
   * IA rechazaba hasta saludos sencillos con HTTP 413. */
  const compactar = (valor: unknown, profundidad = 0): unknown => {
    if (profundidad > 5) return '[detalle omitido]';
    if (typeof valor === 'string') return valor.slice(0, 500);
    if (Array.isArray(valor)) {
      const muestra = valor.length > 16 ? [...valor.slice(0, 8), ...valor.slice(-8)] : valor;
      return muestra.map((item) => compactar(item, profundidad + 1));
    }
    if (valor && typeof valor === 'object') {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>)
          .slice(0, 60)
          .map(([clave, item]) => [clave, compactar(item, profundidad + 1)]),
      );
    }
    return valor;
  };
  const contextoCompleto = perfilFinancieroCompleto
    ? JSON.stringify(perfilFinancieroCompleto, null, 2)
    : finanzasContext
      ? JSON.stringify(compactar(finanzasContext), null, 2)
    : 'No hay datos financieros registrados aún.';
  const contextoParaModelo = recortarConMuestras(contextoCompleto, MAX_CARACTERES_CONTEXTO_ASESOR);
  const memoriaParaModelo = Array.isArray(memoriaUsuario)
    ? recortarConMuestras(
      memoriaUsuario
        .slice(0, 20)
        .map((dato: unknown) => `- ${String(dato).slice(0, 300)}`)
        .join('\n'),
      MAX_CARACTERES_MEMORIA_ASESOR,
    )
    : '';
  const preguntaParaModelo = recortarConMuestras(prompt.trim(), MAX_CARACTERES_PREGUNTA_ASESOR);

  const systemPrompt = `Eres un asesor financiero personal experto para Colombia dentro de la aplicación Finanzas.
Tu tono es empático, profesional, claro y directo.
IDIOMA OBLIGATORIO: Responde SIEMPRE 100% en ESPAÑOL (español de Colombia / latinoamericano). NUNCA respondas ni pienses en inglés.
ESTILO DIRECTO: NO incluyas etiquetas <think>, monólogos internos, introducciones ni explicaciones de tu proceso de pensamiento. Ve directo a la respuesta en español.
Tienes acceso al expediente financiero real del usuario:
${contextoParaModelo}
${memoriaParaModelo ? `
Memoria autorizada por el usuario (úsala solo para personalizar, nunca inventes datos):
${memoriaParaModelo}` : ''}

Reglas clave:
1. SÉ CONCISO Y DIRECTO (máximo 80 palabras). Si desglosas, usa máximo 3 viñetas cortas.
2. Responde lo que te preguntaron en español y para. No repitas la pregunta ni anuncies lo que vas a hacer.
3. NO cierres ofreciendo más ayuda genérica ni dando ánimos estilo "estoy aquí para ayudarte".
4. Nada de tablas markdown complejas ni bloques de código.
5. Usa contexto en pesos colombianos (COP).
6. Da recomendaciones realistas y accionables para Colombia (ahorro, cajitas, CDT, presupuestos, recorte de gastos hormiga).
7. No des recomendaciones de inversión de alto riesgo sin advertencias.
8. Si te cuentan algo personal o difícil, reconócelo en UNA frase y sigue con lo financiero.`;

  const inicio = Date.now();
  try {
    const { texto, proveedor, modelo, fallos } = await consultarModeloIA({
      systemPrompt,
      userPrompt: preguntaParaModelo,
      history: Array.isArray(history) ? history : [],
      maxTokens: 500,
      temperature: 0.6,
    });

    const duracionMs = Date.now() - inicio;
    const promptTokens = Math.ceil((preguntaParaModelo.length + systemPrompt.length) / 3.8);
    const completionTokens = Math.ceil((texto?.length || 0) / 3.8);
    const totalTokens = promptTokens + completionTokens;

    if (texto) {
      if (cliente) {
        await registrarUsoIA(
          {
            usuarioEmail,
            proveedor,
            modelo,
            promptTokens,
            completionTokens,
            totalTokens,
            duracionMs,
            exito: true,
            promptText: prompt,
            respuestaTexto: texto,
          },
          cliente,
          userId,
          identificadorConsulta,
        );
      }

      return res.status(200).json({
        success: true,
        text: texto,
        provider: proveedor,
        offline: false,
      });
    }

    const motivo = fallos.length > 0 ? fallos.join(',') : 'sin-llave-configurada';
    if (cliente) {
      await registrarUsoIA(
        {
          usuarioEmail,
          proveedor: proveedor || 'Ninguno',
          modelo: modelo || 'local',
          promptTokens,
          completionTokens: 0,
          totalTokens: promptTokens,
          duracionMs,
          exito: false,
          motivo,
          promptText: prompt,
          respuestaTexto: `[Consulta respondida por el motor local heurístico: ${motivo}]`,
        },
        cliente,
        userId,
        identificadorConsulta,
      );
    }

    console.error(`[asesor] Ningún proveedor respondió — motivo: ${motivo}`);
    if (cliente && cupoConsumido) await devolverCupo(cliente, userId, 'asesor_ia');
    return res.status(200).json({ offline: true, motivo });
  } catch (error: any) {
    console.error('Error en asesor IA:', error);
    // Un fallo inesperado del proveedor también es una consulta al Asesor. Si
    // no se registra aquí, el chat cae al respaldo local pero el monitor queda
    // congelado en una entrada antigua.
    if (cliente) {
      const duracionMs = Date.now() - inicio;
      const promptTokens = Math.ceil(((prompt?.length || 0) + contextoParaModelo.length) / 3.8);
      await registrarUsoIA({
        usuarioEmail,
        proveedor: 'Ninguno',
        modelo: 'local',
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
        duracionMs,
        exito: false,
        motivo: error?.message || 'fallo-inesperado',
        promptText: prompt,
        respuestaTexto: '[Consulta atendida por el motor local tras un fallo del servicio IA]',
      }, cliente, userId, identificadorConsulta);
    }
    if (cliente && cupoConsumido) await devolverCupo(cliente, userId, 'asesor_ia');
    return res.status(200).json({ offline: true, error: error.message });
  }
});

// El navegador usa esta ruta únicamente si la pregunta ya enviada acabó en el
// motor local por timeout o un error de red. Es intencionalmente una ruta del
// Asesor (no de visitas ni de impersonación), y comparte idConsulta con la
// petición principal para que la telemetría sea idempotente.
app.post('/api/asesor-ia/respaldo-local', rateLimiter(12, 60000), async (req, res) => {
  const { idConsulta, prompt, motivo } = req.body ?? {};
  if (typeof idConsulta !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(idConsulta)
    || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Respaldo local inválido.' });
  }

  const cliente = clienteAdmin();
  if (!cliente) {
    console.error('[telemetria_ia] No se pudo registrar respaldo local: falta configuración de Supabase.');
    return res.status(202).json({ persistida: false });
  }

  let usuarioEmail = 'usuario_local';
  let userId = 'local_user';
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const quienLlama = await exigirUsuario(cliente, token);
    if (!('status' in quienLlama)) {
      usuarioEmail = quienLlama.email || 'usuario';
      userId = quienLlama.userId;
    }
  }

  await registrarUsoIA({
    usuarioEmail,
    proveedor: 'Respaldo local',
    modelo: 'Motor de Reglas Heurístico',
    promptTokens: Math.ceil(prompt.length / 3.8),
    completionTokens: 0,
    totalTokens: Math.ceil(prompt.length / 3.8),
    duracionMs: 0,
    exito: false,
    motivo: typeof motivo === 'string' ? motivo.slice(0, 300) : 'error-cliente',
    promptText: prompt.slice(0, 12000),
    respuestaTexto: '[Consulta atendida por el motor local en el cliente]',
  }, cliente, userId, idConsulta);
  return res.status(202).json({ persistida: true });
});

type InsightPersonalizado = {
  id: string;
  titulo: string;
  detalle: string;
  tono: 'neutral' | 'bien' | 'atento';
  seccion: 'mes' | 'dinero' | null;
  origenIa: true;
};

const tonoInsight = (valor: unknown): InsightPersonalizado['tono'] =>
  valor === 'bien' || valor === 'atento' ? valor : 'neutral';

const seccionInsight = (valor: unknown): InsightPersonalizado['seccion'] =>
  valor === 'mes' || valor === 'dinero' ? valor : null;

const normalizarInsightsPersonalizados = (texto: string): InsightPersonalizado[] => {
  try {
    const json = texto.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parseado = JSON.parse(json) as unknown;
    const lista = Array.isArray(parseado)
      ? parseado
      : parseado && typeof parseado === 'object' && Array.isArray((parseado as { insights?: unknown }).insights)
        ? (parseado as { insights: unknown[] }).insights
        : [];
    return lista
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, indice) => ({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.slice(0, 100) : `perfil-${indice}`,
        titulo: typeof item.titulo === 'string' ? item.titulo.trim().slice(0, 140) : '',
        detalle: typeof item.detalle === 'string' ? item.detalle.trim().slice(0, 300) : '',
        tono: tonoInsight(item.tono),
        seccion: seccionInsight(item.seccion),
        origenIa: true as const,
      }))
      .filter((item) => item.titulo && item.detalle)
      .slice(0, 4);
  } catch {
    return [];
  }
};

const leerPerfilFinancieroParaIA = async (cliente: ClienteAdmin, userId: string): Promise<Record<string, unknown>> => {
  const [transacciones, cajitas, movimientosCajitas, metas, categorias, presupuestos, recurrentes] = await Promise.all([
    cliente.from('transacciones').select('*').eq('user_id', userId),
    cliente.from('cajitas').select('*').eq('user_id', userId),
    cliente.from('cajita_movimientos').select('*').eq('user_id', userId),
    cliente.from('metas').select('*').eq('user_id', userId),
    cliente.from('categorias').select('*').eq('user_id', userId),
    cliente.from('presupuestos').select('*').eq('user_id', userId),
    cliente.from('recurrentes').select('*').eq('user_id', userId),
  ]);
  const respuestas = [transacciones, cajitas, movimientosCajitas, metas, categorias, presupuestos, recurrentes];
  const error = respuestas.find((respuesta) => respuesta.error)?.error;
  if (error) throw new Error(error.message);

  return construirPerfilFinancieroCompleto({
    transacciones: (transacciones.data ?? []) as FilaFinanciera[],
    cajitas: (cajitas.data ?? []) as FilaFinanciera[],
    movimientosCajitas: (movimientosCajitas.data ?? []) as FilaFinanciera[],
    metas: (metas.data ?? []) as FilaFinanciera[],
    categorias: (categorias.data ?? []) as FilaFinanciera[],
    presupuestos: (presupuestos.data ?? []) as FilaFinanciera[],
    recurrentes: (recurrentes.data ?? []) as FilaFinanciera[],
  });
};

const insightsGuardados = (datos: unknown, huella: string): InsightPersonalizado[] | null => {
  if (!datos || typeof datos !== 'object') return null;
  const cache = datos as { version?: unknown; huella?: unknown; insights?: unknown };
  if (cache.version !== 1 || cache.huella !== huella || !Array.isArray(cache.insights)) return null;
  const insights = cache.insights
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, indice) => ({
      id: typeof item.id === 'string' ? item.id.slice(0, 100) : `perfil-${indice}`,
      titulo: typeof item.titulo === 'string' ? item.titulo.slice(0, 140) : '',
      detalle: typeof item.detalle === 'string' ? item.detalle.slice(0, 300) : '',
      tono: tonoInsight(item.tono),
      seccion: seccionInsight(item.seccion),
      origenIa: true as const,
    }))
    .filter((item) => item.titulo && item.detalle)
    .slice(0, 4);
  return insights.length > 0 ? insights : null;
};

// Genera sugerencias proactivas desde el expediente financiero completo de la
// cuenta autenticada. El navegador no manda el contexto ni puede escoger otro
// user_id: la API lo relee con service_role y lo limita al dueño de la sesión.
app.post('/api/finanzas-insights-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para generar recomendaciones con IA.' });
  if (!cliente) return res.status(503).json({ error: 'No se pudo verificar tu plan para las recomendaciones con IA.' });

  let userId: string;
  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    userId = acceso.userId;

    const plan = await estadoPlanDe(cliente, userId);
    if (!plan.beneficios.some((beneficio) => beneficio.clave === 'insights_ia' && beneficio.activo)) {
      return res.status(403).json({
        error: 'Las recomendaciones mensuales con IA no están incluidas en tu plan actual.',
        codigo: 'beneficio-no-incluido',
      });
    }
  } catch (error: any) {
    console.error('Error verificando Premium para los insights IA:', error);
    return res.status(503).json({ error: 'No se pudo verificar tu plan para las recomendaciones con IA.' });
  }

  let perfil: Record<string, unknown>;
  try {
    perfil = await leerPerfilFinancieroParaIA(cliente, userId);
  } catch (error: any) {
    console.error('Error cargando el perfil financiero personalizado:', error);
    return res.status(500).json({ error: 'No se pudo preparar tu perfil financiero para el Asesor.' });
  }
  const huella = huellaPerfilFinanciero(perfil);

  const { data: analisisPrevio, error: errorAnalisisPrevio } = await cliente
    .from('ia_analisis_usuario')
    .select('datos')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (errorAnalisisPrevio && !/does not exist|schema cache/i.test(errorAnalisisPrevio.message)) {
    console.error('Error leyendo el análisis personalizado guardado:', errorAnalisisPrevio.message);
  }
  const cache = insightsGuardados(analisisPrevio?.datos, huella);
  if (cache) {
    return res.status(200).json({ success: true, insights: cache, provider: 'Análisis personalizado guardado' });
  }

  const systemPrompt = `Eres el asesor financiero personal y proactivo de una persona en Colombia dentro de LukApp.
Recibes un expediente financiero detallado, construido desde el historial completo de ESA persona: movimientos recientes, tendencias de todos los meses, cuentas, deudas, tarjetas, metas, presupuestos y pagos recurrentes.
Analiza solo la información suministrada. No inventes cifras ni asumas movimientos que no aparecen. Si faltan datos, dilo con claridad. Genera entre 2 y 4 sugerencias concretas, personalizadas y accionables, sin necesidad de que la persona pregunte por chat.

Reglas obligatorias:
1. Devuelve ÚNICAMENTE un array JSON con objetos de la estructura:
[
  {
    "id": "ai-string-unico",
    "titulo": "Título corto con dato concreto o emoji",
    "detalle": "Explicación directa o recomendación pragmática con cifras en pesos colombianos (COP)",
    "tono": "neutral" | "bien" | "atento",
    "seccion": "mes" | "dinero" | null
 }
]
2. Menciona evidencia concreta cuando exista (fecha, categoría, monto, cuota o tendencia), pero no repitas datos innecesarios.
3. Prioriza riesgos de liquidez, pagos próximos, deudas, metas atrasadas, presupuestos y hábitos recurrentes antes que consejos genéricos.
4. Tono directo, empático y colombiano. Máximo 36 palabras por detalle.
5. No recomiendes inversiones de alto riesgo ni prometas resultados.`;

  const userPrompt = `Expediente financiero real de la persona:\n${JSON.stringify(perfil)}\n\nGenera los insights en formato JSON.`;

  try {
    const { texto, proveedor, modelo, fallos } = await consultarModeloIA({
      systemPrompt,
      userPrompt,
      maxTokens: 500,
      temperature: 0.75,
    });

    if (texto) {
      const insights = normalizarInsightsPersonalizados(texto);
      if (insights.length > 0) {
        const resumen = insights.map((insight) => `${insight.titulo}: ${insight.detalle}`).join('\n');
        const { error: errorGuardar } = await cliente.from('ia_analisis_usuario').upsert({
          usuario_id: userId,
          resumen,
          datos: { version: 1, huella, insights },
          generado_en: new Date().toISOString(),
        });
        if (errorGuardar) console.error('Error guardando el análisis personalizado:', errorGuardar.message);

        const promptTokens = Math.ceil((userPrompt.length + systemPrompt.length) / 3.8);
        const completionTokens = Math.ceil(texto.length / 3.8);
        await registrarUsoIA({
          usuarioEmail: 'asesor-personalizado',
          proveedor,
          modelo,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          duracionMs: 0,
          exito: true,
          promptText: '[Análisis proactivo con perfil financiero completo]',
          respuestaTexto: resumen,
        }, cliente, userId);
        return res.status(200).json({
          success: true,
          insights,
          provider: proveedor,
          model: modelo,
        });
      }
    }

    return res.status(200).json({ success: false, offline: true, fallos });
  } catch (error: any) {
    console.error('Error generando insights con IA:', error);
    return res.status(200).json({ success: false, offline: true, error: error.message });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Transcribir Audio
// ----------------------------------------------------------------------
app.post('/api/transcribir', async (req, res) => {
  const cliente = clienteAdmin();
  if (!exigirConfiguracionSegura(cliente, res, 'La transcripción')) return;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const tipo = req.headers['content-type'] ?? 'audio/webm';
  const modo: ModoTranscripcion =
    req.headers['x-lukapp-transcription-mode'] === 'parcial' ? 'parcial' : 'final';
  let userId: string | null = null;
  let cupoConsumido = false;
  try {
    const audioBuffer = req.body as Buffer;
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      return res.status(200).json({ offline: true, error: 'No llegó audio' });
    }
    if (audioBuffer.length > MAX_BYTES_AUDIO) {
      return res.status(413).json({ offline: true, error: 'El audio supera el límite de 8 MB.' });
    }

    // La transcripción parcial era solo un adorno de texto en pantalla, pero
    // podía disparar varias llamadas a Whisper por una sola nota. Se desactiva
    // antes de tocar cualquier proveedor o cupo; la transcripción final sigue
    // siendo la que la persona confirma y registra.
    if (modo === 'parcial') {
      return res.status(200).json({ offline: true, error: 'La vista previa por voz no está disponible.' });
    }

    if (cliente) {
      if (!token) return res.status(401).json({ offline: true, error: 'Inicia sesión para usar el registro por voz.' });
      const acceso = await exigirUsuario(cliente, token);
      if ('error' in acceso) return res.status(acceso.status).json({ offline: true, error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
      userId = acceso.userId;

      // Los segmentos parciales son una ayuda visual y no se cobran. Solo la
      // transcripción final, la que termina en un registro, usa el cupo.
      if (modo === 'final') {
        const cupo = await consumirCupo(cliente, userId, 'dictado');
        if (!cupo.permitido) {
          return res.status(429).json({ offline: true, error: mensajeCupoAgotado('dictado', cupo), codigo: 'cupo-agotado' });
        }
        cupoConsumido = true;
      }
    }

    const cabeceraVocabulario = req.headers['x-lukapp-vocabulario'];
    const vocabulario = leerVocabularioPersonal(
      Array.isArray(cabeceraVocabulario) ? cabeceraVocabulario[0] : cabeceraVocabulario,
    );
    const resultado = await transcribirAudio(
      new Blob([audioBuffer], { type: tipo }),
      tipo,
      {
        entorno: process.env,
        modo,
        vocabulario,
        onError: (mensaje) => console.error(mensaje),
      },
    );

    if (cliente && userId && cupoConsumido && ('offline' in resultado || !resultado.text)) {
      await devolverCupo(cliente, userId, 'dictado');
    }

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error('Error en transcripción:', error);
    if (cliente && userId && cupoConsumido) await devolverCupo(cliente, userId, 'dictado');
    return res.status(200).json({
      offline: true,
      error: error instanceof Error ? error.message : 'No se pudo transcribir',
    });
  }
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
