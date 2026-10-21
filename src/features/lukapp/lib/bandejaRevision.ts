import type { Transaction } from '../types';
import { crearIndiceSenales, senalesConIndice } from './senales';
import type { RevisionDudosa } from '../data/revisiones';

const TIPOS_ACCIONABLES = new Set(['duplicado', 'inusual']);

/** Une casos detectados en el historial con los avisos persistidos del usuario. */
export const construirBandejaRevision = (
  transacciones: readonly Transaction[],
  guardadas: readonly RevisionDudosa[],
): RevisionDudosa[] => {
  const indice = crearIndiceSenales(transacciones);
  const porId = new Map(guardadas.map((revision) => [revision.id, revision]));

  for (const tx of transacciones) {
    for (const senal of senalesConIndice(tx, indice)) {
      if (!TIPOS_ACCIONABLES.has(senal.tipo)) continue;
      const id = `senal:${tx.id}:${senal.tipo}`;
      if (porId.has(id)) continue;
      porId.set(id, {
        id,
        tipo: 'movimiento',
        estado: 'pendiente',
        referenciaId: tx.id,
        titulo: senal.titulo,
        detalle: senal.detalle,
        documento: null,
        resolucion: null,
        createdAt: tx.createdAt,
        updatedAt: tx.createdAt,
      });
    }
  }

  return [...porId.values()].sort((a, b) =>
    a.estado === b.estado ? b.updatedAt.localeCompare(a.updatedAt) : a.estado === 'pendiente' ? -1 : 1,
  );
};
