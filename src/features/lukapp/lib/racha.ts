import type { Transaction } from '../types';
import { daysBetween, shiftDays } from './localDate';

export interface HitoRacha {
  dias: number;
  titulo: string;
  emoji: string;
  descripcion: string;
}

export const HITOS_RACHA: readonly HitoRacha[] = [
  { dias: 3, titulo: 'Primer impulso', emoji: '🌱', descripcion: '3 días seguidos anotando tus gastos' },
  { dias: 7, titulo: 'Hábito semanal', emoji: '🔥', descripcion: 'Una semana completa de control financiero' },
  { dias: 14, titulo: 'Quincena bajo control', emoji: '⚡', descripcion: '2 semanas conociendo cada peso' },
  { dias: 21, titulo: 'Hábito consolidado', emoji: '💎', descripcion: '21 días: tu cerebro ya automatizó el control' },
  { dias: 30, titulo: 'Mes perfecto', emoji: '🏆', descripcion: 'Un mes completo sin fugas de dinero' },
  { dias: 60, titulo: 'Doble mes maestro', emoji: '👑', descripcion: '2 meses de consistencia total' },
  { dias: 100, titulo: 'Centurión financiero', emoji: '🚀', descripcion: '100 días de maestría en tus números' },
  { dias: 365, titulo: 'Leyenda LukApp', emoji: '🌟', descripcion: 'Un año entero dominando tus finanzas' },
];

export interface InfoRacha {
  rachaActual: number;
  rachaMaxima: number;
  anotadoHoy: boolean;
  diasAnotadosMes: number;
  ultimoDiaAnotado: string | null;
  hitosAlcanzados: readonly HitoRacha[];
  proximoHito: HitoRacha | null;
  diasParaProximoHito: number | null;
}

/**
 * Calcula la racha de días consecutivos anotando transacciones.
 *
 * Si hoy aún no has anotado pero anotaste ayer, la racha sigue viva
 * para motivarte a registrar hoy sin penalizarte antes de medianoche.
 */
export const calcularRacha = (
  transacciones: readonly Transaction[],
  hoy: string,
): InfoRacha => {
  if (transacciones.length === 0) {
    return {
      rachaActual: 0,
      rachaMaxima: 0,
      anotadoHoy: false,
      diasAnotadosMes: 0,
      ultimoDiaAnotado: null,
      hitosAlcanzados: [],
      proximoHito: HITOS_RACHA[0],
      diasParaProximoHito: HITOS_RACHA[0].dias,
    };
  }

  // 1. Obtener conjunto ordenado descendente de fechas únicas con movimientos
  const fechasUnicas = Array.from(
    new Set(transacciones.map((t) => t.occurredOn).filter((f): f is string => Boolean(f))),
  ).sort((a, b) => b.localeCompare(a));

  const fechaSet = new Set(fechasUnicas);
  const anotadoHoy = fechaSet.has(hoy);
  const ayer = shiftDays(hoy, -1);
  const anotadoAyer = fechaSet.has(ayer);

  // 2. Calcular racha actual
  let rachaActual = 0;
  if (anotadoHoy || anotadoAyer) {
    let cursor = anotadoHoy ? hoy : ayer;
    while (fechaSet.has(cursor)) {
      rachaActual += 1;
      cursor = shiftDays(cursor, -1);
    }
  }

  // 3. Calcular racha histórica máxima
  let rachaMaxima = 0;
  if (fechasUnicas.length > 0) {
    // Orden ascendente para medir rachas pasadas
    const fechasAsc = [...fechasUnicas].sort((a, b) => a.localeCompare(b));
    let rachaTemp = 1;
    rachaMaxima = 1;

    for (let i = 1; i < fechasAsc.length; i += 1) {
      const diff = daysBetween(fechasAsc[i - 1], fechasAsc[i]);
      if (diff === 1) {
        rachaTemp += 1;
        if (rachaTemp > rachaMaxima) rachaMaxima = rachaTemp;
      } else if (diff > 1) {
        rachaTemp = 1;
      }
    }
    if (rachaActual > rachaMaxima) {
      rachaMaxima = rachaActual;
    }
  }

  // 4. Días anotados en el mes en curso
  const mesActual = hoy.slice(0, 7);
  const diasAnotadosMes = fechasUnicas.filter((f) => f.startsWith(mesActual)).length;

  // 5. Hitos de racha
  const mayorRacha = Math.max(rachaActual, rachaMaxima);
  const hitosAlcanzados = HITOS_RACHA.filter((h) => mayorRacha >= h.dias);
  const proximoHito = HITOS_RACHA.find((h) => rachaActual < h.dias) ?? null;
  const diasParaProximoHito = proximoHito ? proximoHito.dias - rachaActual : null;

  return {
    rachaActual,
    rachaMaxima,
    anotadoHoy,
    diasAnotadosMes,
    ultimoDiaAnotado: fechasUnicas[0] ?? null,
    hitosAlcanzados,
    proximoHito,
    diasParaProximoHito,
  };
};
