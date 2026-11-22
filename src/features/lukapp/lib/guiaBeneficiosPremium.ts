import type { PanelAjustes, SectionId } from '../sections';
import type { ClaveBeneficioPlan } from './beneficiosPlan';

/** A dónde lleva el botón de cada beneficio: una sección o una herramienta de Más. */
export type DestinoBeneficio =
  | { tipo: 'seccion'; id: SectionId }
  | { tipo: 'panel'; id: PanelAjustes };

export interface GuiaBeneficio {
  /** Para qué le sirve a la persona, con un ejemplo de su día a día. */
  explicacion: string;
  accion: string;
  destino: DestinoBeneficio;
}

/**
 * El servidor dice QUÉ beneficios están activos y con qué cupo; esto cuenta
 * para qué sirve cada uno. Va aparte porque el catálogo del servidor se usa
 * también en Super Admin, donde un texto de venta no tiene lugar.
 */
export const GUIA_BENEFICIOS: Record<ClaveBeneficioPlan, GuiaBeneficio> = {
  dictado: {
    explicacion: 'Di «gasté 25 mil en el almuerzo» y LukApp lo anota solo, con categoría y cuenta. Ideal para cuando vas de afán.',
    accion: 'Anotar por voz',
    destino: { tipo: 'seccion', id: 'inicio' },
  },
  asesor_ia: {
    explicacion: 'Pregúntale a la Estrella si te alcanza para ese viaje o cómo armar tu colchón. Te responde con tus números, no con consejos de manual.',
    accion: 'Hablar con el Asesor',
    destino: { tipo: 'seccion', id: 'asesor' },
  },
  extracto: {
    explicacion: 'Sube el PDF que te manda el banco y LukApp separa lo nuevo de lo que ya tenías anotado. Cero digitar movimiento por movimiento.',
    accion: 'Importar un extracto',
    destino: { tipo: 'panel', id: 'extractos' },
  },
  espacios_compartidos: {
    explicacion: 'Cuentas claras con tu pareja, el roomie o el parche del viaje: cada espacio lleva sus propios gastos, aparte de los tuyos.',
    accion: 'Crear un espacio',
    destino: { tipo: 'panel', id: 'compartido' },
  },
  integrantes_espacio: {
    explicacion: 'Invita a más gente a cada espacio y vean juntos quién puso qué y quién le debe a quién, sin hacer cuentas en servilletas.',
    accion: 'Invitar a alguien',
    destino: { tipo: 'panel', id: 'compartido' },
  },
  insights_ia: {
    explicacion: 'Cada mes la IA revisa en qué se te va la plata y te deja ideas concretas para ahorrar, en «Para ti», en tu Inicio.',
    accion: 'Ver mis recomendaciones',
    destino: { tipo: 'seccion', id: 'inicio' },
  },
  pulso_premium: {
    explicacion: 'Tu margen del día: cuánto puedes gastar hoy sin descuadrar el mes, y una ayuda para decidir antes de comprar algo grande.',
    accion: 'Ver mi Pulso',
    destino: { tipo: 'seccion', id: 'inicio' },
  },
};
