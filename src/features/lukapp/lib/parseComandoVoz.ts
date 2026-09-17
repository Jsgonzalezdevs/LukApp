import type { Cajita } from '../data/modelos';
import { ES_PASIVO } from '../data/modelos';
import { normalizeWord } from './numerals';
import { parseTransaction } from './parseTransaction';
import { parseTransferenciaVoz } from './parseTransferenciaVoz';

export type ComandoVoz =
  | {
      tipo: 'transferencia';
      origenId: string | null;
      destinoId: string | null;
      montoCop: number | null;
      occurredOn?: string;
      raw: string;
    }
  | {
      tipo: 'abono';
      deudaId: string | null;
      cuentaId: string | null;
      montoCop: number | null;
      occurredOn?: string;
      raw: string;
    }
  | {
      tipo: 'saldo';
      cajitaId: string | null;
      saldoCop: number | null;
      raw: string;
    }
  | {
      tipo: 'rendimiento';
      cajitaId: string | null;
      montoCop: number | null;
      occurredOn?: string;
      raw: string;
    };

export type ComandoVozConfirmado =
  | { tipo: 'transferencia'; origenId: string; destinoId: string; montoCop: number; occurredOn?: string }
  | { tipo: 'abono'; deudaId: string; cuentaId: string; montoCop: number; occurredOn?: string }
  | { tipo: 'saldo'; cajitaId: string; saldoCop: number }
  | { tipo: 'rendimiento'; cajitaId: string; montoCop: number; occurredOn?: string };

type EntidadVoz = Pick<Cajita, 'id' | 'nombre' | 'tipo' | 'archivedAt'>;

const plano = (texto: string): string =>
  normalizeWord(texto)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patronesEspeciales = (nombre: string): string[] => {
  const limpio = plano(nombre);
  const patrones = [limpio];
  const sinTipo = limpio
    .replace(/^(?:tarjeta(?: de credito)?|credito|prestamo|deuda|cuenta|cajita)(?: de)?(?: la| el)?\s+/, '')
    .trim();
  if (sinTipo.length >= 2) patrones.push(sinTipo);
  if (limpio.includes('nequi')) patrones.push(limpio.replace('nequi', 'neki'));
  if (limpio.includes('daviplata')) patrones.push(limpio.replace('daviplata', 'davi plata'));
  if (limpio.includes('davivienda')) patrones.push(limpio.replace('davivienda', 'davienda'));
  if (limpio.includes('bancolombia')) patrones.push(limpio.replace('bancolombia', 'banco colombia'));
  if (limpio.includes('nubank')) patrones.push(limpio.replace('nubank', 'nu bank'));
  return [...new Set(patrones)].filter(Boolean);
};

const menciona = (texto: string, entidad: EntidadVoz): boolean =>
  patronesEspeciales(entidad.nombre).some((patron) =>
    new RegExp(`(?:^|\\s)${escapar(patron)}(?:$|\\s)`).test(texto),
  );

const mencionadas = (texto: string, entidades: readonly EntidadVoz[]): EntidadVoz[] =>
  entidades
    .filter((entidad) => menciona(texto, entidad))
    .sort((a, b) => b.nombre.length - a.nombre.length);

const trasPreposicion = (
  texto: string,
  preposiciones: string,
  entidades: readonly EntidadVoz[],
): EntidadVoz | null => {
  for (const entidad of [...entidades].sort((a, b) => b.nombre.length - a.nombre.length)) {
    for (const patron of patronesEspeciales(entidad.nombre)) {
      if (
        new RegExp(
          `\\b(?:${preposiciones})\\s+(?:(?:mi|la|el|una|un)\\s+)?${escapar(patron)}(?:$|\\s)`,
        ).test(texto)
      ) {
        return entidad;
      }
    }
  }
  return null;
};

/**
 * Separa órdenes que cambian saldos de un gasto/ingreso ordinario.
 *
 * Devuelve también órdenes incompletas: la pantalla de confirmación pregunta
 * por la cuenta o tarjeta que falte. Nunca ejecuta ni rellena silenciosamente
 * una pieza financiera que la persona no dijo.
 */
