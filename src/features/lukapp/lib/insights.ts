import type { CategoriaClave, Transaction } from '../types';
import type { Presupuesto } from './presupuestos';
import { estadoDeTodos, tonoDe } from './presupuestos';
import { monthKey } from './localDate';

/**
 * "Para ti": lo que la app nota por su cuenta, sin que nadie pregunte.
 *
 * Todo aquí se CALCULA, nunca se le pide a un modelo. En finanzas una cifra
 * inventada es peor que ninguna cifra —ya pasó una vez con el dictado por voz,
 * un "Gracias" de Whisper se volvió un gasto de $100— así que los números que
 * alguien podría usar para decidir algo tienen que salir de una cuenta que se
 * pueda repetir a mano y le dé igual siempre. Un modelo de lenguaje puede
 * REDACTAR bonito; no puede ser la fuente de un hecho sobre la plata de nadie.
 *
 * Por la misma razón, esto no manda nada a ningún servidor: corre en el
 * aparato, funciona sin conexión y no depende de que exista una llave de IA.
 */
export interface Insight {
  id: string;
  titulo: string;
  detalle: string;
  tono: 'neutral' | 'bien' | 'atento';
  /** Qué sección abrir si lo tocan. `null` cuando no lleva a ningún lado. */
  seccion: 'mes' | 'dinero' | null;
  /** Si fue enriquecido o generado por IA (Grok / Groq) */
  origenIa?: boolean;
}

const REDONDEO_PCT = (n: number): number => Math.round(n * 10) / 10;

/**
 * Cuántos meses completos y anteriores a `mes` hay transacciones.
 *
 * Sirve de guarda para no comparar un mes contra un promedio que en realidad
 * es un solo dato suelto: eso no es un patrón, es ruido con forma de patrón.
 */
const mesesConHistoria = (transacciones: readonly Transaction[], mes: string): Set<string> => {
  const meses = new Set<string>();
  for (const tx of transacciones) {
    const m = monthKey(tx.occurredOn);
    if (m < mes) meses.add(m);
  }
  return meses;
};

const gastosDelMes = (
  transacciones: readonly Transaction[],
  mes: string,
): readonly Transaction[] => transacciones.filter((tx) => tx.kind === 'gasto' && monthKey(tx.occurredOn) === mes);

/**
 * Proyección de cierre: al ritmo actual, cuánto se gasta el mes completo.
 *
 * Necesita al menos tres días transcurridos porque con uno o dos el "ritmo"
 * es básicamente el azar de qué se compró ese día — proyectar sobre eso
 * asusta sin decir nada de verdad.
 */
const proyeccionDeCierre = (
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): Insight | null => {
  if (monthKey(hoy) !== mes) return null;
  const diaHoy = Number(hoy.slice(8, 10));
  if (diaHoy < 3) return null;

  const [anio, m] = mes.split('-').map(Number);
  const diasDelMes = new Date(Date.UTC(anio, m, 0)).getUTCDate();

  const gastado = gastosDelMes(transacciones, mes).reduce((t, tx) => t + tx.amountCop, 0);
  if (gastado === 0) return null;

  const proyectado = Math.round((gastado / diaHoy) * diasDelMes);

  return {
    id: 'proyeccion-cierre',
    titulo: `Vas camino a cerrar el mes en ${formatCopCorto(proyectado)}`,
    detalle: `Llevas ${formatCopCorto(gastado)} en ${diaHoy} de ${diasDelMes} días. Si sigues a este ritmo, así cierra el mes.`,
    tono: 'neutral',
    seccion: 'mes',
  };
};

/**
 * Compara una categoría contra su propio promedio de los tres meses previos.
 *
 * Contra el promedio propio, no contra una regla de fábrica: "gastas mucho en
 * comida" no significa nada sin saber si ESA persona gasta mucho o poco en
 * comida normalmente. El único punto de comparación justo es uno mismo.
 */
