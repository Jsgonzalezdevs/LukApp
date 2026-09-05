import type { Instantanea } from '../data/repositorio';
import type { ObligacionFutura } from './obligacionesFuturas';
import type { EntradaFutura } from './entradasFuturas';
import { totalPorTipo } from './cajitas';

export interface HorizonteProyeccion { dias: number }
const sumarDias = (fecha: string, dias: number) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const salida = new Date(anio, mes - 1, dia + dias);
  return `${salida.getFullYear()}-${String(salida.getMonth() + 1).padStart(2, '0')}-${String(salida.getDate()).padStart(2, '0')}`;
};


export interface PuntoProyeccionCompleta {
  fecha: string;
  saldoLiquidoCop: number;
  entradasCop: number;
  salidasCop: number;
  obligacionesCop: number;
  disponibleDiarioCop: number;
  riesgo: 'saludable' | 'ajustada' | 'deficit-proyectado' | 'incompleto';
  evidencia: readonly string[];
}

export const proyectarFinanzas = (entrada: Instantanea & { hoy: string; obligaciones: readonly ObligacionFutura[]; entradasFuturas: readonly EntradaFutura[] }, horizonte: HorizonteProyeccion): PuntoProyeccionCompleta[] => {
  const obligaciones = entrada.obligaciones;
  const saldoInicial = totalPorTipo(entrada.cajitas, entrada.cajitaMovimientos, 'cuenta', entrada.transacciones);
  const puntos: PuntoProyeccionCompleta[] = [];
  for (let i = 0; i <= Math.max(0, horizonte.dias); i += 1) {
    const fecha = sumarDias(entrada.hoy, i);
    const entradasCop = entrada.entradasFuturas.filter((ingreso) => ingreso.fecha === fecha).reduce((total, ingreso) => total + ingreso.montoCop, 0);
    const delDia = obligaciones.filter((o) => o.fecha === fecha);
    const salidasCop = delDia.reduce((total, o) => total + (o.montoCop ?? 0), 0);
    const saldoLiquidoCop = saldoInicial + puntos.reduce((total, p) => total + p.entradasCop - p.salidasCop, 0) + entradasCop - salidasCop;
    const diasRestantes = Math.max(1, horizonte.dias - i + 1);
    const riesgo = saldoLiquidoCop < 0 ? 'deficit-proyectado' : saldoLiquidoCop < salidasCop * diasRestantes ? 'ajustada' : obligaciones.some((o) => o.estado === 'desconocida') ? 'incompleto' : 'saludable';
    puntos.push({ fecha, saldoLiquidoCop, entradasCop, salidasCop, obligacionesCop: salidasCop, disponibleDiarioCop: Math.max(0, Math.round(saldoLiquidoCop / diasRestantes)), riesgo, evidencia: delDia.map((o) => o.concepto) });
  }
  return puntos;
};
