import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import type { MovimientoExtraido } from './tipos';
import { crearRevisionesImportacion } from './revisionesImportacion';

const transaccion: Transaction = {
  id: 'tx-1', kind: 'gasto', amountCop: 40000, category: 'transferencia',
  description: 'Traslado propio', occurredOn: '2026-10-20', cuentaId: 'cuenta-1',
  rawTranscript: 'extracto: Traslado propio', createdAt: '2026-10-20T12:00:00.000Z',
};

const movimiento = (ajustes: Partial<MovimientoExtraido> = {}): MovimientoExtraido => ({
  fecha: '2026-10-20', descripcion: 'Traslado propio', montoCop: 40000, tipo: 'gasto',
  categoria: 'transferencia', confianza: 'media', exclusion: null, ...ajustes,
});

describe('revisiones creadas desde extractos', () => {
  it('guarda la procedencia de una fila ambigua y crea revisión para transferencia categorizada', () => {
    const revisiones = crearRevisionesImportacion({
      trabajoId: 'trabajo-1', documento: 'octubre.pdf', transacciones: [transaccion],
      movimientosDudosos: [movimiento()], posiblesConfirmados: [], transferenciasExcluidas: [],
      ahora: '2026-10-21T12:00:00.000Z',
    });
    expect(revisiones).toHaveLength(2);
    expect(revisiones).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'documento:tx-1', tipo: 'documento', documento: 'octubre.pdf', estado: 'pendiente' }),
      expect.objectContaining({ id: 'transferencia:tx-1', tipo: 'transferencia', estado: 'pendiente' }),
    ]));
  });

  it('registra tanto la confirmación de posible duplicado como un traslado excluido', () => {
    const posible = {
      clave: 'misma-fecha-monto',
      movimiento: movimiento({ confianza: 'alta', descripcion: 'Transferencia a ahorros' }),
      yaTengo: { ...transaccion, id: 'tx-anterior', description: 'Ahorro mensual' },
      transaccion: { ...transaccion, id: 'tx-nuevo', description: 'Transferencia a ahorros' },
    };
    const revisiones = crearRevisionesImportacion({
      trabajoId: 'trabajo-2', documento: 'septiembre.csv', transacciones: [posible.transaccion],
      movimientosDudosos: [], posiblesConfirmados: [posible],
      transferenciasExcluidas: [movimiento({ exclusion: 'traslado-propio' })],
      ahora: '2026-10-21T12:00:00.000Z',
    });
    expect(revisiones).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'posible:tx-nuevo', estado: 'resuelta', resolucion: expect.stringContaining('Confirmaste') }),
      expect.objectContaining({ tipo: 'transferencia', estado: 'pendiente', referenciaId: null, documento: 'septiembre.csv' }),
    ]));
  });
});
