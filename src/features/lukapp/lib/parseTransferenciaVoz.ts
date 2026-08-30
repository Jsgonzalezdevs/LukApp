import { parseTransaction, type CuentaConocida } from './parseTransaction';
import { normalizeWord } from './numerals';

export interface TransferenciaPorVoz {
  origenId: string;
  destinoId: string;
  montoCop: number;
  raw: string;
}

const textoPlano = (texto: string): string =>
  normalizeWord(texto).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const escapado = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cuentaTras = (texto: string, preposiciones: string, cuentas: readonly CuentaConocida[]): CuentaConocida | null => {
  for (const cuenta of [...cuentas].sort((a, b) => b.nombre.length - a.nombre.length)) {
    const nombre = escapado(textoPlano(cuenta.nombre));
    if (new RegExp(`\\b(?:${preposiciones})\\s+(?:la\\s+|el\\s+)?${nombre}\\b`).test(texto)) return cuenta;
  }
  return null;
};

/** Reconoce «transfiere 50 mil de Nequi a Bancolombia» sin tocar saldos aún. */
export const parseTransferenciaVoz = (
  raw: string,
  cuentas: readonly CuentaConocida[],
): TransferenciaPorVoz | null => {
  const plano = textoPlano(raw);
  if (!/\b(?:transfier(?:e|a|o)?|transfer(?:i|e|ir)|pasa(?:r|me)?|mueve|envia|consigna)\b/.test(plano)) return null;

  const origen = cuentaTras(plano, 'de|desde', cuentas);
  const destino = cuentaTras(plano, 'a|hacia|para', cuentas);
  const monto = parseTransaction(raw, cuentas).amount;
  if (!origen || !destino || origen.id === destino.id || monto === null || monto <= 0) return null;

  return { origenId: origen.id, destinoId: destino.id, montoCop: monto, raw };
};
