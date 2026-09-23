/** Recursos que consumen infraestructura de pago por uso dentro de LukApp. */
export const RECURSOS_DE_CUPO = ['dictado', 'asesor_ia', 'extracto'] as const;

export type RecursoDeCupo = (typeof RECURSOS_DE_CUPO)[number];
export type CodigoPlan = 'normal' | 'premium';

export interface ResultadoCupo {
  permitido: boolean;
  plan_codigo: CodigoPlan;
  limite: number | null;
  usado: number;
}

export interface ConfiguracionPlanEditable {
  precioMensualCop: number;
  precioAnualCop: number;
  limiteDictadosMensual: number | null;
  limiteAsesorIaMensual: number | null;
  limiteExtractosMensual: number | null;
  limiteEspaciosCompartidos: number | null;
  limiteIntegrantesPorEspacio: number | null;
  activo: boolean;
}

const ETIQUETAS: Record<RecursoDeCupo, { singular: string; plural: string }> = {
  dictado: { singular: 'registro por voz', plural: 'registros por voz' },
  asesor_ia: { singular: 'consulta al Asesor IA', plural: 'consultas al Asesor IA' },
  extracto: { singular: 'extracto PDF', plural: 'extractos PDF' },
};

export const esRecursoDeCupo = (valor: unknown): valor is RecursoDeCupo =>
  typeof valor === 'string' && (RECURSOS_DE_CUPO as readonly string[]).includes(valor);

/** Mensaje único para que API y UI nombren el límite con la misma claridad. */
export const mensajeCupoAgotado = (recurso: RecursoDeCupo, resultado: Pick<ResultadoCupo, 'plan_codigo' | 'limite'>): string => {
  const cantidad = resultado.limite ?? 0;
  const nombrePlan = resultado.plan_codigo === 'premium' ? 'Premium' : 'Normal';
  const etiqueta = cantidad === 1 ? ETIQUETAS[recurso].singular : ETIQUETAS[recurso].plural;
  return `Alcanzaste el límite de ${cantidad} ${etiqueta} de tu plan ${nombrePlan} este mes.`;
};

const enteroPositivoOInfinito = (valor: unknown, campo: string): number | null => {
  if (valor === null) return null;
  if (!Number.isSafeInteger(valor) || Number(valor) <= 0) {
    throw new Error(`${campo} debe ser un número entero mayor que cero o ilimitado.`);
  }
  return Number(valor);
};

const pesosNoNegativos = (valor: unknown, campo: string): number => {
  if (!Number.isSafeInteger(valor) || Number(valor) < 0) {
    throw new Error(`${campo} debe ser un valor entero en pesos colombianos.`);
  }
  return Number(valor);
};

/**
 * Solo normaliza el contrato que llega desde el panel. No acepta campos libres
 * ni decimales: COP y los límites se guardan como enteros para no crear cobros
 * ambiguos o cupos fraccionados.
 */
export const validarConfiguracionPlan = (entrada: unknown): ConfiguracionPlanEditable => {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('La configuración del plan no es válida.');
  }
  const datos = entrada as Record<string, unknown>;
  if (typeof datos.activo !== 'boolean') {
    throw new Error('Falta indicar si el plan está activo.');
  }
  return {
    precioMensualCop: pesosNoNegativos(datos.precioMensualCop, 'El precio mensual'),
    precioAnualCop: pesosNoNegativos(datos.precioAnualCop, 'El precio anual'),
    limiteDictadosMensual: enteroPositivoOInfinito(datos.limiteDictadosMensual, 'El límite de dictados'),
    limiteAsesorIaMensual: enteroPositivoOInfinito(datos.limiteAsesorIaMensual, 'El límite del Asesor IA'),
    limiteExtractosMensual: enteroPositivoOInfinito(datos.limiteExtractosMensual, 'El límite de extractos'),
    limiteEspaciosCompartidos: enteroPositivoOInfinito(datos.limiteEspaciosCompartidos, 'El límite de espacios compartidos'),
    limiteIntegrantesPorEspacio: enteroPositivoOInfinito(datos.limiteIntegrantesPorEspacio, 'El límite de integrantes'),
    activo: datos.activo,
  };
};

export const fechaPremiumValida = (valor: unknown): string => {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error('Elige hasta cuándo estará activo Premium.');
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) {
    throw new Error('La vigencia de Premium debe terminar en el futuro.');
  }
  return fecha.toISOString();
};
