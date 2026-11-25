/**
 * Contrato de las respuestas visuales del Asesor.
 *
 * La IA nunca escribe código ni HTML que se pinte: solo elige bloques de este
 * catálogo cerrado. Los bloques con cifras los llena el servidor desde el
 * expediente real, así que ningún número que se ve en una tarjeta o en una
 * barra sale del modelo. El mismo contrato lo usan la web, el WebView de
 * Android y el panel del SuperAdmin.
 */

export const FORMATO_BLOQUES_ASESOR = 'luki-bloques-v1';
export const MAX_BLOQUES_ASESOR = 3;

export type SeccionAccionAsesor = 'inicio' | 'dinero' | 'mes';
export type TonoAlertaAsesor = 'bien' | 'atento' | 'neutral';

/** Lo que el modelo pide. "historico" suma todo el historial. */
export type SolicitudBloqueAsesor =
  | { tipo: 'cifras'; mes?: string }
  | { tipo: 'barras_categorias'; mes?: string; top?: number }
  | { tipo: 'tendencia'; meses?: number }
  | { tipo: 'alerta'; tono: TonoAlertaAsesor; titulo: string; detalle: string }
  | { tipo: 'accion'; etiqueta: string; seccion: SeccionAccionAsesor };

/** Lo que la app pinta, ya con las cifras puestas por el servidor. */
export type BloqueAsesor =
  | { tipo: 'cifras'; periodo: string; ingresosCop: number; gastosCop: number; balanceCop: number }
  | { tipo: 'barras_categorias'; periodo: string; items: { nombre: string; valorCop: number }[] }
  | { tipo: 'tendencia'; items: { mes: string; etiqueta: string; ingresosCop: number; gastosCop: number; balanceCop: number }[] }
  | { tipo: 'alerta'; tono: TonoAlertaAsesor; titulo: string; detalle: string }
  | { tipo: 'accion'; etiqueta: string; seccion: SeccionAccionAsesor };

export interface RespuestaVisualAsesor {
  texto: string;
  bloques: BloqueAsesor[];
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

const cadena = (valor: unknown, maximo: number): string =>
  typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, maximo) : '';

const entero = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : null;

const esMes = (valor: unknown): valor is string =>
  typeof valor === 'string' && (valor === 'historico' || /^\d{4}-(0[1-9]|1[0-2])$/.test(valor));

const SECCIONES = new Set<SeccionAccionAsesor>(['inicio', 'dinero', 'mes']);
const TONOS = new Set<TonoAlertaAsesor>(['bien', 'atento', 'neutral']);

const tono = (valor: unknown): TonoAlertaAsesor =>
  TONOS.has(valor as TonoAlertaAsesor) ? valor as TonoAlertaAsesor : 'neutral';

const limitar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

/** Valida una solicitud del modelo; lo que no encaja se descarta sin romper la respuesta. */
export const validarSolicitudBloque = (valor: unknown): SolicitudBloqueAsesor | null => {
  if (!esObjeto(valor)) return null;
  switch (valor.tipo) {
    case 'cifras':
      return esMes(valor.mes) ? { tipo: 'cifras', mes: valor.mes } : { tipo: 'cifras' };
    case 'barras_categorias': {
      const top = limitar(entero(valor.top) ?? 4, 1, 6);
      return esMes(valor.mes) ? { tipo: 'barras_categorias', mes: valor.mes, top } : { tipo: 'barras_categorias', top };
    }
    case 'tendencia':
      return { tipo: 'tendencia', meses: limitar(entero(valor.meses) ?? 4, 2, 12) };
    case 'alerta': {
      const titulo = cadena(valor.titulo, 80);
      const detalle = cadena(valor.detalle, 240);
      return titulo && detalle ? { tipo: 'alerta', tono: tono(valor.tono), titulo, detalle } : null;
    }
    case 'accion': {
      const etiqueta = cadena(valor.etiqueta, 40);
      return etiqueta && SECCIONES.has(valor.seccion as SeccionAccionAsesor)
        ? { tipo: 'accion', etiqueta, seccion: valor.seccion as SeccionAccionAsesor }
        : null;
    }
    default:
      return null;
  }
};

/**
 * Lee el JSON del modelo. Si el proveedor ignoró el modo JSON y respondió en
 * prosa, esa prosa sigue siendo la respuesta: el chat nunca queda vacío.
 */
