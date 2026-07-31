/**
 * Strips personally-identifying fields from bank-statement text BEFORE it
 * leaves this server for Gemini's free tier.
 *
 * This exists because Google's own Gemini API terms say, in writing: "Do not
 * submit sensitive, confidential, or personal information to the Unpaid
 * Services." A bank statement's header — account holder name, ID number,
 * account number, address — is exactly that. Redacting it here is a real
 * reduction in exposure, not a complete one: merchant names, amounts, and the
 * resulting spending pattern are still sent, because the whole point of the
 * feature is having those classified. Anyone reading this should not assume
 * the residual exposure is zero.
 *
 * Deliberately NOT a blanket "delete every long digit run" — Colombian peso
 * amounts are long digit runs too ("1.234.567"), and destroying them would
 * defeat the feature entirely. The two passes below are targeted instead:
 */

/** Labels that, in Spanish bank statements, precede an identifying value on
 *  the same line. Matched at the start of a (trimmed) line, case-insensitive,
 *  accent-insensitive. */
const ETIQUETAS_SENSIBLES =
  /^\s*(cuenta|cta\.?|n[°ºo]?\.?\s*de\s*cuenta|c\.?c\.?|c[ée]dula(?:\s*de\s*ciudadan[ií]a)?|nit|documento|titular|cliente|nombre(?:\s*del?\s*cliente)?|raz[oó]n\s*social|direcci[oó]n|celular|tel[ée]fono)\s*[:.-]\s*(.+)$/i;

const REDACTADO = '[DATO PERSONAL OCULTO]';

/**
 * A bare run of 8+ digits with no grouping separators. Colombian statements
 * always group peso amounts with dots ("1.234.567") or, rarely, commas as the
 * decimal mark ("45.000,00") — a real amount of that magnitude is never
 * printed as one unbroken digit string. An unbroken run that long is, in
 * practice, an account number, a national ID, or a card number.
 *
 * `(?<![\d.,])` / `(?![\d.,])` reject a match that is actually part of a
 * longer grouped or decimal number, so "1.234.567.890" (a huge but grouped
 * amount) is left alone rather than having its ungrouped middle segment
 * mistaken for a bare run.
 */
const CORRIDA_DE_DIGITOS = /(?<![\d.,])\d{8,}(?![\d.,])/g;

/** Redacts one line already known to start with a sensitive label. */
const redactarLineaEtiquetada = (linea: string): string =>
  linea.replace(ETIQUETAS_SENSIBLES, (_m, etiqueta: string) => `${etiqueta}: ${REDACTADO}`);

export const redactarTexto = (texto: string): string =>
  texto
    .split('\n')
    .map((linea) => (ETIQUETAS_SENSIBLES.test(linea) ? redactarLineaEtiquetada(linea) : linea))
    .join('\n')
    .replace(CORRIDA_DE_DIGITOS, REDACTADO);
