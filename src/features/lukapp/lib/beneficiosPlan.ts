import {
  Bot,
  FileText,
  Gauge,
  Mic,
  Share2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type ClaveBeneficioPlan =
  | 'dictado'
  | 'asesor_ia'
  | 'extracto'
  | 'espacios_compartidos'
  | 'integrantes_espacio'
  | 'insights_ia'
  | 'pulso_premium';

export interface BeneficioPlan {
  clave: ClaveBeneficioPlan;
  titulo: string;
  detalle: string;
  tipoValor: 'cupo' | 'incluido';
  limite: number | null;
  activo: boolean;
}

const ICONOS: Record<ClaveBeneficioPlan, LucideIcon> = {
  dictado: Mic,
  asesor_ia: Bot,
  extracto: FileText,
  espacios_compartidos: Share2,
  integrantes_espacio: UsersRound,
  insights_ia: Sparkles,
  pulso_premium: Gauge,
};

export const iconoDeBeneficio = (clave: ClaveBeneficioPlan): LucideIcon => ICONOS[clave];

export const valorDeBeneficio = (beneficio: BeneficioPlan): string => {
  if (beneficio.tipoValor === 'incluido') return 'Incluido';
  return beneficio.limite === null ? '∞' : new Intl.NumberFormat('es-CO').format(beneficio.limite);
};

export const beneficiosActivos = (beneficios: readonly BeneficioPlan[]): BeneficioPlan[] =>
  beneficios.filter((beneficio) => beneficio.activo);
