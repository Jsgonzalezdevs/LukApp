import type { CategoriaClave, Transaction } from '../types';
import {
  claveDePeriodo,
  diasDelPeriodo,
  diasTranscurridosEnPeriodo,
  enElPeriodo,
  type ConfigPeriodo,
} from './periodo';

/**
 * Un tope de gasto mensual para una categoría.
 *
 * Es un límite que el usuario se pone, no un dato del banco: sirve para saber
 * cómo va el período mientras todavía se puede hacer algo, que es lo único
 * que distingue un presupuesto de un informe de fin de período.
 */
export interface Presupuesto {
  /** La categoría que limita. Una por categoría; el id ES la clave. */
  categoria: CategoriaClave;
  montoCop: number;
  createdAt: string;
}

/**
 * Dónde va una categoría contra su tope.
 *
 * `proyectadoCop` es lo que se gastaría al ritmo actual si el período
 * siguiera igual. Se muestra aparte del gasto real y nunca en su lugar: es
 * una suposición, y presentarla como un hecho haría que alguien tomara una
 * decisión sobre plata que todavía no ha salido. `null` en 'todo el tiempo':
 * un período sin cierre no tiene nada que proyectar.
 */
export interface EstadoPresupuesto {
  categoria: CategoriaClave;
  topeCop: number;
  gastadoCop: number;
  disponibleCop: number;
  pctUsado: number;
  proyectadoCop: number | null;
  /** True cuando el ritmo actual termina el período por encima del tope. */
  vaARebasar: boolean;
  excedidoCop: number;
}

export const gastadoEnCategoria = (
  transacciones: readonly Transaction[],
  clave: string,
  config: ConfigPeriodo,
  categoria: CategoriaClave,
): number => {
  let total = 0;
  for (const tx of transacciones) {
    if (tx.kind !== 'gasto') continue;
    if (tx.category !== categoria) continue;
    if (!enElPeriodo(tx.occurredOn, clave, config)) continue;
    total += tx.amountCop;
  }
  return total;
};

/**
 * Lo que se gasta normalmente por período en una categoría, para ayudar a
 * poner un tope realista en vez de adivinar.
 *
 * Promedia sobre los períodos anteriores donde hubo algún gasto en la
 * categoría — nunca sobre el período en curso, porque uno a medio transcurrir
 * promedia bajo y sugeriría un tope más chico de lo que la categoría
 * realmente cuesta. `null` sin historial, o en 'todo el tiempo' -- ahí no
 * existen "períodos anteriores" que promediar, todo es un único período.
 */
export const promedioPorPeriodoCategoria = (
  transacciones: readonly Transaction[],
  categoria: CategoriaClave,
  claveActual: string,
  config: ConfigPeriodo,
): number | null => {
  if (config.frecuencia === 'todo-el-tiempo') return null;
  const porPeriodo = new Map<string, number>();
  for (const tx of transacciones) {
    if (tx.kind !== 'gasto') continue;
    if (tx.category !== categoria) continue;
    const clave = claveDePeriodo(tx.occurredOn, config);
    if (clave === claveActual) continue;
    porPeriodo.set(clave, (porPeriodo.get(clave) ?? 0) + tx.amountCop);
  }
  if (porPeriodo.size === 0) return null;
  const total = [...porPeriodo.values()].reduce((a, b) => a + b, 0);
  return Math.round(total / porPeriodo.size);
};

export const estadoDePresupuesto = (
  presupuesto: Presupuesto,
  transacciones: readonly Transaction[],
  clave: string,
  hoy: string,
  config: ConfigPeriodo,
): EstadoPresupuesto => {
  const gastadoCop = gastadoEnCategoria(transacciones, clave, config, presupuesto.categoria);
  const topeCop = presupuesto.montoCop;

  const dias = diasDelPeriodo(clave, config);
  const transcurridos = diasTranscurridosEnPeriodo(clave, hoy, config);

  // Sin días transcurridos no hay ritmo que proyectar, y dividir por cero
  // daría Infinity — que en pantalla se lee como una cifra, no como "no se
  // sabe". Sin fin de período ('todo el tiempo') tampoco hay nada que cerrar.
  const proyectadoCop =
    dias === null || transcurridos === null
      ? null
      : transcurridos === 0
        ? gastadoCop
        : Math.round((gastadoCop / transcurridos) * dias);

  return {
    categoria: presupuesto.categoria,
    topeCop,
    gastadoCop,
    disponibleCop: Math.max(0, topeCop - gastadoCop),
    pctUsado: topeCop === 0 ? 0 : Math.min(999, Math.round((gastadoCop / topeCop) * 1000) / 10),
    proyectadoCop,
    vaARebasar: proyectadoCop !== null && proyectadoCop > topeCop,
    excedidoCop: Math.max(0, gastadoCop - topeCop),
  };
};

/** Todos los presupuestos del período, los más apretados primero. */
export const estadoDeTodos = (
  presupuestos: readonly Presupuesto[],
  transacciones: readonly Transaction[],
  clave: string,
  hoy: string,
  config: ConfigPeriodo,
): EstadoPresupuesto[] =>
  presupuestos
    .map((p) => estadoDePresupuesto(p, transacciones, clave, hoy, config))
    // Lo que más urge va arriba: primero lo ya excedido, luego lo que va camino
    // de estarlo. Un presupuesto holgado no necesita que lo miren.
    .sort((a, b) => b.pctUsado - a.pctUsado);

export type TonoPresupuesto = 'bien' | 'atento' | 'excedido';

/**
 * Cómo va, en una palabra.
 *
 * `atento` no es un regaño: es el único estado que todavía sirve de algo,
 * porque avisa cuando aún queda período por delante para corregir.
 * `umbralAlertaPct` es configurable desde Ajustes (80 por defecto, el mismo
 * valor que este código tenía fijo antes de que existiera ese ajuste).
 */
export const tonoDe = (estado: EstadoPresupuesto, umbralAlertaPct: number = 80): TonoPresupuesto => {
  if (estado.excedidoCop > 0) return 'excedido';
  if (estado.vaARebasar || estado.pctUsado >= umbralAlertaPct) return 'atento';
  return 'bien';
};