export const interpretarRespuestaModelo = (crudo: string): { texto: string; solicitudes: SolicitudBloqueAsesor[] } => {
  const limpio = crudo.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const datos = JSON.parse(limpio) as unknown;
    if (esObjeto(datos) && typeof datos.texto !== 'string') {
      // Algunos modelos cambian el nombre del campo pese a la instrucción.
      const alterno = ['respuesta', 'mensaje', 'text', 'answer'].map((clave) => datos[clave]).find((valor) => typeof valor === 'string');
      if (typeof alterno === 'string') datos.texto = alterno;
    }
    if (esObjeto(datos) && typeof datos.texto === 'string' && datos.texto.trim()) {
      const solicitudes = (Array.isArray(datos.bloques) ? datos.bloques : [])
        .map(validarSolicitudBloque)
        .filter((bloque): bloque is SolicitudBloqueAsesor => bloque !== null)
        .slice(0, MAX_BLOQUES_ASESOR);
      return { texto: datos.texto.trim().slice(0, 1500), solicitudes };
    }
  } catch {
    // JSON cortado a mitad de camino: se rescata el campo "texto" para no
    // mostrarle llaves y comillas a la persona.
    if (limpio.startsWith('{')) {
      const rescatado = /"texto"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(limpio)?.[1];
      if (!rescatado) return { texto: '', solicitudes: [] };
      try {
        return { texto: JSON.parse(`"${rescatado}"`).trim(), solicitudes: [] };
      } catch {
        return { texto: rescatado.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim(), solicitudes: [] };
      }
    }
  }
  return { texto: crudo.trim(), solicitudes: [] };
};

const validarItemsCategoria = (valor: unknown): { nombre: string; valorCop: number }[] | null => {
  if (!Array.isArray(valor)) return null;
  const items = valor
    .filter(esObjeto)
    .map((item) => ({ nombre: cadena(item.nombre, 60), valorCop: entero(item.valorCop) ?? -1 }))
    .filter((item) => item.nombre && item.valorCop >= 0)
    .slice(0, 6);
  return items.length > 0 ? items : null;
};

/** Revalida un bloque ya resuelto, porque el mensaje vuelve desde la base de datos. */
export const validarBloque = (valor: unknown): BloqueAsesor | null => {
  if (!esObjeto(valor)) return null;
  switch (valor.tipo) {
    case 'cifras': {
      const ingresosCop = entero(valor.ingresosCop);
      const gastosCop = entero(valor.gastosCop);
      const balanceCop = entero(valor.balanceCop);
      if (ingresosCop === null || gastosCop === null || balanceCop === null) return null;
      return { tipo: 'cifras', periodo: cadena(valor.periodo, 40), ingresosCop, gastosCop, balanceCop };
    }
    case 'barras_categorias': {
      const items = validarItemsCategoria(valor.items);
      return items ? { tipo: 'barras_categorias', periodo: cadena(valor.periodo, 40), items } : null;
    }
    case 'tendencia': {
      if (!Array.isArray(valor.items)) return null;
      const items = valor.items
        .filter(esObjeto)
        .map((item) => ({
          mes: cadena(item.mes, 7),
          etiqueta: cadena(item.etiqueta, 20),
          ingresosCop: entero(item.ingresosCop) ?? 0,
          gastosCop: entero(item.gastosCop) ?? 0,
          balanceCop: entero(item.balanceCop) ?? 0,
        }))
        .filter((item) => item.mes && item.etiqueta)
        .slice(0, 12);
      return items.length >= 2 ? { tipo: 'tendencia', items } : null;
    }
    case 'alerta':
    case 'accion':
      return validarSolicitudBloque(valor) as BloqueAsesor | null;
    default:
      return null;
  }
};

// Un monto en pesos: "$750.000", "16.7 M", "3,2 millones", "480.200 COP". Los
// porcentajes no cuentan: "ahorras el 50 %" no choca con ninguna tarjeta.
const MONTO_EN_TEXTO = /\$\s?\d|\d[\d.,]*\s?(?:m|mm|millones?|mil|k)\b|\d{1,3}(?:[.,]\d{3})+|\d[\d.,]*\s?cop\b/i;
const BLOQUES_CON_CIFRAS = new Set<BloqueAsesor['tipo']>(['cifras', 'barras_categorias', 'tendencia']);

/**
 * Si la respuesta trae tarjetas o barras, las cifras ya están ahí y vienen del
 * expediente. El modelo a veces repite montos de OTRO período en el texto
 * (el histórico junto a tarjetas del mes) y la pantalla se contradice; por eso
 * se quitan las frases con montos y queda el consejo.
 */
export const quitarMontosRepetidos = (texto: string, bloques: readonly BloqueAsesor[]): string => {
  if (!bloques.some((bloque) => BLOQUES_CON_CIFRAS.has(bloque.tipo))) return texto;
  const frases = texto.split(/(?<=[.!?])\s+|\n+/);
  const sinMontos = frases.filter((frase) => !MONTO_EN_TEXTO.test(frase.replace(/\*\*/g, '')));
  if (sinMontos.length === frases.length) return texto;
  const resultado = sinMontos.join(' ').replace(/\s+/g, ' ').trim();
  return resultado || 'Aquí tienes tu resumen.';
};

