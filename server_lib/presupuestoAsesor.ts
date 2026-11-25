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

/** Groq gratis acepta unos 8.000 tokens por minuto contando la respuesta
 * reservada; se deja margen porque la estimación por caracteres es gruesa. */
export const PRESUPUESTO_TOKENS_ASESOR = 6_200;
export const MAX_TOKENS_RESPUESTA_ASESOR = 600;
const CARACTERES_POR_TOKEN = 3.2;
const MIN_CARACTERES_CONTEXTO_ASESOR = 2_000;

/**
 * El expediente es lo único que se puede recortar sin perder la pregunta, las
 * reglas o el formato: recibe lo que sobre después de todo lo demás.
 */
export const caracteresContextoDisponibles = (
  caracteresFijos: number,
  maxTokensRespuesta = MAX_TOKENS_RESPUESTA_ASESOR,
): number => {
  const libres = Math.floor((PRESUPUESTO_TOKENS_ASESOR - maxTokensRespuesta) * CARACTERES_POR_TOKEN) - caracteresFijos;
  return Math.max(MIN_CARACTERES_CONTEXTO_ASESOR, Math.min(MAX_CARACTERES_CONTEXTO_ASESOR, libres));
};

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
