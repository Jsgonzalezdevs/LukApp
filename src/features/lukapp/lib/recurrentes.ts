import type { CategoriaClave, Transaction, TxKind } from '../types';
import { monthKey } from './localDate';
import { extraerContraparte } from './contraparte';

/**
 * Algo que se repite todos los meses: el arriendo, Netflix, el gimnasio.
 *
 * La app NO los registra sola. Los propone y espera un toque, porque un
 * movimiento inventado es plata falsa en un libro contable: si el cobro no pasó
 * — te cancelaron el servicio, cambió el monto, el banco lo rechazó — un
 * registro automático deja el saldo mintiendo y nadie se entera hasta que
 * cuadra mal el mes.
 */
export interface Recurrente {
  id: string;
  nombre: string;
  kind: TxKind;
  amountCop: number;
  categoria: CategoriaClave;
  /** De dónde sale, cuando se sabe. */
  cuentaId: string | null;
  /** Día del mes en que suele caer, 1..31. */
  diaDelMes: number;
  createdAt: string;
  /** Se archiva en vez de borrarse: lo ya registrado sigue siendo válido. */
  archivedAt: string | null;
}

/** Días que de verdad tiene ese mes. */
const diasDelMes = (mes: string): number => {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
};

/**
 * La fecha en que toca este mes.
 *
 * Un recurrente del día 31 en febrero cae el 28, no se salta el mes ni se va a
 * marzo: quien paga el arriendo el último día lo paga igual en febrero.
 */
