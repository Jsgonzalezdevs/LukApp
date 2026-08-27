import type { Transaction } from '../types';
import { formatCop } from './formatCop';

/**
 * Precios de referencia de la vida cotidiana en Colombia para traducir cifras frías
 * en equivalencias del día a día comprensibles para cualquier persona.
 */
const EQUIVALENCIAS_COLOMBIA = {
  ALMUERZO_CORRIENTAZO: 16_000,
  TINTO_O_CAFE: 3_500,
  PASAJE_TRANSMILENIO_METRO: 3_200,
  PLAN_CELULAR_MES: 45_000,
  SUSCRIPCION_STREAMING: 25_000,
  MERCADO_BASICO_SEMANA: 120_000,
};

export interface InsightContextual {
  tipo: 'habito' | 'ahorro' | 'gmf' | 'positivo';
  titulo: string;
  mensaje: string;
  equivalencia?: string;
  emoji: string;
}

/**
 * Analiza las transacciones del periodo y genera explicaciones educativas
 * en lenguaje 100% cotidiano colombiano.
 */
export const generarInsightsEducativos = (
  transacciones: readonly Transaction[],
): InsightContextual[] => {
  const insights: InsightContextual[] = [];
  const gastos = transacciones.filter((t) => t.kind === 'gasto');

  // 1. Gastos hormiga (café, snacks, domicilios pequeños)
  const gastosHormiga = gastos.filter(
    (t) =>
      (t.category === 'snacks' ||
        t.category === 'comida' ||
        t.description.toLowerCase().includes('café') ||
        t.description.toLowerCase().includes('tinto') ||
        t.description.toLowerCase().includes('empanada') ||
        t.description.toLowerCase().includes('domicilio')) &&
      Math.abs(t.amountCop) <= 30_000,
  );

  const totalHormiga = gastosHormiga.reduce((s, t) => s + Math.abs(t.amountCop), 0);
  if (totalHormiga >= 30_000) {
    const almuerzos = Math.round(totalHormiga / EQUIVALENCIAS_COLOMBIA.ALMUERZO_CORRIENTAZO);
    insights.push({
      tipo: 'habito',
      emoji: '☕',
      titulo: 'Tus gastos hormiga al detalle',
      mensaje: `Has gastado ${formatCop(totalHormiga)} en pequeños consumos este periodo.`,
      equivalencia: `Eso equivale a ${almuerzos} almuerzos ejecutivos o a ${(totalHormiga / EQUIVALENCIAS_COLOMBIA.PASAJE_TRANSMILENIO_METRO).toFixed(0)} pasajes de transporte público.`,
    });
  }

  // 2. Gastos en domicilios / restaurantes vs mercado
  const totalComidaFuera = gastos
    .filter((t) => t.category === 'comida' || t.category === 'snacks')
    .reduce((s, t) => s + Math.abs(t.amountCop), 0);

  const totalMercado = gastos
    .filter((t) => t.category === 'mercado')
    .reduce((s, t) => s + Math.abs(t.amountCop), 0);

  if (totalComidaFuera > totalMercado && totalComidaFuera >= 150_000) {
    insights.push({
      tipo: 'ahorro',
      emoji: '🥑',
      titulo: 'Comida por fuera supera al mercado',
      mensaje: `Llevas más gasto en restaurantes y domicilios (${formatCop(totalComidaFuera)}) que en mercado de plaza o supermercado (${formatCop(totalMercado)}).`,
      equivalencia: `Cocinar 2 días más por semana te ahorraría cerca de ${formatCop(Math.round(totalComidaFuera * 0.35))} al mes.`,
    });
  }

  // 3. Tip educativo del 4x1000
  const totalMovimientos = gastos.reduce((s, t) => s + Math.abs(t.amountCop), 0);
  if (totalMovimientos >= 2_000_000) {
    insights.push({
      tipo: 'gmf',
      emoji: '🏛️',
      titulo: 'Protege tu bolsillo del 4×1000',
      mensaje: 'Recuerda que tienes derecho a tener 1 cuenta bancaria exenta de 4×1000 hasta por 350 UVT al mes (~$18.3 millones).',
      equivalencia: 'Pide la marcación de tu cuenta principal en tu banco si aún no la tienes exenta.',
    });
  }

  return insights;
};