export const parseComandoVoz = (
  raw: string,
  entidadesEntrada: readonly EntidadVoz[],
): ComandoVoz | null => {
  const texto = plano(raw);
  const entidades = entidadesEntrada.filter((entidad) => entidad.archivedAt === null);
  const activos = entidades.filter((entidad) => !ES_PASIVO[entidad.tipo]);
  const cuentas = activos.filter((entidad) => entidad.tipo === 'cuenta');
  const pasivos = entidades.filter((entidad) => ES_PASIVO[entidad.tipo]);
  const cajitas = entidades.filter((entidad) => entidad.tipo === 'cajita');
  // El parser financiero puntúa todas las cifras y sabe que «100 mil» pesa más
  // que el 2 del nombre «Cuenta 2». Leer simplemente el primer número cambiaría
  // el saldo a $2, uno de los errores más peligrosos para una orden de voz.
  const lecturaFinanciera = parseTransaction(raw, entidades);
  const monto = lecturaFinanciera.amount;
  const fecha = lecturaFinanciera.dateOverride;

  const mencionesTodas = mencionadas(texto, entidades);
  const mencionesActivos = mencionadas(texto, activos);
  const mencionesCuentas = mencionadas(texto, cuentas);
  const mencionesPasivos = mencionadas(texto, pasivos);
  const mencionesCajitas = mencionadas(texto, cajitas);

  const diceSaldo =
    /\b(?:actualiza|actualizar|ajusta|ajustar|corrige|corregir|cambia|cambiar|fija|fijar|pon|poner)\b.{0,40}\bsaldo\b/.test(texto) ||
    /\bsaldo\s+(?:actual|de|del|en)\b/.test(texto) ||
    /\b(?:tengo|hay)\b.{0,35}\b(?:en|dentro de)\b/.test(texto) ||
    /\b(?:en|dentro de)\b.{0,35}\b(?:tengo|hay)\b/.test(texto) ||
    (/\b(?:debo|deuda actual)\b/.test(texto) && mencionesPasivos.length > 0);

  if (diceSaldo) {
    return {
      tipo: 'saldo',
      cajitaId: mencionesTodas.length === 1 ? mencionesTodas[0].id : null,
      saldoCop:
        monto ?? (/(?:^|\s)(?:0|cero)(?:$|\s)/.test(texto) ? 0 : null),
      raw,
    };
  }

  const verboAbono =
    /\b(?:abona|abone|abonar|abono|paga|pague|pagar|pago|cancela|cancele|cancelar)\b/.test(texto);
  const contextoPasivo =
    mencionesPasivos.length > 0 ||
    /\b(?:tarjeta(?: de credito)?|credito|deuda|prestamo|cuota de la tarjeta)\b/.test(texto);
  const pareceCompraConTarjeta =
    /\bcon\s+(?:(?:mi|la|una)\s+)?tarjeta\b/.test(texto) &&
    !/\b(?:saldo|deuda|cuota|abono)\b/.test(texto);

  if (verboAbono && contextoPasivo && !pareceCompraConTarjeta) {
    const fuenteExplicita = trasPreposicion(texto, 'desde|con|de', mencionesCuentas);
    return {
      tipo: 'abono',
      deudaId: mencionesPasivos.length === 1 ? mencionesPasivos[0].id : null,
      cuentaId: fuenteExplicita?.id ?? (mencionesCuentas.length === 1 ? mencionesCuentas[0].id : null),
      montoCop: monto,
      ...(fecha ? { occurredOn: fecha } : {}),
      raw,
    };
  }

  const diceRendimiento = /\b(?:rendimiento|rendimientos|interes ganado|intereses ganados)\b/.test(texto);
  const pideRegistrar = /\b(?:registra|registre|registrar|anota|anote|anotar|agrega|agregue|sumale|suma)\b/.test(texto);
  if (diceRendimiento && pideRegistrar) {
    return {
      tipo: 'rendimiento',
      cajitaId: mencionesCajitas.length === 1 ? mencionesCajitas[0].id : null,
      montoCop: monto,
      ...(fecha ? { occurredOn: fecha } : {}),
      raw,
    };
  }

  const transferenciaCompleta = parseTransferenciaVoz(raw, activos);
  if (transferenciaCompleta) {
    return {
      tipo: 'transferencia',
      ...transferenciaCompleta,
      ...(fecha ? { occurredOn: fecha } : {}),
    };
  }

  const verboTransferencia = /\b(?:transfiere|transferir|transferi|pasa|pasar|mueve|mover|aparta|apartar|mete|meter|saca|sacar|retira|retirar)\b/.test(texto);
  const verboClaramenteInterno = /\b(?:pasa|pasar|mueve|mover|aparta|apartar|mete|meter|saca|sacar)\b/.test(texto);
  const contextoInterno = /\b(?:entre mis cuentas|entre cuentas|mi cajita|mis cajitas|mis ahorros)\b/.test(texto);
  if (
    verboTransferencia &&
    (mencionesActivos.length >= 2 || ((verboClaramenteInterno || contextoInterno) && mencionesActivos.length >= 1))
  ) {
    const origen = trasPreposicion(texto, 'de|desde', mencionesActivos);
    const destino = trasPreposicion(texto, 'a|hacia|para|en', mencionesActivos);
    const ordenadas = [...mencionesActivos].reverse();
    return {
      tipo: 'transferencia',
      origenId:
        origen?.id ??
        (mencionesActivos.length >= 2 ? ordenadas[0]?.id ?? null : null),
      destinoId:
        destino?.id ??
        (mencionesActivos.length >= 2
          ? ordenadas[1]?.id ?? null
          : origen
            ? null
            : mencionesActivos[0]?.id ?? null),
      montoCop: monto,
      ...(fecha ? { occurredOn: fecha } : {}),
      raw,
    };
  }

  return null;
};
