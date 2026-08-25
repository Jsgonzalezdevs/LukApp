import { daysBetween, monthKey, monthKeyLabel, shiftDays, shiftMonth } from './localDate';

/**
 * Con qué frecuencia se reinicia "el período activo" -- lo que antes siempre
 * era, sin excepción, un mes calendario. `mensual` con `desfaseDiasMensual:
 * 0` sigue siéndolo: es el valor por defecto, y todo el módulo está escrito
 * para que ese caso produzca resultados idénticos a los de antes de que este
 * archivo existiera (misma clave 'YYYY-MM', misma etiqueta, misma
 * navegación) -- nadie que no toque el ajuste nuevo nota ningún cambio.
 */
export type FrecuenciaPeriodo =
  | 'semanal'
  | 'quincenal'
  | 'quincenas-mes'
  | 'mensual'
  | 'todo-el-tiempo';

export interface ConfigPeriodo {
  frecuencia: FrecuenciaPeriodo;
  /**
   * Solo aplica a 'mensual': cuántos días se corre el inicio del período
   * respecto al día 1 (0-27). Con 4, el período va del 5 al 4 -- para
   * alinear con un día de pago que no cae el día 1.
   */
  desfaseDiasMensual: number;
}

export const PERIODO_POR_DEFECTO: ConfigPeriodo = { frecuencia: 'mensual', desfaseDiasMensual: 0 };

/** El único valor de `frecuencia` que hoy existe en producción: mes calendario, sin desfase. */
const esMensualPuro = (config: ConfigPeriodo): boolean =>
  config.frecuencia === 'mensual' && config.desfaseDiasMensual === 0;

