/**
 * Registro del consumo de IA: lo que alimenta Superadmin → IA & Tokens. Guarda
 * en memoria lo del día y lo persiste en telemetria_ia para sobrevivir reinicios.
 */
import { type ClienteAdmin, fechaBogotaHoy } from './nucleo.ts';
import { type CuotaProveedorIA } from './usoProveedorIA.ts';

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
  cuotaProveedor?: CuotaProveedorIA;
  motivo?: string;
  promptText?: string;
  respuestaTexto?: string;
}

export interface MetricasIAStore {
  fechaActual: string;
  tokensHoy: number;
  llamadasHoy: number;
  llamadasExitosasHoy: number;
  llamadasFallbackHoy: number;
  latenciasMs: number[];
  ultimaCuotaProveedor: (CuotaProveedorIA & { observadaEn: string }) | null;
  peticionesRecientes: PeticionIA[];
}

export const metricasIA: MetricasIAStore = {
  fechaActual: fechaBogotaHoy(),
  tokensHoy: 0,
  llamadasHoy: 0,
  llamadasExitosasHoy: 0,
  llamadasFallbackHoy: 0,
  latenciasMs: [],
  ultimaCuotaProveedor: null,
  peticionesRecientes: [],
};

export const asegurarDiaActualMetricas = () => {
  const hoy = fechaBogotaHoy();
  if (metricasIA.fechaActual !== hoy) {
    metricasIA.fechaActual = hoy;
    metricasIA.tokensHoy = 0;
    metricasIA.llamadasHoy = 0;
    metricasIA.llamadasExitosasHoy = 0;
    metricasIA.llamadasFallbackHoy = 0;
    metricasIA.latenciasMs = [];
    metricasIA.ultimaCuotaProveedor = null;
  }
};

