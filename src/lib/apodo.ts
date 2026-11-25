/**
 * Reglas del apodo de una cuenta. Las comparten el formulario (para avisar
 * antes de enviar) y el servidor (que es quien decide): el apodo se ve en el
 * ranking de racha, así que no puede hacerse pasar por el equipo de LukApp.
 */
export const APODO_MINIMO = 3;
export const APODO_MAXIMO = 24;

const RESERVADOS = new Set([
  'admin', 'administrador', 'superadmin', 'soporte', 'ayuda', 'lukapp', 'luki', 'equipo', 'oficial', 'moderador', 'sistema',
]);

const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-CO');

export type ResultadoApodo = { ok: true; apodo: string } | { ok: false; error: string };

export const validarApodo = (entrada: unknown): ResultadoApodo => {
  if (typeof entrada !== 'string') return { ok: false, error: 'Escribe tu nuevo nombre.' };
  const apodo = entrada.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (apodo.length < APODO_MINIMO) return { ok: false, error: `Usa al menos ${APODO_MINIMO} letras.` };
  if (apodo.length > APODO_MAXIMO) return { ok: false, error: `Usa máximo ${APODO_MAXIMO} caracteres.` };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(apodo)) return { ok: false, error: 'Usa solo letras, números, espacios, punto, guion o guion bajo.' };
  if (!/\p{L}/u.test(apodo)) return { ok: false, error: 'Tu nombre necesita al menos una letra.' };
  const base = sinTildes(apodo).replace(/[\s._-]+/g, '');
  if (RESERVADOS.has(base) || /^(lukapp|luki|admin|soporte)/.test(base)) {
    return { ok: false, error: 'Ese nombre está reservado para el equipo de LukApp.' };
  }
  return { ok: true, apodo };
};
