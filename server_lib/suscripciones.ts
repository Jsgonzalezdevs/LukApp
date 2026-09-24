/** Recursos que consumen infraestructura de pago por uso dentro de LukApp. */
export const RECURSOS_DE_CUPO = ['dictado', 'asesor_ia', 'extracto'] as const;
export const CLAVES_BENEFICIO_PLAN = [
  'dictado',
  'asesor_ia',
  'extracto',
  'espacios_compartidos',
  'integrantes_espacio',
  'insights_ia',
  'pulso_premium',
] as const;

export type RecursoDeCupo = (typeof RECURSOS_DE_CUPO)[number];
export type CodigoPlan = 'normal' | 'premium';
export type ClaveBeneficioPlan = (typeof CLAVES_BENEFICIO_PLAN)[number];

export interface LimitesPlan {
  dictadosMensual: number | null;
  asesorIaMensual: number | null;
  extractosMensual: number | null;
  espaciosCompartidos: number | null;
  integrantesPorEspacio: number | null;
}

export interface BeneficioPlan {
  clave: ClaveBeneficioPlan;
  titulo: string;
  detalle: string;
  tipoValor: 'cupo' | 'incluido';
  limite: number | null;
  activo: boolean;
}

type SeleccionBeneficios = Partial<Record<ClaveBeneficioPlan, boolean>>;

export interface ResultadoCupo {
  permitido: boolean;
  plan_codigo: CodigoPlan;
  limite: number | null;
  usado: number;
  incluido: boolean;
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
  beneficios: Record<ClaveBeneficioPlan, boolean>;
}

const ETIQUETAS_CUPO: Record<RecursoDeCupo, { singular: string; plural: string }> = {
  dictado: { singular: 'registro por voz', plural: 'registros por voz' },
  asesor_ia: { singular: 'consulta al Asesor IA', plural: 'consultas al Asesor IA' },
  extracto: { singular: 'extracto PDF', plural: 'extractos PDF' },
};

const DEFINICION_BENEFICIOS: Record<ClaveBeneficioPlan, Omit<BeneficioPlan, 'activo' | 'limite'>> = {
  dictado: { clave: 'dictado', titulo: 'Registro por voz', detalle: 'registros al mes', tipoValor: 'cupo' },
  asesor_ia: { clave: 'asesor_ia', titulo: 'Asesor IA', detalle: 'consultas al mes', tipoValor: 'cupo' },
  extracto: { clave: 'extracto', titulo: 'Extractos PDF', detalle: 'extractos al mes', tipoValor: 'cupo' },
  espacios_compartidos: { clave: 'espacios_compartidos', titulo: 'Espacios compartidos', detalle: 'espacios para organizarte en compañía', tipoValor: 'cupo' },
  integrantes_espacio: { clave: 'integrantes_espacio', titulo: 'Personas por espacio', detalle: 'personas que puedes invitar por espacio', tipoValor: 'cupo' },
  insights_ia: { clave: 'insights_ia', titulo: 'Recomendaciones con IA', detalle: 'análisis mensuales personalizados', tipoValor: 'incluido' },
  pulso_premium: { clave: 'pulso_premium', titulo: 'Pulso Premium', detalle: 'margen diario y decisiones financieras', tipoValor: 'incluido' },
};

export const esRecursoDeCupo = (valor: unknown): valor is RecursoDeCupo =>
  typeof valor === 'string' && (RECURSOS_DE_CUPO as readonly string[]).includes(valor);

export const esClaveBeneficioPlan = (valor: unknown): valor is ClaveBeneficioPlan =>
  typeof valor === 'string' && (CLAVES_BENEFICIO_PLAN as readonly string[]).includes(valor);

const limiteDeBeneficio = (clave: ClaveBeneficioPlan, limites: LimitesPlan): number | null => {
  switch (clave) {
    case 'dictado': return limites.dictadosMensual;
    case 'asesor_ia': return limites.asesorIaMensual;
    case 'extracto': return limites.extractosMensual;
    case 'espacios_compartidos': return limites.espaciosCompartidos;
    case 'integrantes_espacio': return limites.integrantesPorEspacio;
    case 'insights_ia':
    case 'pulso_premium': return null;
  }
};

/** El mismo contrato alimenta Super Admin, cuenta, invitación y confirmación. */
export const beneficiosDelPlan = (
  seleccion: SeleccionBeneficios,
  limites: LimitesPlan,
): BeneficioPlan[] => CLAVES_BENEFICIO_PLAN.map((clave) => ({
  ...DEFINICION_BENEFICIOS[clave],
  limite: limiteDeBeneficio(clave, limites),
  activo: seleccion[clave] === true,
}));

/** Mensaje único para que API y UI nombren el límite con la misma claridad. */
export const mensajeCupoAgotado = (
  recurso: RecursoDeCupo,
  resultado: Pick<ResultadoCupo, 'plan_codigo' | 'limite' | 'incluido'>,
): string => {
  const nombrePlan = resultado.plan_codigo === 'premium' ? 'Premium' : 'Normal';
  if (resultado.incluido === false) {
    return `Los ${ETIQUETAS_CUPO[recurso].plural} no están incluidos en tu plan ${nombrePlan}.`;
  }
  const cantidad = resultado.limite ?? 0;
  const etiqueta = cantidad === 1 ? ETIQUETAS_CUPO[recurso].singular : ETIQUETAS_CUPO[recurso].plural;
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

const seleccionarBeneficios = (valor: unknown): Record<ClaveBeneficioPlan, boolean> => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error('Falta la selección de beneficios del plan.');
  }
  const beneficios = valor as Record<string, unknown>;
  const claves = Object.keys(beneficios);
  if (claves.length !== CLAVES_BENEFICIO_PLAN.length
    || claves.some((clave) => !esClaveBeneficioPlan(clave))
    || CLAVES_BENEFICIO_PLAN.some((clave) => typeof beneficios[clave] !== 'boolean')) {
    throw new Error('La selección de beneficios está incompleta o no es válida.');
  }
  const resultado = {} as Record<ClaveBeneficioPlan, boolean>;
  for (const clave of CLAVES_BENEFICIO_PLAN) resultado[clave] = beneficios[clave] as boolean;
  if (resultado.integrantes_espacio && !resultado.espacios_compartidos) {
    throw new Error('No puedes incluir integrantes si los espacios compartidos están desactivados.');
  }
  if (resultado.pulso_premium && !resultado.asesor_ia) {
    throw new Error('No puedes incluir Pulso Premium si el Asesor IA está desactivado.');
  }
  return resultado;
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
    beneficios: seleccionarBeneficios(datos.beneficios),
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
