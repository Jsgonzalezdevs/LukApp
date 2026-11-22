import { shiftDays } from './localDate';

export interface FilaRanking {
  posicion: number;
  userId: string;
  apodo: string;
  rachaActual: number;
  rachaMaxima: number;
  soyYo: boolean;
  visible: boolean;
  /** Solo en el ranking semanal: días anotados de lunes a hoy. */
  diasSemana?: number;
}

export interface RankingRacha {
  filas: readonly FilaRanking[];
  /** Cuántas personas salen en la lista pública. */
  totalParticipantes: number;
  yo: FilaRanking | null;
}

export interface Liga {
  nombre: string;
  emoji: string;
  desde: number;
}

/** De menor a mayor. Las ligas dan algo que subir entre un hito y el siguiente. */
export const LIGAS: readonly Liga[] = [
  { nombre: 'Chispa', emoji: '✨', desde: 1 },
  { nombre: 'Bronce', emoji: '🥉', desde: 3 },
  { nombre: 'Plata', emoji: '🥈', desde: 7 },
  { nombre: 'Oro', emoji: '🥇', desde: 14 },
  { nombre: 'Diamante', emoji: '💎', desde: 30 },
  { nombre: 'Leyenda', emoji: '👑', desde: 100 },
];

export const ligaDeRacha = (dias: number): Liga | null => {
  let actual: Liga | null = null;
  for (const liga of LIGAS) if (dias >= liga.desde) actual = liga;
  return actual;
};

export const siguienteLiga = (dias: number): Liga | null =>
  LIGAS.find((liga) => dias < liga.desde) ?? null;

export interface FilaCruda {
  posicion: number | string;
  user_id: string;
  apodo: string | null;
  racha_actual: number;
  racha_maxima?: number;
  dias_semana?: number;
  soy_yo: boolean;
  visible: boolean;
  total_participantes: number | string | null;
}

export const armarRanking = (crudas: readonly FilaCruda[]): RankingRacha => {
  const filas = crudas.map<FilaRanking>((f) => ({
    posicion: Number(f.posicion),
    userId: f.user_id,
    apodo: f.apodo ?? 'Lukero anónimo',
    rachaActual: f.racha_actual,
    rachaMaxima: f.racha_maxima ?? f.racha_actual,
    diasSemana: f.dias_semana,
    soyYo: f.soy_yo,
    visible: f.visible,
  }));
  return {
    filas,
    totalParticipantes: Number(crudas[0]?.total_participantes ?? 0),
    yo: filas.find((f) => f.soyYo) ?? null,
  };
};

/**
 * La frase que empuja: a cuántos días estás de pasar a quien va justo arriba.
 * Para el primer lugar, cuánta ventaja le llevas al segundo.
 */
export const mensajeRival = (ranking: RankingRacha): string | null => {
  const { yo, filas } = ranking;
  if (!yo || !yo.visible) return null;
  const visibles = filas.filter((f) => f.visible);
  const indice = visibles.findIndex((f) => f.soyYo);
  if (indice === -1) return null;
  if (indice === 0) {
    const segundo = visibles[1];
    if (!segundo) return 'Vas de primero en LukApp. ¡No sueltes la racha! 🏆';
    const ventaja = yo.rachaActual - segundo.rachaActual;
    return ventaja > 0
      ? `Vas de primero con ${ventaja} ${ventaja === 1 ? 'día' : 'días'} de ventaja sobre ${segundo.apodo}. 🏆`
      : `Empatas en la cima con ${segundo.apodo}: anota hoy para desempatar. 🏆`;
  }
  const rival = visibles[indice - 1];
  const falta = rival.rachaActual - yo.rachaActual + 1;
  return falta <= 1
    ? `Un día más y pasas a ${rival.apodo} (#${rival.posicion}). 🔥`
    : `Te faltan ${falta} días para pasar a ${rival.apodo} (#${rival.posicion}). 🔥`;
};

