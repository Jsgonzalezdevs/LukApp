/** Casos que necesitan una decisión humana dentro de la bandeja de revisión. */
export type TipoRevision = 'movimiento' | 'documento' | 'transferencia';
export type EstadoRevision = 'pendiente' | 'resuelta' | 'descartada';

export interface RevisionDudosa {
  id: string;
  tipo: TipoRevision;
  estado: EstadoRevision;
  referenciaId: string | null;
  titulo: string;
  detalle: string;
  documento: string | null;
  resolucion: string | null;
  createdAt: string;
  updatedAt: string;
}
