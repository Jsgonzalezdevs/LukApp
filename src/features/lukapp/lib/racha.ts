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
 *
 * `diasRegalados` son días que el equipo sumó desde el superadmin (por ejemplo,
 * para devolver una racha perdida por una falla). Cuentan para la racha, pero
 * no como "anotado hoy" ni en los días del mes: el recordatorio y el resumen
 * siguen hablando de lo que la persona de verdad registró.
 */
export const calcularRacha = (
  transacciones: readonly Pick<Transaction, 'occurredOn'>[],
  hoy: string,
  diasRegalados: readonly string[] = [],
): InfoRacha => {
  if (transacciones.length === 0 && diasRegalados.length === 0) {
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

  const anotadoHoy = fechasUnicas.includes(hoy);
  const fechasRacha = Array.from(new Set([...fechasUnicas, ...diasRegalados]))
    .sort((a, b) => b.localeCompare(a));
  const fechaSet = new Set(fechasRacha);
  const cuentaHoy = fechaSet.has(hoy);
  const ayer = shiftDays(hoy, -1);
  const cuentaAyer = fechaSet.has(ayer);

  // 2. Calcular racha actual
  let rachaActual = 0;
  if (cuentaHoy || cuentaAyer) {
    let cursor = cuentaHoy ? hoy : ayer;
    while (fechaSet.has(cursor)) {
      rachaActual += 1;
      cursor = shiftDays(cursor, -1);
    }
  }

  // 3. Calcular racha histórica máxima
  let rachaMaxima = 0;
  if (fechasRacha.length > 0) {
    // Orden ascendente para medir rachas pasadas
    const fechasAsc = [...fechasRacha].sort((a, b) => a.localeCompare(b));
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

/**
 * Los días que hay que regalar para que la racha crezca en `dias`.
 *
 * Se rellenan hacia atrás desde justo antes de la racha viva, así el número
 * sube sin inventar movimientos de hoy. Si no hay racha viva, se arranca desde
 * ayer: la persona la conserva si anota hoy. Si el relleno toca una racha
 * vieja, se unen y la racha puede quedar por encima de lo pedido.
 */
export const diasParaSumarRacha = (
  fechasQueCuentan: Iterable<string>,
  hoy: string,
  dias: number,
): string[] => {
  const fechas = new Set(fechasQueCuentan);
  const ayer = shiftDays(hoy, -1);
  let cursor = fechas.has(hoy) ? hoy : ayer;
  while (fechas.has(cursor)) cursor = shiftDays(cursor, -1);

  const nuevos: string[] = [];
  while (nuevos.length < dias) {
    // Un día que ya cuenta no se regala dos veces: se salta y se sigue.
    if (!fechas.has(cursor)) nuevos.push(cursor);
    cursor = shiftDays(cursor, -1);
  }
  return nuevos;
};
