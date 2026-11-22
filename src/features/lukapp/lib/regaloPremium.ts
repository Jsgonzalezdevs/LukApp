import { bogotaDate } from './localDate';

/**
 * El Premium de cortesía que el equipo le dio a alguien y que esa persona
 * todavía no ha visto celebrado. Lo calcula el servidor; la app solo lo pinta.
 */
export interface RegaloPremiumPendiente {
  id: number;
  dias: number;
  venceEn: string;
}

const MS_DIA = 24 * 60 * 60 * 1_000;

/**
 * Días de calendario en Bogotá entre el día del regalo y el de vencimiento.
 *
 * Se cuentan fechas y no horas: el panel guarda el vencimiento a las 23:59 de
 * Bogotá, así que dividir milisegundos daba "8 días" por un regalo de una
 * semana según la hora en que se otorgó.
 */
export const diasDeRegalo = (iniciaEn: string | Date, venceEn: string | Date): number => {
  const desde = new Date(iniciaEn);
  const hasta = new Date(venceEn);
  // Intl lanza con una fecha inválida; un dato raro no debe tumbar la consulta.
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return 0;
  const inicio = Date.parse(`${bogotaDate(desde)}T00:00:00Z`);
  const fin = Date.parse(`${bogotaDate(hasta)}T00:00:00Z`);
  // Un regalo que vence el mismo día que se dio sigue siendo un día de Premium.
  return Math.max(1, Math.round((fin - inicio) / MS_DIA));
};

/** "1 día", "30 días": el número va aparte en la tarjeta, por eso solo la palabra. */
export const palabraDias = (dias: number): string => (dias === 1 ? 'día' : 'días');

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const fechaVencimientoRegalo = (venceEn: string): string => FECHA_LARGA.format(new Date(venceEn));

/** Lo que llega del API, validado: un cuerpo raro no debe abrir un pop-up vacío. */
export const leerRegaloPremium = (cuerpo: unknown): RegaloPremiumPendiente | null => {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const regalo = (cuerpo as { regalo?: unknown }).regalo;
  if (!regalo || typeof regalo !== 'object') return null;
  const { id, dias, venceEn } = regalo as Record<string, unknown>;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof dias !== 'number' || !Number.isSafeInteger(dias) || dias <= 0) return null;
  if (typeof venceEn !== 'string' || !Number.isFinite(Date.parse(venceEn))) return null;
  return { id, dias, venceEn };
};
