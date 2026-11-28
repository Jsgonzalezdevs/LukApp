/**
 * Formas de datos del panel de superadmin, tal como llegan de la API.
 */
export interface Perfil {
  id: string;
  email: string;
  usuario: string | null;
  rol: 'admin' | 'usuario';
  rol_personalizado_id: string | null;
  created_at: string;
  ultimo_acceso_at: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetUser?: string;
  details?: string;
}

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

export interface MetricasIAResponse {
  fecha: string;
  proveedor: string;
  modelo: string;
  hayIA: boolean;
  tokensHoy: number;
  limiteTokensDiariosReferencia: number | null;
  llamadasHoy: number;
  llamadasExitosas: number;
  llamadasFallback: number;
  limiteTokensProveedorMinuto: number | null;
  tokensProveedorRestantesMinuto: number | null;
  limiteSolicitudesProveedorDia: number | null;
  solicitudesProveedorRestantesDia: number | null;
  porcentajeCapacidadTokens: number | null;
  cuotaProveedorObservadaEn: string | null;
  latenciaPromedioMs: number;
  costoEstimadoCop: number;
  origenMetricas: 'supabase' | 'memoria';
  diagnosticoTelemetria: string | null;
  peticionesRecientes: PeticionIA[];
  consumoPorUsuario: Array<{ usuarioEmail: string; consultas: number; exitosas: number; locales: number; tokens: number }>;
}

export type TabSuperadmin = 'usuarios' | 'roles' | 'facturacion' | 'ia-tokens' | 'visitantes' | 'auditoria' | 'legal';

/** Un rol personalizado con sus permisos, tal como lo devuelve /api/roles. */
export interface RolPersonalizado {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

export interface PermisoCatalogo {
  clave: string;
  descripcion: string;
}

export interface BarraItem {
  id: string;
  etiqueta: string;
  subetiqueta?: string;
  valor: number;
  secundario?: number;
}