// Nombres de la trastienda que la persona nunca ve en la app.
const DETALLE_INTERNO = /\b(supabase|groq|netlify|vercel|postgres(?:ql)?|sql|server\.ts|servidor(?:es)?|backend|base de datos|bases de datos|api|endpoint|migraci[oó]n(?:es)?|service_role|openai|gpt[\w.-]*|llama|qwen|deepseek|gemini|anthropic|typescript|javascript|react|repositorio|c[oó]digo fuente)\b/i;

export const RESPUESTA_SIN_DETALLES_INTERNOS = 'Eso no lo puedes hacer desde la app por ahora. Si te gustaría que existiera, propónlo en **Más → Funciones solicitadas**.';

/**
 * Red de seguridad: aunque el prompt lo prohíbe, un modelo puede nombrar la
 * infraestructura o mandar a la persona a otro sistema. Esas frases se quitan.
 */
export const quitarDetallesInternos = (texto: string): string => {
  const frases = texto.split(/(?<=[.!?])\s+|\n+/);
  const limpias = frases.filter((frase) => !DETALLE_INTERNO.test(frase.replace(/\*\*/g, '')));
  if (limpias.length === frases.length) return texto;
  const resultado = limpias.join(' ').replace(/\s+/g, ' ').trim();
  return resultado || RESPUESTA_SIN_DETALLES_INTERNOS;
};

/** Se guarda como texto del mensaje: así el historial y el SuperAdmin conservan la vista. */
export const serializarRespuestaVisual = (respuesta: RespuestaVisualAsesor): string =>
  respuesta.bloques.length === 0
    ? respuesta.texto
    : JSON.stringify({ formato: FORMATO_BLOQUES_ASESOR, texto: respuesta.texto, bloques: respuesta.bloques });

export const leerRespuestaVisual = (texto: string): RespuestaVisualAsesor | null => {
  if (!texto.trimStart().startsWith('{')) return null;
  try {
    const datos = JSON.parse(texto) as unknown;
    if (!esObjeto(datos) || datos.formato !== FORMATO_BLOQUES_ASESOR || typeof datos.texto !== 'string') return null;
    const bloques = (Array.isArray(datos.bloques) ? datos.bloques : [])
      .map(validarBloque)
      .filter((bloque): bloque is BloqueAsesor => bloque !== null)
      .slice(0, MAX_BLOQUES_ASESOR);
    return { texto: datos.texto, bloques };
  } catch {
    return null;
  }
};

/** Texto legible para el historial que vuelve al modelo y para el respaldo. */
export const textoPlanoDeRespuesta = (texto: string): string => leerRespuestaVisual(texto)?.texto ?? texto;

/** Instrucciones de formato que el servidor añade al system prompt. Viven en
 * código (no en un PDF) porque tienen que coincidir con los componentes. */
export const INSTRUCCIONES_BLOQUES_ASESOR = `FORMATO DE SALIDA OBLIGATORIO: responde SOLO con un objeto JSON válido, sin Markdown alrededor:
{"texto": "tu respuesta breve en español, puede usar **negrillas**", "bloques": []}
"bloques" es opcional (máximo ${MAX_BLOQUES_ASESOR}) y sirve para que la app muestre la respuesta de forma visual. Tipos permitidos:
- {"tipo":"cifras","mes":"AAAA-MM" o "historico"}: tarjetas de ingresos, gastos y balance. La app pone las cifras reales; tú NO escribes montos aquí ni en "texto".
- {"tipo":"barras_categorias","mes":"AAAA-MM" o "historico","top":4}: barras de las categorías con más gasto.
- {"tipo":"tendencia","meses":4}: comparación de los últimos meses.
- {"tipo":"alerta","tono":"bien"|"atento"|"neutral","titulo":"máx 8 palabras","detalle":"máx 30 palabras"}: un aviso o logro puntual. Solo cifras que estén en el expediente.
- {"tipo":"accion","etiqueta":"máx 4 palabras","seccion":"inicio"|"dinero"|"mes"}: botón para ir a esa sección.
Si usas "cifras", "barras_categorias" o "tendencia", el campo "texto" NO lleva montos en pesos (la app los muestra y borra las frases que los repitan): da solo la lectura o el consejo. Usa bloques solo cuando aporten (resúmenes, comparaciones, alertas). Para saludos o charla, "bloques" va vacío. Si omites "mes", la app usa el mes más reciente con datos. Nunca escribas HTML, código ni tipos que no estén en esta lista.`;
