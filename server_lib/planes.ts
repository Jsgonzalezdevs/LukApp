/**
 * Planes, beneficios y cupos de uso, y la traducción de los eventos de Wompi.
 * Lo usan tanto las rutas de pagos como las que gastan cupo (Asesor, voz,
 * extractos).
 */
import { type BeneficioPlan, type ClaveBeneficioPlan, type CodigoPlan, type LimitesPlan, type RecursoDeCupo, type ResultadoCupo, beneficiosDelPlan, esClaveBeneficioPlan } from './suscripciones.ts';
import { type ClienteAdmin, enteroPositivoSeguro, esRegistro, fechaBogotaHoy, textoNoVacio } from './nucleo.ts';
import { type EventoWompi, configuracionWompi } from './wompi.ts';

export interface EstadoPlanServidor {
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

export type CicloDePago = 'mensual' | 'anual';

export interface IntentoPagoWompi {
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

export interface TransaccionWompi {
  id: string;
  referencia: string;
  montoCentavos: number;
  moneda: 'COP';
  estado: 'APPROVED' | 'PENDING' | 'DECLINED' | 'VOIDED' | 'ERROR';
}

export const leerTransaccionWompi = (evento: EventoWompi): TransaccionWompi | null => {
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

export const vencimientoPremium = (ciclo: CicloDePago, iniciaEn: Date): string => {
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

export const estadoIntentoDesdeWompi = (estado: TransaccionWompi['estado']): IntentoPagoWompi['estado'] => ({
  APPROVED: 'aprobado',
  PENDING: 'pendiente',
  DECLINED: 'rechazado',
  VOIDED: 'anulado',
  ERROR: 'error',
})[estado];

export const configuracionWompiLista = () => configuracionWompi(process.env);

export type FilaBeneficioPlan = { plan_codigo: string; clave: string; activo: boolean };

/**
 * Durante un despliegue el servidor nuevo puede iniciar unos segundos antes
 * que la migración que crea el catálogo. Conservamos los beneficios que ya
 * existían antes de dicho catálogo para no desconectar el Asesor ni la cuenta
 * mientras termina la actualización de la base.
 */
export const BENEFICIOS_ANTERIORES_AL_CATALOGO: Record<CodigoPlan, Partial<Record<ClaveBeneficioPlan, boolean>>> = {
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

export const esMigracionCatalogoPendiente = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const detalle = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const texto = [detalle.message, detalle.details, detalle.hint]
    .filter((valor): valor is string => typeof valor === 'string')
    .join(' ')
    .toLowerCase();
  return /beneficios_plan|actualizar_plan_con_beneficios/.test(texto)
    && /does not exist|could not find|schema cache|not found/.test(texto);
};

export const limitesDePlan = (plan: Record<string, unknown>): LimitesPlan => ({
  dictadosMensual: plan.limite_dictados_mensual === null ? null : Number(plan.limite_dictados_mensual),
  asesorIaMensual: plan.limite_asesor_ia_mensual === null ? null : Number(plan.limite_asesor_ia_mensual),
  extractosMensual: plan.limite_extractos_mensual === null ? null : Number(plan.limite_extractos_mensual),
  espaciosCompartidos: plan.limite_espacios_compartidos === null ? null : Number(plan.limite_espacios_compartidos),
  integrantesPorEspacio: plan.limite_integrantes_por_espacio === null ? null : Number(plan.limite_integrantes_por_espacio),
});

export const beneficiosDePlan = (
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

export const beneficiosCompatiblesConVersionAnterior = (codigo: CodigoPlan, limites: LimitesPlan): BeneficioPlan[] =>
  beneficiosDelPlan(BENEFICIOS_ANTERIORES_AL_CATALOGO[codigo], limites);

/** Ejecuta el contador atómico de PostgreSQL antes de gastar IA, voz o PDF. */
export const consumirCupo = async (
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

export const devolverCupo = async (
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
export const estadoPlanDe = async (cliente: ClienteAdmin, userId: string): Promise<EstadoPlanServidor> => {
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

// Mientras la migración del aviso no esté aplicada, la columna no existe. Eso
// no es un error para la persona: simplemente todavía no hay regalo que mostrar.
export const esColumnaRegaloPendiente = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) && (error!.code === '42703' || error!.code === 'PGRST204' || /regalo_visto_en|mensaje_regalo/.test(error!.message ?? ''));