export const fechaEnMes = (recurrente: Recurrente, mes: string): string => {
  const dia = Math.min(Math.max(1, recurrente.diaDelMes), diasDelMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
};

/**
 * Si ya hay un movimiento que claramente es este recurrente.
 *
 * Se compara por monto, tipo y categoría dentro del mes, no por descripción: el
 * usuario pudo registrarlo a mano escribiendo otra cosa, y volver a proponerlo
 * lo llevaría a cobrarse dos veces el mismo arriendo.
 */
export const yaRegistrado = (
  recurrente: Recurrente,
  transacciones: readonly Transaction[],
  mes: string,
): boolean =>
  transacciones.some(
    (tx) =>
      monthKey(tx.occurredOn) === mes &&
      tx.kind === recurrente.kind &&
      tx.category === recurrente.categoria &&
      tx.amountCop === recurrente.amountCop,
  );

export interface Pendiente {
  recurrente: Recurrente;
  /** La fecha con la que se registraría. */
  fecha: string;
  /** True cuando ese día ya pasó y todavía no aparece. */
  vencido: boolean;
}

/**
 * Lo que falta por registrar este mes, lo más atrasado primero.
 *
 * Solo se proponen los que ya llegó su día. Ofrecer el arriendo del 30 cuando
 * estamos a 3 invita a registrarlo antes de que ocurra, y un libro que va
 * adelantado es tan inútil como uno atrasado.
 */
export const pendientesDelMes = (
  recurrentes: readonly Recurrente[],
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): Pendiente[] => {
  const vivos = recurrentes.filter((r) => r.archivedAt === null);

  return vivos
    .map((recurrente) => ({
      recurrente,
      fecha: fechaEnMes(recurrente, mes),
      vencido: false,
    }))
    .filter(({ fecha }) => fecha <= hoy)
    .filter(({ recurrente }) => !yaRegistrado(recurrente, transacciones, mes))
    .map((p) => ({ ...p, vencido: p.fecha < hoy }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
};

/** El movimiento que se crearía al aceptar un pendiente. */
export const comoTransaccion = (
  pendiente: Pendiente,
  id: string,
  createdAt: string,
): Transaction => ({
  id,
  kind: pendiente.recurrente.kind,
  amountCop: pendiente.recurrente.amountCop,
  category: pendiente.recurrente.categoria,
  description: pendiente.recurrente.nombre,
  occurredOn: pendiente.fecha,
  cuentaId: pendiente.recurrente.cuentaId,
  // Queda dicho que salió de un recurrente y no de un dictado: si mañana el
  // monto cambia, se puede ver cuáles venían de la plantilla vieja.
  rawTranscript: `Recurrente: ${pendiente.recurrente.nombre}`,
  createdAt,
});

/** Cuánto suman al mes los recurrentes vivos, por dirección. */
export const totalMensual = (
  recurrentes: readonly Recurrente[],
): { gastoCop: number; ingresoCop: number } => {
  let gastoCop = 0;
  let ingresoCop = 0;
  for (const r of recurrentes) {
    if (r.archivedAt !== null) continue;
    if (r.kind === 'ingreso') ingresoCop += r.amountCop;
    else gastoCop += r.amountCop;
  }
  return { gastoCop, ingresoCop };
};

export interface SugerenciaSuscripcion {
  clave: string;
  nombre: string;
  kind: TxKind;
  amountCop: number;
  categoria: CategoriaClave;
  cuentaId: string | null;
  diaDelMes: number;
  meses: number;
  promedioCop: number;
  ultimaFecha: string;
  recurrenteExistente: Recurrente | null;
  cambioPrecio: boolean;
}

const parteNormalizada = (texto: string): string =>
  (extraerContraparte(texto) ?? texto).trim().toLocaleLowerCase('es-CO').replace(/\\s+/g, ' ');

const numeroMes = (fecha: string): number => {
  const [anio, mes] = fecha.slice(0, 7).split('-').map(Number);
  return anio * 12 + mes;
};

/**
 * Encuentra cobros mensuales suficientemente consistentes para sugerir una
 * plantilla. Las sugerencias nunca se registran como movimiento por sí solas.
 */
export const detectarSuscripciones = (
  transacciones: readonly Transaction[],
  recurrentes: readonly Recurrente[],
  hoy: string,
): SugerenciaSuscripcion[] => {
  const grupos = new Map<string, Transaction[]>();
  for (const tx of transacciones) {
    if (tx.afectaSaldo === false || tx.kind === 'transferencia' || tx.amountCop <= 0) continue;
    const parte = parteNormalizada(tx.description);
    if (!parte) continue;
    const clave = `${tx.kind}|${parte}`;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(tx);
    grupos.set(clave, grupo);
  }

  const vivos = recurrentes.filter((r) => r.archivedAt === null);
  const sugerencias: SugerenciaSuscripcion[] = [];
  for (const [clave, grupo] of grupos) {
    const porMes = new Map<string, Transaction[]>();
    for (const tx of grupo) {
      const mes = monthKey(tx.occurredOn);
      const filas = porMes.get(mes) ?? [];
      filas.push(tx);
      porMes.set(mes, filas);
    }
    const meses = [...porMes.keys()].sort();
    if (meses.length < 3) continue;
    const ultimosTres = meses.slice(-3);
    const ultimosIndex = ultimosTres.map(numeroMes);
    if (ultimosIndex[2] !== numeroMes(hoy) && ultimosIndex[2] !== numeroMes(hoy) - 1) continue;
    if (ultimosIndex[1] !== ultimosIndex[2] - 1 || ultimosIndex[0] !== ultimosIndex[1] - 1) continue;

    const filasMes = ultimosTres.map((mes) => {
      const filas = porMes.get(mes) ?? [];
      return filas.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0];
    });
    const montos = filasMes.map((tx) => tx.amountCop).sort((a, b) => a - b);
    const mediana = montos[1];
    if (montos.some((monto) => Math.abs(monto - mediana) / mediana > 0.15)) continue;
    const ultima = filasMes[2];
    const recurrente = vivos.find((r) => r.kind === ultima.kind && parteNormalizada(r.nombre) === clave.slice(clave.indexOf('|') + 1)) ?? null;
    const cambioPrecio = recurrente !== null && Math.abs(ultima.amountCop - recurrente.amountCop) / recurrente.amountCop > 0.15;
    if (recurrente && !cambioPrecio) continue;
    sugerencias.push({
      clave,
      nombre: recurrente?.nombre ?? (extraerContraparte(ultima.description) ?? ultima.description).trim(),
      kind: ultima.kind,
      amountCop: ultima.amountCop,
      categoria: ultima.category,
      cuentaId: ultima.cuentaId,
      diaDelMes: Number(ultima.occurredOn.slice(-2)),
      meses: meses.length,
      promedioCop: Math.round(montos.reduce((suma, monto) => suma + monto, 0) / montos.length),
      ultimaFecha: ultima.occurredOn,
      recurrenteExistente: recurrente,
      cambioPrecio,
    });
  }
  return sugerencias.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

/** Próximas fechas de cobro programadas, limitadas a los siguientes 60 días. */
export const proximosRecurrentes = (
  recurrentes: readonly Recurrente[],
  hoy: string,
  transacciones: readonly Transaction[] = [],
  dias = 60,
): { recurrente: Recurrente; fecha: string }[] => {
  const fin = new Date(`${hoy}T12:00:00`);
  fin.setDate(fin.getDate() + dias);
  const hasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
  const meses = new Set<string>();
  for (let cursor = new Date(`${hoy}T12:00:00`); cursor.toISOString().slice(0, 10) <= hasta; cursor.setDate(cursor.getDate() + 1)) {
    meses.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
  }
  return recurrentes
    .filter((r) => r.archivedAt === null && r.kind === 'gasto')
    .flatMap((recurrente) => [...meses].map((mes) => ({ recurrente, fecha: fechaEnMes(recurrente, mes) })))
    .filter(({ fecha, recurrente }) => fecha >= hoy && fecha <= hasta && !yaRegistrado(recurrente, transacciones, monthKey(fecha)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.recurrente.nombre.localeCompare(b.recurrente.nombre, 'es'));
};
