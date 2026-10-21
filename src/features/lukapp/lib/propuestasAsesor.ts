import type { CategoriaClave } from '../types';
import type { LexicoAprendido } from './aprendizaje';
import type { CategoriaPersonal } from '../categorias';
import { parseTransaction } from './parseTransaction';

export type PropuestaAsesor =
  | { tipo: 'presupuesto'; categoria: CategoriaClave; montoCop: number }
  | { tipo: 'meta'; nombre: string; objetivoCop: number; fechaObjetivo: string | null };

const nombreMeta = (texto: string): string => {
  const para = texto.match(/\bpara\s+(.+?)(?:[.!?,]|$)/i)?.[1];
  const nombre = (para ?? '')
    .replace(/\b(?:ahorrar|guardar|crear|una|un|mi|meta|objetivo|de|por|pesos?|cop|en|este|esta|durante|meses?|mes)\b/gi, ' ')
    .replace(/\$?\s*\d[\d.,]*(?:\s*(?:mil|millones?|lucas))?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return nombre ? nombre.charAt(0).toLocaleUpperCase('es-CO') + nombre.slice(1) : 'Mi nueva meta';
};

/** Solo propone cambios financieros cuando la persona expresa la acción y el monto con claridad. */
export const detectarPropuestaAsesor = (
  texto: string,
  categorias: readonly CategoriaPersonal[] = [],
  lexico?: LexicoAprendido,
): PropuestaAsesor | null => {
  const montoParseado = parseTransaction(texto, [], categorias, lexico);
  const montoCop = montoParseado.amount;
  if (!/\b(?:quiero|crea(?:r|me)?|pon(?:er)?|arma(?:r|me)?|establece(?:r)?|ajusta(?:r|me)?|define(?:r)?|ay[uú]dame\s+a)\b/i.test(texto)) return null;
  if (montoCop === null || montoCop <= 0) return null;
  if (/\bpresupuesto\b/i.test(texto) && montoParseado.signals.categorySource !== 'default') {
    return { tipo: 'presupuesto', categoria: montoParseado.category, montoCop };
  }
  if (/\b(?:meta|objetivo)\b/i.test(texto)) {
    return { tipo: 'meta', nombre: nombreMeta(texto), objetivoCop: montoCop, fechaObjetivo: null };
  }
  return null;
};
