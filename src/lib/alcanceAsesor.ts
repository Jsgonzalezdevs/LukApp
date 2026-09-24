/** Clasifica una pregunta antes de entregarla al asesor financiero. */
export type AlcanceAsesor = 'financiera' | 'tecnica-sin-finanzas' | 'general';

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');

const PATRON_TECNICO = /\b(sql|sqlite|mysql|postgres(?:ql)?|base de datos|database|codigo|programar|programacion|javascript|typescript|react|html|css|api|servidor)\b/;
const PATRON_FINANCIERO = /\b(finanzas?|financier[oa]s?|gastos?|ingresos?|saldos?|balances?|presupuestos?|ahorros?|cajitas?|cuentas?|deudas?|tarjetas?|creditos?|pagos?|dinero|plata|movimientos?|renta|4x1000|gmf|mes|quincena|como voy)\b/;

/**
 * El asesor no es un chat técnico genérico. Distinguir el tema antes de llamar
 * al proveedor evita respuestas contradictorias: en una pregunta mixta se
 * conserva la parte financiera y se deja que el modelo la responda.
 */
export const clasificarAlcanceAsesor = (texto: string): AlcanceAsesor => {
  const consulta = normalizar(texto);
  if (PATRON_FINANCIERO.test(consulta)) return 'financiera';
  if (PATRON_TECNICO.test(consulta)) return 'tecnica-sin-finanzas';
  return 'general';
};

export const RESPUESTA_TEMA_TECNICO =
  'Este chat analiza tus finanzas; no configura bases de datos. Escribe “dime mi resumen del mes” para revisar ingresos, gastos y saldo.';
