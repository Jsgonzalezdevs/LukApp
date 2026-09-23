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

  // Whisper a veces deja un monto corto como "1 y 500 pesos". En un dictado
  // financiero eso casi siempre es la forma hablada de $1.500, no dos gastos
  // de $1 y $500. Unirlo antes de buscar separadores conserva los casos reales
  // de movimientos múltiples, que traen dos montos completos ("20 mil y 30
  // mil"). Solo se toca la copia que se analiza: `raw` sigue siendo el texto
  // exacto que dijo la persona cuando se muestra en la confirmación.
  const texto = trimmed.replace(
    /\b(\d{1,3})\s+y\s+(\d{3})(?=\s+(?:pesos?|cop)\b)/gi,
    '$1 mil $2',
  );

  // Si es un escaneo OCR, usar parser único
  if (texto.startsWith('[OCR]')) {
    return [parseTransaction(texto, cajitas, categorias, lexico, historial)];
  }

  // Una cláusula de precio explica el mismo movimiento, aunque el dictado
  // contenga cantidades o conectores: “me gasté 3 cafés con leche que me costó
  // 7.500” no son dos gastos de 3 y 7.500 pesos, sino una sola compra.
  if (/\b(?:que\s+)?me\s+(?:costo|costó|costaron|valio|valió|valieron|salio|salió|salieron)\b/i.test(texto)) {
    return [parseTransaction(texto, cajitas, categorias, lexico, historial)];
  }

  // Si hay varios productos unidos por “y” pero una sola cifra final marcada
  // con “por” o “en total”, la cifra es el total de una sola compra. Dividirla
  // produciría apuntes absurdos como $2 por dos pizzas y $45.000 por la gaseosa.
  if (
    /(?:^|\s)(?:compre|compré|pedi|pedí|gaste|gasté|pague|pagué)(?:\s|$)[\s\S]*\by\b[\s\S]*\b(?:por|en\s+total)\s+\$?\s*(?:\d+|un(?:a)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i.test(
      texto,
    )
  ) {
    return [parseTransaction(texto, cajitas, categorias, lexico, historial)];
  }

  // 1. Intentar división por saltos de línea (si el usuario pegó varias líneas)
  const lineas = texto
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
  const partes = texto.split(
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
  const parseada = parseTransaction(texto, cajitas, categorias, lexico, historial);
  return [{ ...parseada, raw: trimmed }];
};
