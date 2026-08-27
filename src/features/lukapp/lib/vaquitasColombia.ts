/**
 * Módulo de "Vaquitas" y Gastos Compartidos a la Colombiana.
 * Permite organizar salidas, paseos, regalos o fondos familiares calculando
 * aportes, gastos y balances de quién le debe a quién.
 */

export interface ParticipanteVaquita {
  nombre: string;
  cuotaComprometida: number;
  aportadoCop: number;
}

export interface GastoVaquita {
  id: string;
  descripcion: string;
  montoCop: number;
  pagadoPor: string;
  fecha: string;
}

export interface Vaquita {
  id: string;
  nombre: string;
  emoji: string;
  metaCop: number;
  participantes: ParticipanteVaquita[];
  gastos: GastoVaquita[];
  creadaEn: string;
}

export interface DeudaLiquidacion {
  deudor: string;
  acreedor: string;
  montoCop: number;
}

export interface ResumenVaquita {
  totalRecolectado: number;
  totalGastado: number;
  saldoDisponible: number;
  porcentajeRecoleccion: number;
  estaCompleta: boolean;
  pendientesPorPagar: { nombre: string; faltante: number }[];
  liquidacionesSugeridas: DeudaLiquidacion[];
}

/**
 * Calcula el estado financiero de una vaquita y calcula cómo saldar cuentas
 * entre los participantes.
 */
export const calcularResumenVaquita = (vaquita: Vaquita): ResumenVaquita => {
  const totalRecolectado = vaquita.participantes.reduce((sum, p) => sum + Math.max(0, p.aportadoCop), 0);
  const totalGastado = vaquita.gastos.reduce((sum, g) => sum + Math.max(0, g.montoCop), 0);
  const saldoDisponible = totalRecolectado - totalGastado;

  const meta = vaquita.metaCop > 0 ? vaquita.metaCop : vaquita.participantes.reduce((s, p) => s + p.cuotaComprometida, 0);
  const porcentaje = meta > 0 ? Math.min(100, Math.round((totalRecolectado / meta) * 100)) : 100;

  const pendientes = vaquita.participantes
    .filter((p) => p.aportadoCop < p.cuotaComprometida)
    .map((p) => ({
      nombre: p.nombre,
      faltante: p.cuotaComprometida - p.aportadoCop,
    }));

  // Balance individual: (Lo que aportó + lo que pagó de su bolsillo) - cuota que le correspondía
  const balances: Record<string, number> = {};
  for (const p of vaquita.participantes) {
    balances[p.nombre] = (p.aportadoCop || 0) - (p.cuotaComprometida || 0);
  }

  // Gastos pagados directamente por participantes
  for (const g of vaquita.gastos) {
    if (g.pagadoPor && balances[g.pagadoPor] !== undefined) {
      balances[g.pagadoPor] += g.montoCop;
    }
  }

  // Algoritmo de liquidación simplificado (quién le paga a quién)
  const deudores = Object.entries(balances)
    .filter(([, b]) => b < 0)
    .map(([nombre, b]) => ({ nombre, deuda: Math.abs(b) }));

  const acreedores = Object.entries(balances)
    .filter(([, b]) => b > 0)
    .map(([nombre, b]) => ({ nombre, aFavor: b }));

  const liquidaciones: DeudaLiquidacion[] = [];

  let i = 0;
  let j = 0;

  while (i < deudores.length && j < acreedores.length) {
    const deudor = deudores[i];
    const acreedor = acreedores[j];

    const pago = Math.min(deudor.deuda, acreedor.aFavor);
    if (pago > 0) {
      liquidaciones.push({
        deudor: deudor.nombre,
        acreedor: acreedor.nombre,
        montoCop: Math.round(pago),
      });

      deudor.deuda -= pago;
      acreedor.aFavor -= pago;
    }

    if (deudor.deuda === 0) i++;
    if (acreedor.aFavor === 0) j++;
  }

  return {
    totalRecolectado,
    totalGastado,
    saldoDisponible,
    porcentajeRecoleccion: porcentaje,
    estaCompleta: porcentaje >= 100,
    pendientesPorPagar: pendientes,
    liquidacionesSugeridas: liquidaciones,
  };
};
