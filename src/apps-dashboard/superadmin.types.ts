/**
 * Type definitions for Superadmin functionality.
 * Extracted to allow reuse across multiple components.
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
}

export interface RolPersonalizado {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
  createdAt: string;
  createdByEmail: string;
}

export interface SuperadminPanelProps {
  rol: 'admin' | 'usuario';
  permisos: string[];
  onBack: () => void;
  tema: 'claro' | 'oscuro';
  onCambiarTema: (tema: 'claro' | 'oscuro') => void;
}
