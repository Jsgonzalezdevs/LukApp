import type { ContextoFinanciero, SenalFinanciera } from './motorFinanciero';

export type SeveridadSenal = 'informacion' | 'atencion' | 'riesgo' | 'critico';
export interface SenalFinancieraPredictiva extends SenalFinanciera {
  severidad: SeveridadSenal;
  periodo: string | null;
  origen: string;
  accion: string;
  detectadaEn: string;
}

/** Interpreta contexto y proyección; no recalcula métricas financieras. */
export const construirSenalesFinancieras = (contexto: ContextoFinanciero, hoy: string): SenalFinancieraPredictiva[] => {
  const señales: SenalFinancieraPredictiva[] = [];
  const serie = contexto.proyeccionCompleta;
  const deficit = serie.find((p) => p.riesgo === 'deficit-proyectado');
  if (deficit) señales.push({ id: 'liquidez-deficit-proyectado', tipo: 'liquidez', severidad: 'critico', titulo: 'Déficit proyectado', razon: `La liquidez proyectada cae por debajo de cero el ${deficit.fecha}.`, confianza: 0.9, impactoCop: deficit.saldoLiquidoCop, evidencia: deficit.evidencia, periodo: deficit.fecha.slice(0, 7), origen: 'proyeccionFinanciera', accion: 'Revisa las obligaciones próximas y el disponible diario.', detectadaEn: hoy });
  const cercanas = contexto.obligaciones.filter((o) => o.fecha !== null && o.fecha >= hoy && o.fecha <= serie[Math.min(10, serie.length - 1)]?.fecha);
  const totalCercano = cercanas.reduce((s, o) => s + (o.montoCop ?? 0), 0);
  if (cercanas.length >= 3 && totalCercano > 0) señales.push({ id: `concentracion-${hoy}`, tipo: 'concentracion-pagos', severidad: 'atencion', titulo: 'Pagos concentrados', razon: `${cercanas.length} obligaciones reúnen ${totalCercano.toLocaleString('es-CO')} COP en los próximos días.`, confianza: 0.85, impactoCop: totalCercano, evidencia: cercanas.map((o) => o.concepto), periodo: hoy.slice(0, 7), origen: 'obligacionesFuturas', accion: 'Revisa las fechas y prioriza los pagos.', detectadaEn: hoy });
  for (const presupuesto of contexto.presupuestos) {
    if (presupuesto.excedidoCop > 0) señales.push({ id: `presupuesto-${presupuesto.categoria}`, tipo: 'presupuesto', severidad: 'riesgo', titulo: 'Presupuesto excedido', razon: `El gasto supera el tope en ${presupuesto.excedidoCop.toLocaleString('es-CO')} COP.`, confianza: 1, impactoCop: presupuesto.excedidoCop, evidencia: [presupuesto.categoria], periodo: hoy.slice(0, 7), origen: 'presupuestos', accion: 'Revisa los gastos de esta categoría.', detectadaEn: hoy });
  }
  for (const tarjeta of contexto.tarjetas) {
    if (tarjeta.limiteCreditoCop !== null && tarjeta.limiteCreditoCop > 0 && tarjeta.saldoUtilizadoCop / tarjeta.limiteCreditoCop >= 0.8) señales.push({ id: `tarjeta-utilizacion-${tarjeta.tarjetaId}`, tipo: 'tarjeta', severidad: 'atencion', titulo: 'Utilización alta de tarjeta', razon: 'El saldo utilizado supera el 80% del límite configurado.', confianza: 1, impactoCop: tarjeta.saldoUtilizadoCop, evidencia: [tarjeta.tarjetaId], periodo: hoy.slice(0, 7), origen: 'tarjetas', accion: 'Revisa el pago próximo y el cupo disponible.', detectadaEn: hoy });
  }
  for (const meta of contexto.metasInteligentes ?? []) {
    if (!meta.progreso.completada && meta.progreso.diasRestantes !== null && meta.progreso.diasRestantes <= 0) señales.push({ id: `meta-atrasada-${meta.meta.id}`, tipo: 'meta', severidad: 'riesgo', titulo: 'Meta atrasada', razon: `La meta “${meta.meta.nombre}” superó su fecha objetivo sin completarse.`, confianza: 1, impactoCop: meta.restanteCop, evidencia: meta.evidencia, periodo: meta.meta.fechaObjetivo?.slice(0, 7) ?? null, origen: 'metasInteligentes', accion: 'Revisa el objetivo o define un nuevo ritmo de ahorro.', detectadaEn: hoy });
  }
  return señales;
};