/** No hay reinicio: un único período que cubre todo el historial. */
export const CLAVE_TODO_EL_TIEMPO = 'todo';

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Cuántos días tiene el mes calendario que contiene esta fecha completa 'YYYY-MM-DD'. */
const diasEnMesDe = (fecha: string): number => {
  const [y, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Desplaza una fecha completa 'YYYY-MM-DD' N meses, conservando el día. Solo
 * se usa con días 1-28, así que nunca cae en un mes que no tiene ese día. */
const shiftMonthDate = (fecha: string, deltaMeses: number): string => {
  const [y, m, d] = fecha.split('-').map(Number);
  const absoluto = y * 12 + (m - 1) + deltaMeses;
  const year = Math.floor(absoluto / 12);
  const monthIndex = absoluto - year * 12;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const inicioSemanaDe = (fecha: string): string => {
  const [y, m, d] = fecha.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo..6=sábado
  const desdeElLunes = (diaSemana + 6) % 7;
  return shiftDays(fecha, -desdeElLunes);
};

/**
 * Ancla fija (un lunes real) para agrupar semanas de a dos en 'quincenal'.
 * "Cada 2 semanas" no tiene un punto de partida natural como sí lo tiene la
 * semana ISO -- sin un ancla, no hay forma de decidir si una semana dada es
 * la primera o la segunda del par. Cualquier lunes fijo sirve; este es
 * arbitrario pero estable: no depende de cuándo cada usuario activó el ajuste.
 */
const EPOCA_QUINCENAL = '2024-01-01';

const inicioQuincenaFijaDe = (fecha: string): string => {
  const inicioSemana = inicioSemanaDe(fecha);
  const semanasDesdeEpoca = Math.floor(daysBetween(EPOCA_QUINCENAL, inicioSemana) / 7);
  return semanasDesdeEpoca % 2 === 0 ? inicioSemana : shiftDays(inicioSemana, -7);
};

const inicioQuincenaCalendarioDe = (fecha: string): string => {
  const [y, m, d] = fecha.split('-').map(Number);
  const diaCorte = d <= 15 ? 1 : 16;
  return `${y}-${String(m).padStart(2, '0')}-${String(diaCorte).padStart(2, '0')}`;
};

const inicioMesConDesfaseDe = (fecha: string, desfaseDias: number): string => {
  const [y, m, d] = fecha.split('-').map(Number);
  const diaCorte = 1 + desfaseDias;
  const inicioEsteMes = `${y}-${String(m).padStart(2, '0')}-${String(diaCorte).padStart(2, '0')}`;
  return d >= diaCorte ? inicioEsteMes : shiftMonthDate(inicioEsteMes, -1);
};

/** La fecha (completa, 'YYYY-MM-DD') en que empieza el período que contiene `fecha`. */
export const inicioDePeriodo = (fecha: string, config: ConfigPeriodo): string => {
  switch (config.frecuencia) {
    case 'semanal':
      return inicioSemanaDe(fecha);
    case 'quincenal':
      return inicioQuincenaFijaDe(fecha);
    case 'quincenas-mes':
      return inicioQuincenaCalendarioDe(fecha);
    case 'mensual':
      return inicioMesConDesfaseDe(fecha, config.desfaseDiasMensual);
    case 'todo-el-tiempo':
      return CLAVE_TODO_EL_TIEMPO;
  }
};

/** La última fecha del período que empieza en `inicio`. `null` en 'todo el
 * tiempo': no hay cierre que calcular. */
export const finDePeriodo = (inicio: string, config: ConfigPeriodo): string | null => {
  switch (config.frecuencia) {
    case 'semanal':
      return shiftDays(inicio, 6);
    case 'quincenal':
      return shiftDays(inicio, 13);
    case 'quincenas-mes': {
      const [y, m, d] = inicio.split('-').map(Number);
      if (d === 1) return `${y}-${String(m).padStart(2, '0')}-15`;
      const ultimo = diasEnMesDe(inicio);
      return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
    }
    case 'mensual':
      return shiftDays(shiftMonthDate(inicio, 1), -1);
    case 'todo-el-tiempo':
      return null;
  }
};

/**
 * El identificador estable de "a qué período pertenece esta fecha".
 *
 * Para el caso por defecto (mensual, sin desfase) es literalmente
 * `monthKey()` -- el mismo 'YYYY-MM' de siempre, para que el comportamiento
 * de quien nunca toca este ajuste no cambie en nada. Para cualquier otra
 * frecuencia es la fecha de inicio del período ('YYYY-MM-DD'), que ordena
 * cronológicamente igual que ordena como string -- el mismo truco del que
 * ya dependía monthKey, extendido a que también funcione para semanas y
 * quincenas, que no caben en 7 caracteres alineados a mes.
 */
export const claveDePeriodo = (fecha: string, config: ConfigPeriodo): string => {
  if (config.frecuencia === 'todo-el-tiempo') return CLAVE_TODO_EL_TIEMPO;
  if (esMensualPuro(config)) return monthKey(fecha);
  return inicioDePeriodo(fecha, config);
};

/** Si `fecha` cae dentro del período identificado por `clave`. Reemplaza
 * `monthKey(tx.occurredOn) === mes` en todos los sitios que filtraban así. */
export const enElPeriodo = (fecha: string, clave: string, config: ConfigPeriodo): boolean => {
  if (config.frecuencia === 'todo-el-tiempo') return true;
  return claveDePeriodo(fecha, config) === clave;
};

/** Cuántos días tiene el período identificado por `clave`. `null` en 'todo
 * el tiempo' -- no tiene un total que mostrar. */
export const diasDelPeriodo = (clave: string, config: ConfigPeriodo): number | null => {
  if (config.frecuencia === 'todo-el-tiempo') return null;
  const inicio = esMensualPuro(config) ? `${clave}-01` : clave;
  const fin = finDePeriodo(inicio, config);
  return fin === null ? null : daysBetween(inicio, fin) + 1;
};

/**
 * Cuántos días del período ya pasaron, contando hoy. Si `hoy` cae después
 * del período (uno ya cerrado), devuelve el total de días del período
 * completo -- lo ya transcurrido no puede ser más que eso. `null` en 'todo
 * el tiempo'.
 */
export const diasTranscurridosEnPeriodo = (
  clave: string,
  hoy: string,
  config: ConfigPeriodo,
): number | null => {
  if (config.frecuencia === 'todo-el-tiempo') return null;
  const inicio = esMensualPuro(config) ? `${clave}-01` : clave;
  const total = diasDelPeriodo(clave, config);
  if (total === null) return null;
  if (hoy < inicio) return 0;
  const transcurridos = daysBetween(inicio, hoy) + 1;
  return Math.min(Math.max(transcurridos, 0), total);
};

/** Etiqueta legible del período: "julio 2026" para el mensual de siempre,
 * un rango de fechas para todo lo demás. */
export const etiquetaDePeriodo = (clave: string, config: ConfigPeriodo): string => {
  if (config.frecuencia === 'todo-el-tiempo') return 'Todo el tiempo';
  if (esMensualPuro(config)) return monthKeyLabel(clave);

  const inicio = clave;
  const fin = finDePeriodo(inicio, config);
  if (fin === null) return 'Todo el tiempo';

  const [yIni, mIni, dIni] = inicio.split('-').map(Number);
  const [yFin, mFin, dFin] = fin.split('-').map(Number);

  if (config.frecuencia === 'mensual') {
    // Un mes con desfase no tiene un único nombre de mes que lo describa --
    // "5 ago – 4 sep" es lo honesto, no "agosto" (que sería falso: se lleva
    // días de septiembre) ni "septiembre" (que ignoraría los de agosto).
    return `${dIni} ${MONTHS_SHORT[mIni - 1]} – ${dFin} ${MONTHS_SHORT[mFin - 1]}`;
  }

  if (yIni === yFin && mIni === mFin) {
    return `${dIni}–${dFin} ${MONTHS_SHORT[mIni - 1]}`;
  }
  return `${dIni} ${MONTHS_SHORT[mIni - 1]} – ${dFin} ${MONTHS_SHORT[mFin - 1]}`;
};

/**
 * El período que sigue (delta positivo) o antecede (delta negativo) al
 * identificado por `clave`. Reemplaza `shiftMonth()` en la navegación
 * cuando el período no es un mes calendario puro.
 */
export const periodoAdyacente = (clave: string, delta: number, config: ConfigPeriodo): string => {
  if (config.frecuencia === 'todo-el-tiempo') return clave;
  if (esMensualPuro(config)) return shiftMonth(clave, delta);

  let cursor = clave;
  let pasos = Math.abs(delta);
  const avanza = delta > 0;
  while (pasos > 0) {
    if (avanza) {
      const fin = finDePeriodo(cursor, config);
      cursor = inicioDePeriodo(shiftDays(fin as string, 1), config);
    } else {
      cursor = inicioDePeriodo(shiftDays(cursor, -1), config);
    }
    pasos -= 1;
  }
  return cursor;
};
