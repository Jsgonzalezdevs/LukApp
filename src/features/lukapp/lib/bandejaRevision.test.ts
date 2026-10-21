import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import type { RevisionDudosa } from '../data/revisiones';
import { construirBandejaRevision } from './bandejaRevision';

const tx = (id: string): Transaction => ({
  id,
  kind: 'gasto',
  amountCop: 12000,
  category: 'comida',
  description: 'Café Parque',
  occurredOn: '2026-10-20',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-10-20T12:00:00.000Z',
});

describe('bandeja de revisión', () => {
  it('presenta cobros iguales y conserva la decisión para que no vuelvan a pendientes', () => {
    const transacciones = [tx('uno'), tx('dos')];
    const inicial = construirBandejaRevision(transacciones, []);
    expect(inicial).toHaveLength(2);
    expect(inicial.every((item) => item.estado === 'pendiente' && item.tipo === 'movimiento')).toBe(true);

    const resuelta: RevisionDudosa = {
      ...inicial[0],
      estado: 'resuelta',
      resolucion: 'Revisado por la persona usuaria.',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };
    const actualizada = construirBandejaRevision(transacciones, [resuelta]);
    expect(actualizada.filter((item) => item.estado === 'pendiente')).toHaveLength(1);
    expect(actualizada.find((item) => item.id === resuelta.id)).toMatchObject({
      estado: 'resuelta',
      resolucion: 'Revisado por la persona usuaria.',
    });
  });

  it('incluye casos de extractos persistidos aunque el movimiento ya no tenga una señal automática', () => {
    const documento: RevisionDudosa = {
      id: 'documento:tx',
      tipo: 'documento',
      estado: 'pendiente',
      referenciaId: 'tx',
      titulo: 'Confirma la lectura de esta fila',
      detalle: 'Revisa la cifra detectada.',
      documento: 'extracto-octubre.pdf',
      resolucion: null,
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
    };
    expect(construirBandejaRevision([tx('tx')], [documento])).toContainEqual(documento);
  });
});
