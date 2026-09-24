/**
 * Groq cuenta tanto el contexto como la respuesta reservada dentro de la cuota
 * de tokens por minuto. El expediente puede crecer sin límite, por eso el
 * Asesor tiene que enviar una muestra útil y predecible, no el JSON completo.
 */
const MARCA_RECORTE = '\n[... detalle omitido para respetar el límite de la IA ...]\n';

export const MAX_CARACTERES_CONTEXTO_ASESOR = 12_000;
export const MAX_CARACTERES_MEMORIA_ASESOR = 1_500;
export const MAX_CARACTERES_MENSAJE_HISTORIAL = 700;
export const MAX_MENSAJES_HISTORIAL_ASESOR = 4;
export const MAX_CARACTERES_PREGUNTA_ASESOR = 2_000;

/**
 * Mantiene ambos extremos porque los resúmenes financieros suelen abrir con
 * totales y cerrar con movimientos, deudas o metas recientes.
 */
export const recortarConMuestras = (texto: string, maxCaracteres: number): string => {
  if (texto.length <= maxCaracteres) return texto;
  if (maxCaracteres <= MARCA_RECORTE.length) return texto.slice(0, maxCaracteres);

  const disponibles = maxCaracteres - MARCA_RECORTE.length;
  const desdeInicio = Math.ceil(disponibles / 2);
  const desdeFinal = disponibles - desdeInicio;
  return `${texto.slice(0, desdeInicio)}${MARCA_RECORTE}${texto.slice(-desdeFinal)}`;
};

export interface MensajeHistorialAcotado {
  role: 'assistant' | 'user';
  content: string;
}

/** Reduce historial conversacional sin alterar quién dijo cada mensaje. */
export const acotarHistorialAsesor = (
  historial: Array<{ role?: string; content?: string; text?: string }>,
): MensajeHistorialAcotado[] => historial
  .slice(-MAX_MENSAJES_HISTORIAL_ASESOR)
  .map((mensaje) => ({
    role: mensaje.role === 'bot' || mensaje.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: recortarConMuestras(String(mensaje.text || mensaje.content || ''), MAX_CARACTERES_MENSAJE_HISTORIAL),
  }))
  .filter((mensaje) => Boolean(mensaje.content.trim()));
