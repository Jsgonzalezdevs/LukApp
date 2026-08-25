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
  tokensRestantes: number;
  limiteDiarioTokens: number;
  porcentajeTokens: number;
  llamadasHoy: number;
  llamadasExitosas: number;
  llamadasFallback: number;
  llamadasRestantes: number;
  limiteDiarioLlamadas: number;
  porcentajeLlamadas: number;
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
