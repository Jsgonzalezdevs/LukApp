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

// Whisper a veces escribe los bancos por fonética. Son alias deliberadamente
// estrechos y solo se usan dentro de una frase con dos cuentas, nunca para
// clasificar un gasto normal por la palabra "Colombia" aislada.
const patronCuenta = (cuenta: CuentaConocida): string => {
  const nombre = escapado(textoPlano(cuenta.nombre));
  if (nombre === 'nequi') return '(?:nequi|neki)';
  if (nombre === 'bancolombia') return '(?:bancolombia|colombia)';
  return nombre;
};

const cuentaTras = (texto: string, preposiciones: string, cuentas: readonly CuentaConocida[]): CuentaConocida | null => {
  for (const cuenta of [...cuentas].sort((a, b) => b.nombre.length - a.nombre.length)) {
    const nombre = patronCuenta(cuenta);
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
  const diceTransferir = /\b(?:transfier(?:e|a|o)?|transfer(?:i|e|ir)|pasa(?:r|me)?|mueve|envia|consigna)\b/.test(plano);
  const menciones = cuentas.filter((cuenta) => new RegExp(`\\b${patronCuenta(cuenta)}\\b`).test(plano));
  // «me de Neki o Colombia» es la degradación fonética observada de «me
  // transferí de Nequi a Bancolombia». Exigir dos cuentas evita convertir una
  // transcripción corta o un gasto ordinario en una transferencia.
  const transferenciaDegradada = /^me de\b/.test(plano) && menciones.length >= 2;
  if (!diceTransferir && !transferenciaDegradada) return null;

  const origen = cuentaTras(plano, 'de|desde', cuentas) ?? (transferenciaDegradada ? menciones[0] : null);
  const destino = cuentaTras(plano, 'a|hacia|para|o', cuentas) ?? (transferenciaDegradada ? menciones[1] : null);
  const monto = parseTransaction(raw, cuentas).amount;
  if (!origen || !destino || origen.id === destino.id || monto === null || monto <= 0) return null;

  return { origenId: origen.id, destinoId: destino.id, montoCop: monto, raw };
};