const desviacionPorCategoria = (
  transacciones: readonly Transaction[],
  mes: string,
  nombreDe: (categoria: CategoriaClave) => string,
): Insight | null => {
  const historial = mesesConHistoria(transacciones, mes);
  if (historial.size < 2) return null;

  const mesesPrevios = [...historial].sort().slice(-3);

  const porCategoriaEsteMes = new Map<CategoriaClave, number>();
  for (const tx of gastosDelMes(transacciones, mes)) {
    porCategoriaEsteMes.set(tx.category, (porCategoriaEsteMes.get(tx.category) ?? 0) + tx.amountCop);
  }

  let peorCategoria: CategoriaClave | null = null;
  let peorPct = 0;
  let peorEsteMes = 0;
  let peorPromedio = 0;

  for (const [categoria, esteMes] of porCategoriaEsteMes) {
    if (esteMes < 20_000) continue; // Categorías chiquitas no dan un patrón, dan ruido.

    const sumaPrevia = mesesPrevios.reduce(
      (t, m) => t + gastosDelMes(transacciones, m).filter((tx) => tx.category === categoria).reduce((s, tx) => s + tx.amountCop, 0),
      0,
    );
    const promedio = sumaPrevia / mesesPrevios.length;
    if (promedio < 10_000) continue; // Sin promedio real, "más que el promedio" no dice nada.

    const pct = ((esteMes - promedio) / promedio) * 100;
    if (pct > peorPct) {
      peorPct = pct;
      peorCategoria = categoria;
      peorEsteMes = esteMes;
      peorPromedio = promedio;
    }
  }

  if (!peorCategoria || peorPct < 25) return null;

  return {
    id: `desviacion-${peorCategoria}`,
    titulo: `${nombreDe(peorCategoria)} subió ${REDONDEO_PCT(peorPct)}% este mes`,
    detalle: `Llevas ${formatCopCorto(peorEsteMes)}, contra un promedio de ${formatCopCorto(Math.round(peorPromedio))} en los últimos ${mesesPrevios.length} meses.`,
    tono: 'atento',
    seccion: 'mes',
  };
};

/**
 * Gasto hormiga: muchas compras chiquitas que juntas ya son una cifra seria.
 *
 * El umbral (10 mil) y el piso de conteo (6) existen para que esto no dispare
 * con "compraste café dos veces" — hace falta un patrón real, no dos datos.
 */
const gastoHormiga = (
  transacciones: readonly Transaction[],
  mes: string,
  nombreDe: (categoria: CategoriaClave) => string,
): Insight | null => {
  const chiquitos = gastosDelMes(transacciones, mes).filter((tx) => tx.amountCop < 10_000);
  if (chiquitos.length < 6) return null;

  const total = chiquitos.reduce((t, tx) => t + tx.amountCop, 0);
  if (total < 30_000) return null;

  const totalGastosMes = gastosDelMes(transacciones, mes).reduce((t, tx) => t + tx.amountCop, 0);
  const pctGasto = totalGastosMes > 0 ? Math.round((total / totalGastosMes) * 100) : 0;

  // Encontrar la categoría más frecuente en estas compras chiquitas
  const conteoCat = new Map<CategoriaClave, number>();
  for (const t of chiquitos) {
    conteoCat.set(t.category, (conteoCat.get(t.category) || 0) + 1);
  }
  let topCat: CategoriaClave | null = null;
  let topCount = 0;
  for (const [cat, cnt] of conteoCat) {
    if (cnt > topCount) {
      topCount = cnt;
      topCat = cat;
    }
  }

  let detalle = 'Nada de esto se ve grande solo, pero junto sí es plata. Vale la pena mirarlo.';
  if (topCat && topCount >= 4) {
    const nombreCategoria = nombreDe(topCat);
    detalle = `La mayoría (${topCount}) son en ${nombreCategoria}. Proyectado al año sumarían ${formatCopCorto(total * 12)}.`;
  } else if (pctGasto >= 10) {
    detalle = `Representan el ${pctGasto}% de tus gastos del mes. Un recorte del 30% liberaría ${formatCopCorto(Math.round(total * 0.3))}.`;
  }

  return {
    id: 'gasto-hormiga',
    titulo: `${chiquitos.length} compras chiquitas suman ${formatCopCorto(total)}`,
    detalle,
    tono: 'neutral',
    seccion: 'mes',
  };
};

/** El primer presupuesto realmente en aprietos, si hay alguno. */
const avisoDePresupuesto = (
  presupuestos: readonly Presupuesto[],
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
  nombreDe: (categoria: CategoriaClave) => string,
): Insight | null => {
  const estados = estadoDeTodos(presupuestos, transacciones, mes, hoy);
  const critico = estados.find((e) => tonoDe(e) !== 'bien');
  if (!critico) return null;

  const excedido = critico.excedidoCop > 0;
  return {
    id: `presupuesto-${critico.categoria}`,
    titulo: excedido
      ? `Te pasaste ${formatCopCorto(critico.excedidoCop)} en ${nombreDe(critico.categoria)}`
      : `${nombreDe(critico.categoria)} va camino a pasarse del presupuesto`,
    detalle: excedido
      ? `El tope era ${formatCopCorto(critico.topeCop)} y llevas ${formatCopCorto(critico.gastadoCop)}.`
      : `Al ritmo actual cierras en ${formatCopCorto(critico.proyectadoCop)}, y el tope es ${formatCopCorto(critico.topeCop)}.`,
    tono: 'atento',
    seccion: 'mes',
  };
};