export const registrarUsoIA = async (
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
    if (peticion.cuotaProveedor) {
      metricasIA.ultimaCuotaProveedor = {
        ...peticion.cuotaProveedor,
        observadaEn: registro.timestamp,
      };
    }
  } else {
    metricasIA.llamadasFallbackHoy += 1;
  }

  metricasIA.peticionesRecientes.unshift(registro);
  if (metricasIA.peticionesRecientes.length > 50) metricasIA.peticionesRecientes.pop();

  // Persistencia en Supabase: si la tabla existe, el historial sobrevive a cualquier reinicio del servidor
  if (cliente) {
    const filaBase = {
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
    };
    const filaConCuota = {
      ...filaBase,
      limite_tokens_minuto: registro.cuotaProveedor?.limiteTokensMinuto ?? null,
      tokens_restantes_minuto: registro.cuotaProveedor?.tokensRestantesMinuto ?? null,
      limite_solicitudes_dia: registro.cuotaProveedor?.limiteSolicitudesDia ?? null,
      solicitudes_restantes_dia: registro.cuotaProveedor?.solicitudesRestantesDia ?? null,
      cuota_proveedor_observada_en: registro.cuotaProveedor ? registro.timestamp : null,
    };

    try {
      let { error } = await cliente
        .from('telemetria_ia')
        .upsert(filaConCuota, { onConflict: 'id', ignoreDuplicates: true });
      // El código puede desplegarse antes de que se ejecute la migración nueva.
      // En ese intervalo seguimos guardando los tokens reales, aunque la
      // fotografía de la cuota todavía no tenga columnas donde persistirse.
      if (error?.code === '42703' || error?.code === 'PGRST204') {
        ({ error } = await cliente
          .from('telemetria_ia')
          .upsert(filaBase, { onConflict: 'id', ignoreDuplicates: true }));
      }
      if (error) {
        console.error('[telemetria_ia] No se pudo persistir la consulta del Asesor:', {
          codigo: error.code,
          mensaje: error.message,
          idConsulta: registro.id,
        });
      }
    } catch (error) {
      console.error('[telemetria_ia] Error de red al persistir la consulta del Asesor:', {
        idConsulta: registro.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

// ----------------------------------------------------------------------
// ENDPOINT: Métricas de IA y Consumo de Tokens (Superadmin)
// ----------------------------------------------------------------------
export type ConsumoUsuarioIA = {
  usuarioEmail: string;
  consultas: number;
  exitosas: number;
  locales: number;
  tokens: number;
};

export type FilaTelemetriaIA = {
  id: string;
  creado_en: string;
  usuario_email: string;
  proveedor: string;
  modelo: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duracion_ms: number;
  exito: boolean;
  motivo?: string | null;
  prompt_texto?: string | null;
  respuesta_texto?: string | null;
  limite_tokens_minuto?: number | null;
  tokens_restantes_minuto?: number | null;
  limite_solicitudes_dia?: number | null;
  solicitudes_restantes_dia?: number | null;
  cuota_proveedor_observada_en?: string | null;
  [campo: string]: unknown;
};

export const cuotaProveedorDesdeFila = (fila: Record<string, unknown>): (CuotaProveedorIA & { observadaEn: string }) | null => {
  const numero = (valor: unknown): number | null => {
    if (valor === null || valor === undefined || valor === '') return null;
    const convertido = Number(valor);
    return Number.isFinite(convertido) && convertido >= 0 ? convertido : null;
  };
  const cuota: CuotaProveedorIA = {
    limiteTokensMinuto: numero(fila.limite_tokens_minuto),
    tokensRestantesMinuto: numero(fila.tokens_restantes_minuto),
    limiteSolicitudesDia: numero(fila.limite_solicitudes_dia),
    solicitudesRestantesDia: numero(fila.solicitudes_restantes_dia),
  };
  if (!Object.values(cuota).some((valor) => valor !== null)) return null;
  return {
    ...cuota,
    observadaEn: typeof fila.cuota_proveedor_observada_en === 'string'
      ? fila.cuota_proveedor_observada_en
      : typeof fila.creado_en === 'string' ? fila.creado_en : new Date(0).toISOString(),
  };
};

export const consumoPorUsuarioDesdePeticiones = (peticiones: PeticionIA[]): ConsumoUsuarioIA[] => {
  const porUsuario = new Map<string, Omit<ConsumoUsuarioIA, 'usuarioEmail'>>();
  peticiones.forEach((peticion) => {
    const usuario = peticion.usuarioEmail || 'usuario_local';
    const actual = porUsuario.get(usuario) || { consultas: 0, exitosas: 0, locales: 0, tokens: 0 };
    actual.consultas += 1;
    if (peticion.exito) {
      actual.exitosas += 1;
      actual.tokens += Number(peticion.totalTokens) || 0;
    } else {
      actual.locales += 1;
    }
    porUsuario.set(usuario, actual);
  });
  return Array.from(porUsuario.entries())
    .map(([usuarioEmail, datos]) => ({ usuarioEmail, ...datos }))
    .sort((a, b) => b.tokens - a.tokens || b.consultas - a.consultas || a.usuarioEmail.localeCompare(b.usuarioEmail));
};

// PostgREST suele limitar una respuesta a mil filas. Paginar evita que el
// desglose por usuario deje de contar consultas silenciosamente al crecer el
// día. Cincuenta mil supera con margen el límite HTTP del Asesor y, si alguna
// vez se alcanza, el panel lo informa en lugar de mostrar un total incompleto.
export const TAMANO_PAGINA_TELEMETRIA_IA = 1_000;
export const MAX_FILAS_TELEMETRIA_IA_HOY = 50_000;

export const cargarTelemetriaIADeHoy = async (cliente: ClienteAdmin, inicioHoyIso: string) => {
  const filas: FilaTelemetriaIA[] = [];
  let desde = 0;

  while (filas.length < MAX_FILAS_TELEMETRIA_IA_HOY) {
    const { data, error } = await cliente
      .from('telemetria_ia')
      .select('*')
      .gte('creado_en', inicioHoyIso)
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + TAMANO_PAGINA_TELEMETRIA_IA - 1);

    if (error) return { filas, error, truncada: false };
    const pagina = (data ?? []) as FilaTelemetriaIA[];
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA_TELEMETRIA_IA) return { filas, error: null, truncada: false };
    desde += pagina.length;
  }

  return { filas, error: null, truncada: true };
};
