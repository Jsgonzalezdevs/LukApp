import { PANELES_AJUSTES, type PanelAjustes, type SectionId } from '../sections';

const EN_DINERO: readonly PanelAjustes[] = ['metas', 'extractos', 'compartido', 'dividir-cuenta', 'vaquitas', 'gmf'];
const EN_MES: readonly PanelAjustes[] = ['recurrentes', 'forecast', 'topes'];

export const seccionDePanel = (panel: PanelAjustes): SectionId =>
  EN_DINERO.includes(panel) ? 'dinero' : EN_MES.includes(panel) ? 'mes' : 'ajustes';

export const rutaDePanel = (panel: PanelAjustes, desde?: SectionId): string => `/${desde === 'calendario' && panel === 'recurrentes' ? 'calendario' : seccionDePanel(panel)}/${panel}`;

/** Los enlaces anteriores siguen abriendo su herramienta; al cerrar conservan su sección. */
export const panelDeSegmentos = (segmentos: readonly string[]): PanelAjustes | null =>
  ['ajustes', 'dinero', 'mes', 'calendario'].includes(segmentos[0])
    ? PANELES_AJUSTES.find((p) => p.id === segmentos[1])?.id ?? null
    : null;

const ALIAS: Partial<Record<PanelAjustes, string>> = {
  extractos: 'importar importacion archivo pdf banco',
  recurrentes: 'suscripciones netflix arriendo recibos cobros',
  metas: 'objetivos ahorro ahorrar',
  gmf: 'impuesto cuatro por mil 4x1000',
  respaldo: 'backup exportar recuperar restaurar datos',
  compartido: 'pareja familia proyecto grupo',
};

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export const buscarFunciones = (texto: string) => {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const funciones = [
    ...PANELES_AJUSTES.map((p) => ({ id: p.id as string, titulo: p.label as string, ayuda: p.ayuda as string, ruta: rutaDePanel(p.id), seccion: seccionDePanel(p.id), alias: ALIAS[p.id] ?? '' })),
    { id: 'calendario', titulo: 'Calendario financiero', ayuda: 'Pagos e ingresos futuros', ruta: '/calendario', seccion: 'mes' as const, alias: 'agenda fechas vencimientos' },
    { id: 'dinero', titulo: 'Cuentas, tarjetas y ahorros', ayuda: 'Dónde tienes tu dinero y cuánto debes', ruta: '/dinero', seccion: 'dinero' as const, alias: 'bancos efectivo billetera deudas' },
  ];
  return funciones.filter((f) => palabras.every((p) => normalizar(`${f.titulo} ${f.ayuda} ${f.alias}`).includes(p)));
};
