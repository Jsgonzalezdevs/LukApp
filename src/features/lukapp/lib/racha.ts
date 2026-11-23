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
  /** Los días con movimientos, para pintar el calendario de la racha. */
  diasAnotados: ReadonlySet<string>;
  /** Días salvados con un protector: cuentan para la racha, pero no son movimientos. */
  diasProtegidos: ReadonlySet<string>;
  hitosAlcanzados: readonly HitoRacha[];
  proximoHito: HitoRacha | null;
  diasParaProximoHito: number | null;
}

/**
 * Días que el equipo le sumó a una racha desde el superadmin.
 *
 * Van pegados al día en que empezó esa racha y no a fechas sueltas: si se
 * rellenaran huecos del calendario, un regalo podría unir rachas viejas y
 * sumar mucho más de lo pedido. Si la racha se corta, el bono se va con ella.
 */
export interface BonoRacha {
  inicioRacha: string;
  dias: number;
}

/**
 * El día en que empezó la racha viva, contando solo lo que la persona anotó.
 * Sin racha viva es `hoy`: un bono dado ese día lo conserva si anota hoy.
 */
export const inicioDeRachaActual = (fechasAnotadas: Iterable<string>, hoy: string): string => {
  const fechas = new Set(fechasAnotadas);
  const ayer = shiftDays(hoy, -1);
  if (!fechas.has(hoy) && !fechas.has(ayer)) return hoy;
  let cursor = fechas.has(hoy) ? hoy : ayer;
  while (fechas.has(shiftDays(cursor, -1))) cursor = shiftDays(cursor, -1);
  return cursor;
};

/**
 * Calcula la racha de días consecutivos anotando transacciones.
 *
 * Si hoy aún no has anotado pero anotaste ayer, la racha sigue viva
 * para motivarte a registrar hoy sin penalizarte antes de medianoche.
 *
 * Los `bonos` se suman a la racha que empezó en su `inicioRacha`. No cuentan
 * como "anotado hoy" ni en los días del mes: el recordatorio y el resumen
 * siguen hablando de lo que la persona de verdad registró.
 */
export const calcularRacha = (
  transacciones: readonly Pick<Transaction, 'occurredOn'>[],
  hoy: string,
  bonos: readonly BonoRacha[] = [],
  diasProtegidos: readonly string[] = [],
): InfoRacha => {
  const bonoDe = (inicio: string) =>
    bonos.reduce((total, b) => (b.inicioRacha === inicio ? total + b.dias : total), 0);

  // 1. Fechas únicas, de la más nueva a la más vieja. La racha se mide sobre
  // movimientos y protectores juntos; lo demás (días del mes, último día
  // anotado, "anotado hoy") habla solo de lo que la persona registró.
  const reales = new Set(transacciones.map((t) => t.occurredOn).filter((f): f is string => Boolean(f)));
  const protegidos = new Set(diasProtegidos.filter((f) => !reales.has(f) && f <= hoy));
  const fechasUnicas = Array.from(new Set([...reales, ...protegidos])).sort((a, b) => b.localeCompare(a));
  const fechaSet = new Set(fechasUnicas);
  const anotadoHoy = reales.has(hoy);
  const ayer = shiftDays(hoy, -1);

  // 2. Racha actual: los días reales seguidos más el bono de esa misma racha
  let rachaActual = 0;
  if (anotadoHoy || fechaSet.has(ayer)) {
    let cursor = anotadoHoy ? hoy : ayer;
    while (fechaSet.has(cursor)) {
      rachaActual += 1;
      cursor = shiftDays(cursor, -1);
    }
  }
  rachaActual += bonoDe(inicioDeRachaActual(fechasUnicas, hoy));

  // 3. Racha histórica máxima, cada tramo con su propio bono
  let rachaMaxima = rachaActual;
  const fechasAsc = [...fechasUnicas].reverse();
  let inicioTramo = fechasAsc[0];
  for (let i = 0; i < fechasAsc.length; i += 1) {
    if (i > 0 && daysBetween(fechasAsc[i - 1], fechasAsc[i]) !== 1) inicioTramo = fechasAsc[i];
    const largo = daysBetween(inicioTramo, fechasAsc[i]) + 1 + bonoDe(inicioTramo);
    if (largo > rachaMaxima) rachaMaxima = largo;
  }

  // 4. Días anotados en el mes en curso
  const mesActual = hoy.slice(0, 7);
  const diasAnotadosMes = [...reales].filter((f) => f.startsWith(mesActual)).length;

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
    ultimoDiaAnotado: [...reales].sort((a, b) => b.localeCompare(a))[0] ?? null,
    diasAnotados: reales,
    diasProtegidos: protegidos,
    hitosAlcanzados,
    proximoHito,
    diasParaProximoHito,
  };
};

/**
 * Cómo se pinta la racha. Todas las pantallas lo sacan de aquí para que
 * nunca una diga «activa» mientras otra pide anotar.
 *
 * - `encendida`: hay días y hoy ya anotó.
 * - `pendiente`: hay días (propios, protegidos o regalados) pero hoy aún no
 *   anota; se conservan hasta medianoche.
 * - `apagada`: no hay racha.
 */
export type EstadoRacha = 'encendida' | 'pendiente' | 'apagada';

export const estadoRacha = (info: Pick<InfoRacha, 'rachaActual' | 'anotadoHoy'>): EstadoRacha => {
  if (info.rachaActual <= 0) return 'apagada';
  return info.anotadoHoy ? 'encendida' : 'pendiente';
};