/**
 * Tasa de ahorro alta o balance positivo destacado en el mes.
 */
const tasaDeAhorroInsight = (
  transacciones: readonly Transaction[],
  mes: string,
): Insight | null => {
  const ingresos = transacciones
    .filter((tx) => tx.kind === 'ingreso' && monthKey(tx.occurredOn) === mes)
    .reduce((t, tx) => t + tx.amountCop, 0);
  const gastos = gastosDelMes(transacciones, mes).reduce((t, tx) => t + tx.amountCop, 0);

  if (ingresos < 150_000) return null;
  const tasa = Math.round(((ingresos - gastos) / ingresos) * 100);

  if (tasa >= 40) {
    return {
      id: 'tasa-ahorro-alta',
      titulo: `Tasa de ahorro del ${tasa}% este mes`,
      detalle: `Has retenido ${formatCopCorto(ingresos - gastos)} de tus ingresos. Excelente margen para tus metas.`,
      tono: 'bien',
      seccion: 'mes',
    };
  } else if (tasa < 0 && gastos > 100_000) {
    return {
      id: 'balance-negativo-mes',
      titulo: `Gastos superan ingresos por ${formatCopCorto(gastos - ingresos)}`,
      detalle: `Llevas ${formatCopCorto(gastos)} en salidas frente a ${formatCopCorto(ingresos)} de entradas este mes.`,
      tono: 'atento',
      seccion: 'mes',
    };
  }
  return null;
};

/**
 * Concentración de gasto: una sola transacción muy grande que sesga el mes.
 */
const mayorGastoMes = (
  transacciones: readonly Transaction[],
  mes: string,
  nombreDe: (categoria: CategoriaClave) => string,
): Insight | null => {
  const gastos = gastosDelMes(transacciones, mes);
  if (gastos.length < 4) return null;
  const total = gastos.reduce((t, tx) => t + tx.amountCop, 0);
  if (total < 100_000) return null;

  const maxTx = gastos.reduce((prev, curr) => (curr.amountCop > prev.amountCop ? curr : prev), gastos[0]);
  const pct = Math.round((maxTx.amountCop / total) * 100);

  if (pct >= 35 && maxTx.amountCop >= 50_000) {
    const desc = maxTx.description?.trim() || nombreDe(maxTx.category);
    return {
      id: `gran-gasto-${maxTx.id}`,
      titulo: `${desc.slice(0, 22)} concentró ${pct}% del mes`,
      detalle: `Un solo movimiento de ${formatCopCorto(maxTx.amountCop)} representó más de un tercio de todas tus salidas.`,
      tono: 'neutral',
      seccion: 'mes',
    };
  }
  return null;
};

/** Cifras cortas para una frase, no para un libro contable: sin el "$1.234.567,00". */
export const formatCopCorto = (valor: number): string => {
  const millones = valor / 1_000_000;
  if (Math.abs(millones) >= 1) {
    return `$${millones.toFixed(millones >= 10 ? 0 : 1).replace('.0', '')}M`;
  }
  const miles = Math.round(valor / 1000);
  return `$${miles.toLocaleString('es-CO')} mil`;
};

/**
 * Todos los insights del mes, el más urgente primero, máximo tres.
 *
 * El tope de tres es a propósito: la meta no es decir todo lo que se pueda
 * calcular, es decir lo que de verdad vale la pena leer. Una lista larga se
 * vuelve papel tapiz y deja de leerse.
 */
export const insightsDelMes = (
  transacciones: readonly Transaction[],
  presupuestos: readonly Presupuesto[],
  mes: string,
  hoy: string,
  nombreDe: (categoria: CategoriaClave) => string,
): Insight[] => {
  const candidatos = [
    avisoDePresupuesto(presupuestos, transacciones, mes, hoy, nombreDe),
    desviacionPorCategoria(transacciones, mes, nombreDe),
    gastoHormiga(transacciones, mes, nombreDe),
    proyeccionDeCierre(transacciones, mes, hoy),
    tasaDeAhorroInsight(transacciones, mes),
    mayorGastoMes(transacciones, mes, nombreDe),
  ].filter((i): i is Insight => i !== null);

  // Lo "atento" primero: es lo que todavía se puede hacer algo al respecto.
  const orden = { atento: 0, bien: 1, neutral: 2 } as const;
  return candidatos.sort((a, b) => orden[a.tono] - orden[b.tono]).slice(0, 3);
};
