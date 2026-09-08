import { normalizarNombre } from './contactos';

type CampoDeuda = 'deuda' | 'ahorros' | 'reserva';
export interface ConversacionDeuda {
  deuda?: number;
  ahorros?: number;
  reserva?: number;
  pendiente?: CampoDeuda;
  ingresosInciertos?: boolean;
}

const PREGUNTAS: Record<CampoDeuda, string> = {
  deuda: '¿Cuál es el saldo total pendiente de esa deuda? Dime el saldo, no la cuota mensual.',
  ahorros: '¿Cuánto tienes ahorrado en total para esta decisión?',
  reserva: '¿Cuánto de esos ahorros necesitas conservar para tus gastos básicos y próximos compromisos? Ese será el dinero que excluyamos del pago.',
};

const normalizarImportes = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Aceptar únicamente un monto completo evita confundir fechas, porcentajes o
// varios valores con la respuesta a la pregunta pendiente.
export function leerMontoConversacion(texto: string): number | null {
  const coincidencia = normalizarImportes(texto).match(/^\$?\s*(\d+(?:[.,]\d+)*)\s*(mil|millon|millones)?\s*(?:pesos|cop)?$/);
  if (!coincidencia) return null;
  const cifra = coincidencia[1];
  const agrupado = /^\d{1,3}(?:[.,]\d{3})+$/.test(cifra);
  const numero = Number(agrupado ? cifra.replace(/[.,]/g, '') : cifra.replace(',', '.'));
  const factor = coincidencia[2] === 'mil' ? 1000 : coincidencia[2] ? 1000000 : 1;
  const monto = numero * factor;
  return Number.isSafeInteger(monto) && monto >= 0 ? monto : null;
}

export function esRegistroExplicito(texto: string): boolean {
  return /^(?:(?:hoy|ayer|ya)\s+)?(?:registre|registra|registrar|anota|anotar|gaste|pague|compre|recibi|me pagaron)\b/.test(normalizarNombre(texto));
}

export function esConsultaDeuda(texto: string): boolean {
  const norm = normalizarNombre(texto);
  return /\b(deuda|tarjeta|credito|prestamo)\b/.test(norm) &&
    /\b(recomiend\w*|consejo|conviene|pagar|pago|debo|deuda|ayud\w*)\b/.test(norm) &&
    !esRegistroExplicito(texto) && !/\b(cuanto gaste|cuanto he gastado|resumen|saldo de mis cuentas)\b/.test(norm);
}

export function continuarDeuda(texto: string, anterior?: ConversacionDeuda): {
  estado?: ConversacionDeuda;
  respuesta: string | null;
} {
  const norm = normalizarNombre(texto);
  if (/^(cancelar|salir|otro tema|dime mi resumen|resumen|dime mi saldo|cuanto he gastado)[?.!]*$/.test(norm) || esRegistroExplicito(texto)) {
    return { respuesta: null };
  }
  if (!anterior && !esConsultaDeuda(texto)) return { respuesta: null };
  const estado: ConversacionDeuda = { ...anterior };
  if (/\b(contrato|desempleo|sin trabajo)\b/.test(norm)) estado.ingresosInciertos = true;

  let recibidos = 0;
  for (const campo of ['deuda', 'ahorros', 'reserva'] as const) {
    const etiqueta = {
      deuda: '(?:(?:el |mi |la )?(?:deuda|saldo(?: total)?(?: pendiente)?)|debo)',
      ahorros: '(?:(?:mis |los )?ahorros|tengo ahorrados?|he ahorrado)',
      reserva: '(?:(?:mi |la )?reserva|necesito conservar|quiero conservar|necesito guardar)',
    }[campo];
    const valor = normalizarImportes(texto).match(new RegExp(`(?:^|[,;\\n]\\s*)${etiqueta}\\s*(?:es|son|de|:)?\\s*(.+?)(?=[,;]\\s*[a-z]|$)`))?.[1];
    const monto = valor === undefined ? null : leerMontoConversacion(valor.replace(/[.!]$/, '').trim());
    if (monto !== null && (campo !== 'deuda' || monto > 0)) {
      estado[campo] = monto;
      recibidos++;
    }
  }
  // Solo quitar envolturas inequívocas de respuesta. No extraer el primer
  // número de cualquier frase: podría ser una cuota, una fecha o un interés.
  const respuestaBreve = normalizarImportes(texto)
    .replace(/^(?:son|es|serian|seria|en total son|en total es)\s+/, '')
    .replace(/[.!]$/, '').trim();
  const monto = leerMontoConversacion(respuestaBreve);
  if (recibidos === 0 && anterior?.pendiente && monto !== null && (anterior.pendiente !== 'deuda' || monto > 0)) {
    estado[anterior.pendiente] = monto;
    recibidos++;
  }
  const pendiente = (['deuda', 'ahorros', 'reserva'] as const).find((campo) => estado[campo] === undefined);
  estado.pendiente = pendiente;
  const cop = (valor: number) => `$${valor.toLocaleString('es-CO')}`;
  const resumen = [estado.deuda === undefined ? '' : `Deuda: **${cop(estado.deuda)}**.`, estado.ahorros === undefined ? '' : `Ahorros: **${cop(estado.ahorros)}**.`, estado.reserva === undefined ? '' : `Reserva: **${cop(estado.reserva)}**.`].filter(Boolean).join(' ');
  const contexto = estado.ingresosInciertos && !anterior ? ' Como mencionaste tu contrato o una situación laboral que puede afectar tus ingresos, incluiremos el dinero que necesitas conservar.' : '';
  if (pendiente) {
    const inicio = !anterior
      ? 'Podemos comparar pagar la deuda con tus ahorros y conservar dinero para tus compromisos.'
      : recibidos > 0 ? 'Gracias, ya tengo ese dato.'
        : 'No pude identificar con seguridad ese monto. Puedes responder, por ejemplo, «900 mil» o «el saldo total es 900000».';
    return { estado, respuesta: `${inicio}${contexto}\n\n${resumen ? resumen + '\n\n' : ''}${PREGUNTAS[pendiente]}${anterior ? '' : '\n\nPuedes escribir «cancelar» para salir de esta consulta.'}` };
  }
  const deuda = estado.deuda!;
  const ahorros = estado.ahorros!;
  const reserva = estado.reserva!;
  const abono = Math.min(deuda, Math.max(0, ahorros - reserva));
  const pagoTotal = ahorros >= deuda
    ? `Pagar toda la deuda dejaría **${cop(ahorros - deuda)}** de ahorros${ahorros - deuda < reserva ? ', por debajo de la reserva que indicaste' : ''}.`
    : `Tus ahorros no cubren toda la deuda: faltarían **${cop(deuda - ahorros)}**.`;
  return { estado, respuesta: `${resumen}\n\n${pagoTotal}\n\nSi conservas tu reserva, podrías destinar como máximo **${cop(abono)}** a esta deuda; quedarían **${cop(deuda - abono)}** pendientes y **${cop(ahorros - abono)}** de ahorros.${reserva > ahorros ? ' La reserva que necesitas supera tus ahorros actuales.' : ''}\n\nEsta comparación usa los montos que me diste; no incluye intereses ni comisiones. Para comparar cuotas y recomendar un plan también hacen falta la tasa de interés, el pago mínimo y tus ingresos y gastos básicos. La IA en línea puede ayudarte con ese análisis. Puedes corregir un dato con «deuda: 500 mil», «ahorros: 1 millón» o «reserva: 300 mil».` };
}
