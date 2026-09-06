import type { EntradaMotorFinanciero } from './motorFinanciero';
import { simularDecisiones, type ModificadorSimulacion, type ResultadoSimulacion } from './simuladorFinanciero';

export interface SolicitudSimulacion {
  tipo: 'simulacion';
  preguntaOriginal: string;
  escenario: ModificadorSimulacion;
  resultado: ResultadoSimulacion;
  respuesta: string;
}

const montoDe = (texto: string): number | null => {
  const coincidencia = texto.replace(/\./g, '').match(/\$?\s*(\d+(?:,\d+)?)/);
  if (!coincidencia) return null;
  const monto = Number(coincidencia[1].replace(',', '.'));
  return Number.isFinite(monto) && monto > 0 ? Math.round(monto) : null;
};

/** Detecta intención y delega toda matemática al simulador determinista. */
export const simularPregunta = (pregunta: string, entrada: EntradaMotorFinanciero): SolicitudSimulacion | null => {
  const texto = pregunta.toLowerCase();
  if (!/(qué pasa|que pasa|si gasto|si ahorro|si pago|afecta mi disponible|representa)/.test(texto)) return null;
  const monto = montoDe(pregunta);
  if (monto === null) return null;
  let escenario: ModificadorSimulacion;
  if (/(ahorro|ahorre|guardar)/.test(texto)) escenario = { tipo: 'ahorro-adicional', montoCop: monto };
  else if (/(pago|abono|deuda)/.test(texto)) escenario = { tipo: 'abono-extraordinario', montoCop: monto };
  else escenario = { tipo: 'gasto-extraordinario', montoCop: monto };
  const resultado = simularDecisiones(entrada, [escenario]);
  const d = resultado.diferencia.disponibleDiario;
  const aviso = resultado.avisos.length ? `\n\nAviso: ${resultado.avisos.join(' ')}` : '';
  return {
    tipo: 'simulacion', preguntaOriginal: pregunta, escenario, resultado,
    respuesta: `Es una simulación temporal. Tu disponible diario pasaría de ${d.base.toLocaleString('es-CO')} COP a ${d.simulado.toLocaleString('es-CO')} COP. El cambio sería de ${Math.abs(d.cambioCop).toLocaleString('es-CO')} COP.${resultado.recuperacionDias === null ? '' : ` Equivale aproximadamente a ${resultado.recuperacionDias} días de tu disponible actual.`}${aviso}\n\nNo se modificaron tus finanzas reales.`,
  };
};
