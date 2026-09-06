import type { Instantanea } from '../data/repositorio';
import type { ConfigPeriodo } from './periodo';
import { claveDePeriodo, diasDelPeriodo, diasTranscurridosEnPeriodo, finDePeriodo } from './periodo';
import { idsPasivos, patrimonio, saldosPorCajita, totalPorTipo } from './cajitas';
import { claseDeCuenta } from '../data/modelos';
import { metasConProgreso, type MetaConProgreso } from './metas';
import { estadoDeTodos, type EstadoPresupuesto } from './presupuestos';
import { resumenTarjeta } from './tarjetas';
import { construirObligacionesFuturas, type ObligacionFutura } from './obligacionesFuturas';
import type { Transaction } from '../types';
import { construirForecast, proyectarFinanzas } from './proyeccionFinanciera';
import { construirEntradasFuturas } from './entradasFuturas';
import { construirSenalesFinancieras } from './senalesFinancieras';
import { evaluarMetas, type MetaInteligente } from './metasInteligentes';

export interface EntradaMotorFinanciero extends Instantanea {
  hoy: string;
  periodo: ConfigPeriodo;
  /** Ajuste temporal para simulaciones; nunca forma parte de la Instantanea persistida. */
  ajusteFuturoCop?: number;
}

export type { ObligacionFutura } from './obligacionesFuturas';

export interface SenalFinanciera {
  id: string;
  tipo: string;
  titulo: string;
  razon: string;
  confianza: number;
  impactoCop: number | null;
  evidencia: readonly string[];
}

export interface PuntoProyectado {
  fecha: string;
  saldoCop: number;
  entradasCop: number;
  salidasCop: number;
  comprometidoCop: number;
  certeza: 'real' | 'programada' | 'estimada';
}

export interface ContextoFinanciero {
  saldo: {
    totalActivosCop: number;
    totalPasivosCop: number;
    patrimonioCop: number;
    saldoCuentasCop: number;
    saldoAhorrosCop: number;
    saldoTarjetasCop: number;
    saldoDeudasCop: number;
    saldoEfectivoCop?: number;
    saldoBancosCop?: number;
  };
  compromisos: {
    reservasCop: number;
    ahorroComprometidoCop: number;
    obligacionesCop: number;
    cuotasCop: number;
    pagosTarjetaCop: number;
    totalCop: number;
    datosIncompletos: boolean;
  };
  liquidez: {
    dineroLibreCop: number;
    dineroLibreBrutoCop: number;
    saldoLiquidoCop: number;
    obligacionesPendientesCop: number;
    cuotasPendientesCop: number;
    compromisosMetasCop: number;
    diasRestantesPeriodo: number;
    disponibleDiarioCop: number;
    disponibleDiarioBrutoCop: number;
    liquidezMinimaCop: number | null;
    nivel: 'bien' | 'atencion' | 'riesgo' | 'incompleto';
    confianza: 'alta' | 'media' | 'baja';
    factores: readonly { concepto: string; montoCop: number; certeza: 'real' | 'programada' | 'estimada' | 'desconocida' }[];
  };
  proyeccion: { supuestos: readonly string[]; limitada: boolean; saldoFinalEstimadoCop: number | null; serie: readonly PuntoProyectado[] };
  proyeccionCompleta: ReturnType<typeof proyectarFinanzas>;
  entradasFuturas: ReturnType<typeof construirEntradasFuturas>;
  metas: readonly MetaConProgreso[];
  /** Opcional al consumir snapshots legacy construidos antes de Fase 8. */
  metasInteligentes?: readonly MetaInteligente[];
  presupuestos: readonly EstadoPresupuesto[];
  obligaciones: readonly ObligacionFutura[];
  anomalias: readonly SenalFinanciera[];
  tarjetas: readonly import('./tarjetas').ResumenTarjeta[];
  /** Opcional para snapshots de pruebas/consumidores legacy. */
  forecast?: import('./proyeccionFinanciera').ForecastFinanciero;
}

const gastoMes = (transacciones: readonly Transaction[], mes: string) =>
  transacciones.filter((t) => t.kind === 'gasto' && t.occurredOn.startsWith(mes)).reduce((s, t) => s + t.amountCop, 0);

