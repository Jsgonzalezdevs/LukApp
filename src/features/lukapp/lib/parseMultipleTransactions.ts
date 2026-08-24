import { parseTransaction, type CuentaConocida, type ParsedTransaction } from './parseTransaction';
import type { CategoriaPersonal } from '../categorias';
import { LEXICO_VACIO, type LexicoAprendido } from './aprendizaje';
import type { Transaction } from '../types';

/**
 * Detecta si una frase o transcripción de voz contiene múltiples movimientos financieros
 * combinados mediante conectores como "y", "además", "también", comas o saltos de línea.
 *
 * Ejemplos:
 * - "15 mil de taxi y 30 mil de almuerzo" -> 2 transacciones
 * - "Gasté 50 en mercado, 20 en farmacia y 10 de recarga" -> 3 transacciones
 * - "Pagué 80 mil de internet y me entraron 500 mil de nómina" -> 2 transacciones (Gasto + Ingreso)
 *
 * Si detecta 2 o más transacciones válidas con monto, devuelve la lista completa.
 * Si es una sola transacción normal, devuelve un arreglo de un solo elemento.
 */
export const parseMultipleTransactions = (
  raw: string,
  cajitas: readonly CuentaConocida[] = [],
  categorias: readonly CategoriaPersonal[] = [],
  lexico: LexicoAprendido = LEXICO_VACIO,
  historial: readonly Transaction[] = [],
): ParsedTransaction[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Si es un escaneo OCR, usar parser único
  if (trimmed.startsWith('[OCR]')) {
    return [parseTransaction(trimmed, cajitas, categorias, lexico, historial)];
  }

  // 1. Intentar división por saltos de línea (si el usuario pegó varias líneas)
  const lineas = trimmed
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length > 1) {
    const parseadas = lineas
      .map((l) => parseTransaction(l, cajitas, categorias, lexico, historial))
      .filter((p) => p.amount !== null && p.amount > 0);
    if (parseadas.length >= 2) {
      return parseadas;
    }
  }

  // 2. Intentar división por conectores naturales colombianos
  // Evitar dividir frases explicativas de precio como "que me valió 10 mil" o ", me costó 50 mil"
  const partes = trimmed.split(
    /(?:\s+(?:y|e|además|ademas|también|tambien|luego)\s+)|(?:\s*,\s*(?=(?:[0-9]|gaste|gasté|pague|pagué|recibi|recibí|compre|compré|transferi|transferí|meti|metí|saque|saqué|me entraron|me pagaron)(?!.*(?:que\s+(?:me\s+)?(?:valio|valió|costo|costó)))))/i,
  );

  if (partes.length > 1) {
    const candidatas = partes
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => parseTransaction(p, cajitas, categorias, lexico, historial));

    // Solo es múltiple si al menos 2 partes tienen montos reales reconocidos
    const conMonto = candidatas.filter(
      (p) => p.amount !== null && p.amount > 0 && p.signals.amountSource !== 'none',
    );
    if (conMonto.length >= 2) {
      return conMonto;
    }
  }

  // 3. Fallback: Parseo estándar individual
  return [parseTransaction(trimmed, cajitas, categorias, lexico, historial)];
};
