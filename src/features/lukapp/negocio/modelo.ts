export type TipoDocumentoNegocio = 'cotizacion' | 'por_cobrar' | 'por_pagar';
export type EstadoDocumentoNegocio = 'borrador' | 'enviado' | 'aceptado' | 'anulado';

export interface AbonoNegocio {
  id: string;
  montoCop: number;
  fecha: string;
  nota: string;
}

export interface DocumentoNegocio {
  id: string;
  tipo: TipoDocumentoNegocio;
  estado: EstadoDocumentoNegocio;
  contraparte: string;
  concepto: string;
  totalCop: number;
  fecha: string;
  vence: string | null;
  abonos: AbonoNegocio[];
  cotizacionOrigenId: string | null;
}

export type BaseNegocio = 'devengo' | 'caja';

export const saldoPendiente = (documento: DocumentoNegocio): number =>
  Math.max(0, documento.totalCop - documento.abonos.reduce((suma, abono) => suma + abono.montoCop, 0));

export const aplicarAbono = (documento: DocumentoNegocio, abono: AbonoNegocio): DocumentoNegocio | null => {
  if (!Number.isSafeInteger(abono.montoCop) || abono.montoCop <= 0 || abono.montoCop > saldoPendiente(documento)) return null;
  return { ...documento, abonos: [...documento.abonos, abono] };
};

export const convertirCotizacion = (documento: DocumentoNegocio, id: string, fecha: string): DocumentoNegocio | null => {
  if (documento.tipo !== 'cotizacion' || documento.estado === 'anulado') return null;
  return {
    ...documento,
    id,
    tipo: 'por_cobrar',
    estado: 'enviado',
    fecha,
    vence: null,
    abonos: [],
    cotizacionOrigenId: documento.id,
  };
};

export interface TotalesNegocio {
  ingresosCop: number;
  gastosCop: number;
  porCobrarCop: number;
  porPagarCop: number;
}

/** Totales gerenciales del mes, deliberadamente separados del libro bancario de LukApp. */
export const totalesNegocio = (documentos: readonly DocumentoNegocio[], mes: string, base: BaseNegocio): TotalesNegocio => {
  const totales: TotalesNegocio = { ingresosCop: 0, gastosCop: 0, porCobrarCop: 0, porPagarCop: 0 };
  for (const documento of documentos) {
    if (documento.estado === 'anulado' || documento.tipo === 'cotizacion') continue;
    const pendiente = saldoPendiente(documento);
    if (documento.tipo === 'por_cobrar') totales.porCobrarCop += pendiente;
    else totales.porPagarCop += pendiente;
    if (base === 'devengo') {
      if (!documento.fecha.startsWith(mes)) continue;
      if (documento.tipo === 'por_cobrar') totales.ingresosCop += documento.totalCop;
      else totales.gastosCop += documento.totalCop;
    } else {
      for (const abono of documento.abonos) {
        if (!abono.fecha.startsWith(mes)) continue;
        if (documento.tipo === 'por_cobrar') totales.ingresosCop += abono.montoCop;
        else totales.gastosCop += abono.montoCop;
      }
    }
  }
  return totales;
};