/** Construye la única fotografía financiera derivada para todos los consumidores. */
export const construirContextoFinanciero = (entrada: EntradaMotorFinanciero): ContextoFinanciero => {
  const pasivos = idsPasivos(entrada.cajitas);
  const saldos = saldosPorCajita(entrada.cajitaMovimientos, entrada.transacciones, pasivos);
  const p = patrimonio(entrada.cajitas, entrada.cajitaMovimientos, entrada.transacciones);
  const mes = entrada.hoy.slice(0, 7);
  const obligaciones = construirObligacionesFuturas(entrada, 90);
  const tarjetas = entrada.cajitas.filter((c) => c.tipo === 'tarjeta' && c.archivedAt === null).map((tarjeta) => {
    const saldoUtilizadoCop = Math.abs(totalPorTipo([tarjeta], entrada.cajitaMovimientos, 'tarjeta', entrada.transacciones));
    return resumenTarjeta(tarjeta, saldoUtilizadoCop, entrada.transacciones, entrada.cajitaMovimientos, mes, entrada.hoy);
  });
  const metas = metasConProgreso(entrada.metas, saldos, entrada.hoy);
  // El saldo de las cajitas ya está dentro del patrimonio: se separa como
  // reserva, pero no se vuelve a restar como si fuera una meta pendiente.
  const reservasCop = Math.max(0, totalPorTipo(entrada.cajitas.filter((c) => c.tipo === 'cajita'), entrada.cajitaMovimientos, 'cajita', entrada.transacciones));
  const ahorroComprometidoCop = 0;
  const obligacionesConImporte = obligaciones.filter((o): o is typeof o & { montoCop: number } => o.montoCop !== null);
  const obligacionesCop = obligacionesConImporte.reduce((s, o) => s + o.montoCop, 0);
  const clavePeriodo = claveDePeriodo(entrada.hoy, entrada.periodo);
  const finPeriodo = finDePeriodo(entrada.periodo.frecuencia === 'todo-el-tiempo' ? entrada.hoy : clavePeriodo, entrada.periodo);
  const compromisosDelPeriodo = obligacionesConImporte.filter((o) => o.fecha !== null && (finPeriodo === null || o.fecha <= finPeriodo));
  const obligacionesDelPeriodoCop = compromisosDelPeriodo.reduce((s, o) => s + o.montoCop, 0);
  const dineroLibreBrutoCop = p.netoCop - reservasCop - obligacionesDelPeriodoCop + (entrada.ajusteFuturoCop ?? 0);
  const dineroLibreCop = Math.max(0, dineroLibreBrutoCop);
  const totalDias = diasDelPeriodo(clavePeriodo, entrada.periodo);
  const transcurridos = diasTranscurridosEnPeriodo(clavePeriodo, entrada.hoy, entrada.periodo);
  const dias = Math.max(1, (totalDias ?? 1) - (transcurridos ?? 0) + 1);
  const disponibleDiarioBrutoCop = Math.round(dineroLibreBrutoCop / dias);
  const presupuestos = estadoDeTodos(entrada.presupuestos, entrada.transacciones, claveDePeriodo(entrada.hoy, entrada.periodo), entrada.hoy, entrada.periodo);
  const gastos = gastoMes(entrada.transacciones, mes);
  const serie: PuntoProyectado[] = [{ fecha: entrada.hoy, saldoCop: p.netoCop, entradasCop: 0, salidasCop: gastos, comprometidoCop: obligacionesCop, certeza: 'real' }];
  const datosIncompletos = entrada.recurrentes.length === 0 || entrada.metas.length === 0;
  const pagosTarjetaCop = obligacionesConImporte.filter((o) => o.origen === 'tarjeta').reduce((s, o) => s + o.montoCop, 0);
  const saldoEfectivoCop = entrada.cajitas.filter((c) => c.tipo === 'cuenta' && c.archivedAt === null && claseDeCuenta(c) === 'efectivo').reduce((s, c) => s + (saldos.get(c.id) ?? 0), 0);
  const saldoBancosCop = p.cuentasCop - saldoEfectivoCop;
  const proyeccionCompleta = proyectarFinanzas({ ...entrada, obligaciones, entradasFuturas: construirEntradasFuturas(entrada, 90) }, { dias: 90 });
  const minimoLiquidez = proyeccionCompleta.length > 0 ? proyeccionCompleta.reduce((min, punto) => punto.saldoLiquidoCop < min.saldoLiquidoCop ? punto : min).saldoLiquidoCop : null;
  const contextoBase: ContextoFinanciero = {
    saldo: { totalActivosCop: p.totalCop, totalPasivosCop: p.deudasCop, patrimonioCop: p.netoCop, saldoCuentasCop: p.cuentasCop, saldoAhorrosCop: p.cajitasCop, saldoTarjetasCop: Math.abs(totalPorTipo(entrada.cajitas, entrada.cajitaMovimientos, 'tarjeta', entrada.transacciones)), saldoDeudasCop: Math.abs(totalPorTipo(entrada.cajitas, entrada.cajitaMovimientos, 'deuda', entrada.transacciones)), saldoEfectivoCop, saldoBancosCop },
    compromisos: { reservasCop, ahorroComprometidoCop, obligacionesCop: obligacionesDelPeriodoCop, cuotasCop: pagosTarjetaCop, pagosTarjetaCop, totalCop: reservasCop + ahorroComprometidoCop + obligacionesDelPeriodoCop, datosIncompletos },
    liquidez: { saldoLiquidoCop: p.cuentasCop, dineroLibreBrutoCop, dineroLibreCop, obligacionesPendientesCop: obligacionesDelPeriodoCop, cuotasPendientesCop: pagosTarjetaCop, compromisosMetasCop: ahorroComprometidoCop, diasRestantesPeriodo: dias, disponibleDiarioCop: Math.max(0, disponibleDiarioBrutoCop), disponibleDiarioBrutoCop, liquidezMinimaCop: minimoLiquidez, nivel: dineroLibreBrutoCop <= 0 ? 'riesgo' : datosIncompletos ? 'incompleto' : 'bien', confianza: datosIncompletos ? 'baja' : obligaciones.some((o) => o.certeza === 'estimada') ? 'media' : 'alta', factores: compromisosDelPeriodo.map((o) => ({ concepto: o.concepto, montoCop: o.montoCop, certeza: o.certeza })), },
    proyeccion: { supuestos: ['El saldo actual se toma como punto de partida.', 'Solo se proyectan obligaciones conocidas.'], limitada: entrada.transacciones.length < 10, saldoFinalEstimadoCop: p.netoCop - obligacionesCop, serie },
    entradasFuturas: construirEntradasFuturas(entrada, 90),
    proyeccionCompleta,
    metas, metasInteligentes: [], presupuestos, obligaciones, anomalias: [], tarjetas,
  };
  const anomalias = construirSenalesFinancieras(contextoBase, entrada.hoy);
  return { ...contextoBase, metasInteligentes: evaluarMetas(contextoBase), anomalias, forecast: construirForecast(contextoBase.proyeccionCompleta, contextoBase.liquidez.confianza) };
};
