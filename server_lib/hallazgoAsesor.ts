import type { BloqueAsesor, HallazgoAsesor, PropuestaSugeridaAsesor } from '../src/lib/bloquesAsesor.ts';

/**
 * Lo que Luki nota sin que se lo pregunten.
 *
 * Un asesor de verdad no se queda en la pregunta: si ve que un gasto se disparó
 * o que una meta está a punto de cumplirse, lo dice. Esto no lo decide el
 * modelo porque inventaría cifras; se calcula con reglas fijas sobre el
 * expediente y se ordena por qué tan útil le es a la persona saberlo.
 */

interface MesPerfil {
  mes: string;
  ingresosCop: number;
  gastosCop: number;
  balanceCop: number;
}

interface Categoria {
  clave: string;
  montoCop: number;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const nombreMes = (mes: string): string => MESES[Number(mes.slice(5, 7)) - 1] ?? mes;

const numero = (valor: unknown): number =>
  typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : 0;

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

const pesos = (valor: number): string =>
  `$${Math.round(valor).toLocaleString('es-CO')}`;

const porcentaje = (parte: number, total: number): number =>
  total > 0 ? Math.round(parte / total * 100) : 0;

const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-CO').trim();

/** Las transferencias entre cuentas propias no son gasto real. */
const esTraslado = (nombre: string): boolean => /transfer|traslado|movimiento entre cuentas/.test(normalizar(nombre));

// Por debajo de esto un cambio es ruido: que el café pase de 8.000 a 16.000
// es "100 % más" pero no merece interrumpir a nadie.
const MINIMO_RELEVANTE_COP = 50_000;

const leerMeses = (perfil: Record<string, unknown>): MesPerfil[] => {
  const historial = perfil.historialCompleto as { porMes?: unknown } | undefined;
  if (!Array.isArray(historial?.porMes)) return [];
  return historial.porMes
    .filter(esObjeto)
    .map((fila) => ({
      mes: typeof fila.mes === 'string' ? fila.mes : '',
      ingresosCop: numero(fila.ingresosCop),
      gastosCop: numero(fila.gastosCop),
      balanceCop: numero(fila.balanceCop),
    }))
    .filter((fila) => /^\d{4}-\d{2}$/.test(fila.mes))
    .sort((a, b) => a.mes.localeCompare(b.mes));
};

const leerCategorias = (valor: unknown): Categoria[] =>
  Array.isArray(valor)
    ? valor
      .filter(esObjeto)
      .map((fila) => ({ clave: typeof fila.clave === 'string' ? fila.clave : '', montoCop: numero(fila.montoCop) }))
      .filter((fila) => fila.clave && fila.montoCop > 0 && !esTraslado(fila.clave))
    : [];

const redondearArriba = (valor: number, paso: number): number => Math.max(paso, Math.ceil(valor / paso) * paso);

const lista = (valor: unknown): Record<string, unknown>[] => (Array.isArray(valor) ? valor.filter(esObjeto) : []);

interface Candidato extends HallazgoAsesor {
  /** Más alto, más importante. */
  peso: number;
}

/**
 * Todos los hallazgos posibles, del más al menos importante. `hoy` llega como
 * AAAA-MM-DD en hora de Bogotá; se pasa desde fuera para poder probarlo.
 */
export const detectarHallazgos = (perfil: Record<string, unknown> | null, hoy: string): HallazgoAsesor[] => {
  if (!perfil) return [];
  const meses = leerMeses(perfil);
  const actual = meses.at(-1);
  const anterior = meses.at(-2);
  const historial = (perfil.historialCompleto ?? {}) as { gastosPorCategoriaPorMes?: unknown };
  const porMes = esObjeto(historial.gastosPorCategoriaPorMes) ? historial.gastosPorCategoriaPorMes : {};
  const categoriasActual = actual ? leerCategorias(porMes[actual.mes]) : [];
  const categoriasAnterior = anterior ? leerCategorias(porMes[anterior.mes]) : [];
  const presupuestos = lista(perfil.presupuestos)
    .map((fila) => ({ categoria: typeof fila.categoria === 'string' ? fila.categoria : '', montoCop: numero(fila.montoCop) }))
    .filter((fila) => fila.categoria && fila.montoCop > 0);
  const metas = lista(perfil.metas).filter((meta) => !meta.completada);
  const candidatos: Candidato[] = [];

  /**
   * El tope que se propone sale de los meses normales de esa categoría, con un
   * 10 % de holgura: un tope igual a un mes atípico no frena nada, y uno muy
   * por debajo de lo habitual se rompe la primera semana.
   */
  const propuestaDeTope = (categoria: Categoria): PropuestaSugeridaAsesor => {
    const otrosMeses = Object.entries(porMes)
      .filter(([mes]) => mes !== actual?.mes)
      .map(([, filas]) => leerCategorias(filas).find((cat) => cat.clave === categoria.clave)?.montoCop ?? 0)
      .filter((monto) => monto > 0);
    const base = otrosMeses.length > 0 ? otrosMeses.reduce((a, b) => a + b, 0) / otrosMeses.length : categoria.montoCop;
    return { tipo: 'presupuesto', categoria: categoria.clave, montoCop: redondearArriba(base * 1.1, 10_000) };
  };

  // Solo se comenta el mes en curso: decirle en noviembre que en agosto se
  // pasó del presupuesto no le sirve de nada.
  const mesEnCurso = actual?.mes === hoy.slice(0, 7);

  if (actual && mesEnCurso) {
    for (const presupuesto of presupuestos) {
      const gastado = categoriasActual.find((cat) => normalizar(cat.clave) === normalizar(presupuesto.categoria))?.montoCop ?? 0;
      const uso = porcentaje(gastado, presupuesto.montoCop);
      if (uso >= 100) {
        candidatos.push({
          id: `presupuesto-pasado:${normalizar(presupuesto.categoria)}:${actual.mes}`,
          peso: 95,
          tono: 'atento',
          titulo: `Te pasaste del tope de ${presupuesto.categoria}`,
          detalle: `Llevas ${pesos(gastado)} de ${pesos(presupuesto.montoCop)} (${uso} %). Lo que gastes ahí de aquí a fin de mes sale de otra parte.`,
          pregunta: `¿Cómo compenso lo de ${presupuesto.categoria}?`,
        });
      } else if (uso >= 80) {
        candidatos.push({
          id: `presupuesto-cerca:${normalizar(presupuesto.categoria)}:${actual.mes}`,
          peso: 85,
          tono: 'atento',
          titulo: `${presupuesto.categoria} va en el ${uso} % del tope`,
          detalle: `Te quedan ${pesos(presupuesto.montoCop - gastado)} en esa categoría para lo que falta del mes.`,
          pregunta: `¿Cuánto puedo gastar en ${presupuesto.categoria} al día?`,
        });
      }
    }
  }

  if (actual && actual.balanceCop < 0 && actual.ingresosCop > 0) {
    candidatos.push({
      id: `balance-negativo:${actual.mes}`,
      peso: 90,
      tono: 'atento',
      titulo: `En ${nombreMes(actual.mes)} salió más de lo que entró`,
      detalle: `Los gastos superan tus ingresos en ${pesos(-actual.balanceCop)}. Vale la pena mirar qué se puede aplazar.`,
      pregunta: '¿Qué gastos puedo aplazar este mes?',
    });
  }

  if (actual && anterior) {
    for (const categoria of categoriasActual.slice(0, 5)) {
      const antes = categoriasAnterior.find((cat) => cat.clave === categoria.clave)?.montoCop ?? 0;
      const diferencia = categoria.montoCop - antes;
      if (antes > 0 && diferencia >= MINIMO_RELEVANTE_COP && categoria.montoCop >= antes * 1.5) {
        candidatos.push({
          id: `salto:${normalizar(categoria.clave)}:${actual.mes}`,
          peso: 80,
          tono: 'atento',
          titulo: `${categoria.clave} subió ${porcentaje(diferencia, antes)} % frente a ${nombreMes(anterior.mes)}`,
          detalle: `Pasó de ${pesos(antes)} a ${pesos(categoria.montoCop)}. Si fue algo puntual, tranquilo; si se vuelve costumbre, conviene ponerle un tope.`,
          pregunta: `¿Por qué subió tanto ${categoria.clave}?`,
          ...(presupuestos.some((p) => normalizar(p.categoria) === normalizar(categoria.clave)) ? {} : { propuesta: propuestaDeTope(categoria) }),
        });
        break;
      }
    }
  }

  const principal = categoriasActual[0];
  if (actual && principal && actual.gastosCop >= MINIMO_RELEVANTE_COP && categoriasActual.length >= 2) {
    const parte = porcentaje(principal.montoCop, actual.gastosCop);
    if (parte >= 60) {
      const tieneTope = presupuestos.some((p) => normalizar(p.categoria) === normalizar(principal.clave));
      candidatos.push({
        id: `concentracion:${normalizar(principal.clave)}:${actual.mes}`,
        peso: 70,
        tono: 'neutral',
        titulo: `${principal.clave} se llevó el ${parte} % de tus gastos`,
        detalle: tieneTope
          ? 'Casi todo lo que salió este mes fue a una sola categoría. Si fue algo puntual, el resto de tu mes se ve muy controlado.'
          : 'Casi todo lo que salió fue a una sola categoría y no tiene tope. Si se repite, un presupuesto te avisa antes de que se dispare.',
        pregunta: tieneTope ? `¿${principal.clave} fue algo puntual?` : `Ayúdame a ponerle tope a ${principal.clave}`,
        ...(tieneTope ? {} : { propuesta: propuestaDeTope(principal) }),
      });
    }
  }

  for (const meta of metas) {
    const objetivo = numero(meta.objetivoCop);
    const ahorrado = numero(meta.ahorradoCop);
    const nombre = typeof meta.nombre === 'string' ? meta.nombre : '';
    const avance = porcentaje(ahorrado, objetivo);
    if (nombre && objetivo > 0 && avance >= 75 && avance < 100) {
      candidatos.push({
        id: `meta-cerca:${normalizar(nombre)}`,
        peso: 75,
        tono: 'bien',
        titulo: `Tu meta «${nombre}» va en el ${avance} %`,
        detalle: `Te faltan ${pesos(objetivo - ahorrado)} para cumplirla. Un último empujón y queda lista. 🎯`,
        pregunta: `¿Cuándo cumplo la meta ${nombre}?`,
      });
      break;
    }
  }

  const mesesConGasto = meses.filter((mes) => mes.gastosCop > 0).slice(-3);
  const gastoPromedio = mesesConGasto.length > 0 ? mesesConGasto.reduce((total, mes) => total + mes.gastosCop, 0) / mesesConGasto.length : 0;

  if (actual && actual.balanceCop > 0 && actual.ingresosCop > 0) {
    const tasa = porcentaje(actual.balanceCop, actual.ingresosCop);
    if (metas.length === 0 && tasa >= 15) {
      candidatos.push({
        id: `sobrante-sin-meta:${actual.mes}`,
        peso: 65,
        tono: 'bien',
        titulo: `Te está sobrando el ${tasa} % de lo que entró`,
        detalle: 'Ese margen rinde más si tiene nombre: una meta hace que no se diluya en gastos pequeños.',
        pregunta: 'Ayúdame a crear una meta de ahorro',
        // Tres meses de gastos es el colchón que se suele recomendar.
        ...(gastoPromedio > 0 ? { propuesta: { tipo: 'meta' as const, nombre: 'Fondo de emergencia', objetivoCop: redondearArriba(gastoPromedio * 3, 100_000), fechaObjetivo: null } } : {}),
      });
    } else if (anterior && anterior.ingresosCop > 0 && tasa >= porcentaje(anterior.balanceCop, anterior.ingresosCop) + 10) {
      candidatos.push({
        id: `ahorro-mejoro:${actual.mes}`,
        peso: 60,
        tono: 'bien',
        titulo: `Estás ahorrando más que en ${nombreMes(anterior.mes)}`,
        detalle: `Este mes te queda el ${tasa} % de lo que entra, frente al ${porcentaje(anterior.balanceCop, anterior.ingresosCop)} % del mes pasado. Vas muy bien. 🙌`,
        pregunta: '¿Qué hago con lo que me sobra?',
      });
    }
  }

  if (presupuestos.length === 0 && principal && actual && actual.gastosCop >= MINIMO_RELEVANTE_COP) {
    candidatos.push({
      id: 'sin-presupuestos',
      peso: 40,
      tono: 'neutral',
      titulo: 'Aún no tienes topes de gasto',
      detalle: 'Con un presupuesto por categoría, LukApp te avisa cuando vas llegando al límite y no al final del mes.',
      pregunta: 'Ayúdame a armar mi presupuesto',
      propuesta: propuestaDeTope(principal),
    });
  }

  return candidatos
    .sort((a, b) => b.peso - a.peso)
    .map(({ peso: _peso, ...hallazgo }) => hallazgo);
};

/**
 * Elige un hallazgo para acompañar la respuesta. No repite uno que la persona
 * ya vio en esta conversación ni compite con una alerta que el modelo ya puso.
 */
export const elegirHallazgo = (
  perfil: Record<string, unknown> | null,
  hoy: string,
  vistos: readonly string[],
  bloques: readonly BloqueAsesor[],
): HallazgoAsesor | null => {
  if (bloques.some((bloque) => bloque.tipo === 'alerta')) return null;
  const yaVistos = new Set(vistos);
  return detectarHallazgos(perfil, hoy).find((hallazgo) => !yaVistos.has(hallazgo.id)) ?? null;
};

/**
 * Si la persona tocó la pregunta de un hallazgo ("Ayúdame a ponerle tope a
 * Salud"), la respuesta trae la propuesta de ese hallazgo: así el tope se
 * puede crear sin que la IA tenga que adivinar el monto.
 */
export const hallazgoDePregunta = (perfil: Record<string, unknown> | null, hoy: string, pregunta: string): HallazgoAsesor | null => {
  const buscada = normalizar(pregunta).replace(/[¿?¡!.]/g, '').trim();
  if (!buscada) return null;
  return detectarHallazgos(perfil, hoy).find((hallazgo) =>
    hallazgo.pregunta && normalizar(hallazgo.pregunta).replace(/[¿?¡!.]/g, '').trim() === buscada) ?? null;
};

/** Saludos, agradecimientos y despedidas no necesitan que Luki saque temas. */
export const esCharlaBreve = (pregunta: string): boolean => {
  const texto = normalizar(pregunta).replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (texto.split(' ').length > 6) return false;
  return /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|como estas|gracias|muchas gracias|ok|okay|listo|vale|perfecto|chao|adios|nos vemos|bye|jaja\w*)\b/.test(texto);
};

/**
 * Si el modelo no propuso seguimientos, se arman con lo que la respuesta
 * mostró: la conversación nunca termina en un callejón sin salida.
 */
export const seguimientosDeRespaldo = (bloques: readonly BloqueAsesor[], hallazgo: HallazgoAsesor | null): string[] => {
  const propuestas: string[] = [];
  for (const bloque of bloques) {
    if (bloque.tipo === 'barras_categorias' && bloque.items[0]) propuestas.push(`¿Cómo bajo lo de ${bloque.items[0].nombre}?`);
    if (bloque.tipo === 'cifras') propuestas.push(bloque.balanceCop > 0 ? '¿Cuánto puedo ahorrar este mes?' : '¿Qué gastos puedo recortar?');
    if (bloque.tipo === 'tendencia') propuestas.push('¿En qué mes me fue mejor y por qué?');
  }
  propuestas.push('¿Cuánto puedo gastar al día?', 'Ayúdame a armar mi presupuesto', '¿Pagaré 4x1000 este mes?');
  const delHallazgo = hallazgo?.pregunta ? normalizar(hallazgo.pregunta) : '';
  return [...new Set(propuestas)].filter((texto) => normalizar(texto) !== delHallazgo).slice(0, 3);
};
