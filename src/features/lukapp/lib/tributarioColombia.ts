import type { Transaction } from '../types';
import { type ValorUvt, UVT_POR_DEFECTO } from './gmf';

/**
 * Módulo de Inteligencia Tributaria y Fiscal Colombiana para Personas Naturales e Independientes.
 *
 * Basado en el Estatuto Tributario (Artículos 383, 392, 592, 594-3 y 879) y normatividad DIAN.
 */

export const TOPES_RENTA_UVT = {
  INGRESOS_BRUTOS: 1400,
  COMPRAS_CONSUMOS: 1400,
  TARJETAS_CREDITO: 1400,
  CONSIGNACIONES_DEPOSITOS: 1400,
  PATRIMONIO_BRUTO: 4500,
} as const;

export interface EstadoSemaforoRenta {
  anio: number;
  uvt: ValorUvt;
  topeConsignacionesPesos: number;
  acumuladoConsignacionesPesos: number;
  porcentajeConsignaciones: number;
  topeComprasPesos: number;
  acumuladoComprasPesos: number;
  porcentajeCompras: number;
  semaforoGeneral: 'verde' | 'amarillo' | 'alerta';
  mensajeConsejo: string;
  detalles: {
    umbralUVT: number;
    faltanteParaTope: number;
    debeDeclararEstimado: boolean;
  };
}

/**
 * Evalúa el acumulado del año frente a los topes de la DIAN para determinar
 * si el usuario se acerca o supera la obligación de declarar renta.
 */
export const analizarTopesRenta = (
  transacciones: readonly Transaction[],
  anio: number = new Date().getFullYear(),
  uvt: ValorUvt = UVT_POR_DEFECTO,
): EstadoSemaforoRenta => {
  const anioStr = String(anio);
  const transaccionesAnio = transacciones.filter(
    (t) => t.occurredOn && t.occurredOn.startsWith(anioStr),
  );

  // Total ingresos y consignaciones
  const acumuladoConsignaciones = transaccionesAnio
    .filter((t) => t.kind === 'ingreso')
    .reduce((sum, t) => sum + Math.abs(t.amountCop), 0);

  // Total compras y gastos
  const acumuladoCompras = transaccionesAnio
    .filter((t) => t.kind === 'gasto')
    .reduce((sum, t) => sum + Math.abs(t.amountCop), 0);

  const topePesos = TOPES_RENTA_UVT.INGRESOS_BRUTOS * uvt.pesos;

  const pctConsignaciones = Math.min(100, Math.round((acumuladoConsignaciones / topePesos) * 100));
  const pctCompras = Math.min(100, Math.round((acumuladoCompras / topePesos) * 100));
  const pctMax = Math.max(pctConsignaciones, pctCompras);

  let semaforo: 'verde' | 'amarillo' | 'alerta' = 'verde';
  let consejo = 'Estás dentro de los márgenes no declarantes de la DIAN para este año.';

  const faltante = Math.max(0, topePesos - Math.max(acumuladoConsignaciones, acumuladoCompras));
  const debeDeclarar = acumuladoConsignaciones >= topePesos || acumuladoCompras >= topePesos;

  if (debeDeclarar) {
    semaforo = 'alerta';
    consejo = `¡Atención! Tus movimientos de ${anio} superaron el tope de ${TOPES_RENTA_UVT.INGRESOS_BRUTOS} UVT ($${topePesos.toLocaleString('es-CO')}). Deberás presentar declaración de renta ante la DIAN el próximo año.`;
  } else if (pctMax >= 75) {
    semaforo = 'amarillo';
    consejo = `Llevas el ${pctMax}% del tope de movimientos para declarar renta ($${Math.max(acumuladoConsignaciones, acumuladoCompras).toLocaleString('es-CO')} de $${topePesos.toLocaleString('es-CO')}). Te faltan $${faltante.toLocaleString('es-CO')} antes de alcanzar el umbral.`;
  } else {
    semaforo = 'verde';
    consejo = `Tranquilo: llevas el ${pctMax}% del tope de movimientos anuales. Tu margen libre antes de declarar es de $${faltante.toLocaleString('es-CO')}.`;
  }

  return {
    anio,
    uvt,
    topeConsignacionesPesos: topePesos,
    acumuladoConsignacionesPesos: acumuladoConsignaciones,
    porcentajeConsignaciones: pctConsignaciones,
    topeComprasPesos: topePesos,
    acumuladoComprasPesos: acumuladoCompras,
    porcentajeCompras: pctCompras,
    semaforoGeneral: semaforo,
    mensajeConsejo: consejo,
    detalles: {
      umbralUVT: TOPES_RENTA_UVT.INGRESOS_BRUTOS,
      faltanteParaTope: faltante,
      debeDeclararEstimado: debeDeclarar,
    },
  };
};

export interface OpcionesRetencion {
  declaraRenta?: boolean;
  tipo?: 'honorarios' | 'servicios' | 'comisiones';
  tarifaReteIcaPorMil?: number; // e.g. 9.66 por mil
  incluirSeguridadSocial?: boolean;
}

export interface LiquidacionCuentaCobro {
  montoBruto: number;
  tarifaRetefuentePct: number;
  valorRetefuente: number;
  tarifaReteIcaPorMil: number;
  valorReteIca: number;
  totalRetenciones: number;
  netoARecibir: number;
  seguridadSocialSugerida: {
    ibc: number; // 40% del bruto (mínimo 1 SMMLV)
    salud: number; // 12.5%
    pension: number; // 16%
    arlNivel1: number; // 0.522%
    totalAportes: number;
  };
}

/**
 * Simula la liquidación de una cuenta de cobro para independientes o freelancers en Colombia,
 * calculando retención en la fuente, ReteICA y aportes sugeridos a seguridad social (PILAS).
 */
export const calcularRetencionHonorarios = (
  montoBruto: number,
  opciones: OpcionesRetencion = {},
): LiquidacionCuentaCobro => {
  const bruto = Math.max(0, Math.round(montoBruto));
  const declara = opciones.declaraRenta ?? false;
  const tipo = opciones.tipo ?? 'honorarios';
  const reteIcaPorMil = opciones.tarifaReteIcaPorMil ?? 9.66; // Tarifa estándar actividades profesionales

  let tarifaRetePct = 10;
  if (tipo === 'honorarios' || tipo === 'comisiones') {
    tarifaRetePct = declara ? 11 : 10;
  } else if (tipo === 'servicios') {
    tarifaRetePct = declara ? 4 : 6;
  }

  const valorRetefuente = Math.round(bruto * (tarifaRetePct / 100));
  const valorReteIca = Math.round(bruto * (reteIcaPorMil / 1000));
  const totalRetenciones = valorRetefuente + valorReteIca;
  const netoARecibir = Math.max(0, bruto - totalRetenciones);

  // Seguridad social independiente: IBC del 40% (base mínima calculada)
  const ibc = Math.round(bruto * 0.4);
  const salud = Math.round(ibc * 0.125);
  const pension = Math.round(ibc * 0.16);
  const arlNivel1 = Math.round(ibc * 0.00522);
  const totalAportes = salud + pension + arlNivel1;

  return {
    montoBruto: bruto,
    tarifaRetefuentePct: tarifaRetePct,
    valorRetefuente,
    tarifaReteIcaPorMil: reteIcaPorMil,
    valorReteIca,
    totalRetenciones,
    netoARecibir,
    seguridadSocialSugerida: {
      ibc,
      salud,
      pension,
      arlNivel1,
      totalAportes,
    },
  };
};