export type EstadoDia = 'anotado' | 'protegido' | 'perdido' | 'hoy-pendiente';

export interface DiaCalendario {
  fecha: string;
  estado: EstadoDia;
}

/** Los últimos `n` días (el último es hoy), para el calendario de la racha. */
export const ultimosDias = (
  diasAnotados: ReadonlySet<string>,
  hoy: string,
  n = 28,
  diasProtegidos: ReadonlySet<string> = new Set(),
): DiaCalendario[] =>
  Array.from({ length: n }, (_, i) => {
    const fecha = shiftDays(hoy, i - (n - 1));
    if (diasAnotados.has(fecha)) return { fecha, estado: 'anotado' as const };
    if (diasProtegidos.has(fecha)) return { fecha, estado: 'protegido' as const };
    return { fecha, estado: fecha === hoy ? ('hoy-pendiente' as const) : ('perdido' as const) };
  });

/** Texto para compartir. Sin montos ni nada financiero: solo el logro. */
export const textoParaCompartir = (racha: number): string =>
  racha > 0
    ? `Llevo ${racha} ${racha === 1 ? 'día' : 'días'} seguidos anotando mis finanzas en LukApp 🔥 ¿Me alcanzas?`
    : 'Estoy empezando mi racha financiera en LukApp 🔥 ¿Te animas?';

/**
 * La racha corre peligro: ya hay algo que perder, hoy no se ha anotado y la
 * tarde va avanzada. Es el único momento donde vale la pena insistir.
 */
export const rachaEnRiesgo = (
  rachaActual: number,
  anotadoHoy: boolean,
  horaBogota: number,
): boolean => rachaActual >= 2 && !anotadoHoy && horaBogota >= 18;

export type AlcanceRanking = 'global' | 'semana' | 'amigos';

/** Una fila del reto entre integrantes de un espacio compartido. */
export interface FilaEspacio {
  posicion: number;
  userId: string;
  nombre: string;
  emoji: string;
  rachaActual: number;
  rachaMaxima: number;
  diasSemana: number;
  soyYo: boolean;
}

export interface FilaEspacioCruda {
  posicion: number | string;
  user_id: string;
  nombre: string;
  emoji: string;
  racha_actual: number;
  racha_maxima: number;
  dias_semana: number;
  soy_yo: boolean;
}

export const armarFilasEspacio = (crudas: readonly FilaEspacioCruda[]): FilaEspacio[] =>
  crudas.map((f) => ({
    posicion: Number(f.posicion),
    userId: f.user_id,
    nombre: f.nombre,
    emoji: f.emoji,
    rachaActual: f.racha_actual,
    rachaMaxima: f.racha_maxima,
    diasSemana: f.dias_semana,
    soyYo: f.soy_yo,
  }));

/**
 * Premios en Premium por hito. Espejo de `reclamar_premios_racha` en SQL: la
 * base es quien manda, esto solo sirve para mostrar qué se gana.
 */
export const PREMIOS_RACHA: readonly { hito: number; diasPremium: number }[] = [
  { hito: 30, diasPremium: 7 },
  { hito: 100, diasPremium: 30 },
  { hito: 365, diasPremium: 90 },
];

export const CLAVE_HITOS_CELEBRADOS = 'finanzas:racha:hitos-celebrados';

/**
 * El hito más alto alcanzado que aún no se celebró. Los inferiores sin
 * celebrar se dan por vistos: quien ya lleva 45 días celebra el de 30 una vez,
 * no cuatro tarjetas seguidas.
 */
export const hitoPorCelebrar = (
  rachaActual: number,
  hitos: readonly number[],
  celebrados: ReadonlySet<number>,
): { celebrar: number | null; marcar: number[] } => {
  const alcanzados = hitos.filter((h) => rachaActual >= h);
  const pendientes = alcanzados.filter((h) => !celebrados.has(h));
  if (pendientes.length === 0) return { celebrar: null, marcar: [] };
  return { celebrar: Math.max(...pendientes), marcar: pendientes };
};
