import type { Transaction } from '../types';
import type { RevisionDudosa } from '../data/revisiones';
import type { PosibleDuplicado } from './aMovimientos';
import type { MovimientoExtraido } from './tipos';
import { formatCop } from '../lib/formatCop';

interface CasosImportacion {
  trabajoId: string;
  documento: string;
  transacciones: readonly Transaction[];
  movimientosDudosos: readonly MovimientoExtraido[];
  posiblesConfirmados: readonly PosibleDuplicado[];
  transferenciasExcluidas: readonly MovimientoExtraido[];
  ahora: string;
}

/** Conserva las filas que el usuario aún quiere revisar y sus decisiones sobre duplicados. */
export const crearRevisionesImportacion = ({
  trabajoId,
  documento,
  transacciones,
  movimientosDudosos,
  posiblesConfirmados,
  transferenciasExcluidas,
  ahora,
}: CasosImportacion): RevisionDudosa[] => {
  const revisiones: RevisionDudosa[] = [];

  for (const tx of transacciones) {
    const filaDudosa = movimientosDudosos.find((fila) =>
      fila.fecha === tx.occurredOn && fila.montoCop === tx.amountCop && fila.descripcion === tx.description,
    );
    if (filaDudosa) revisiones.push({
      id: `documento:${tx.id}`,
      tipo: 'documento',
      estado: 'pendiente',
      referenciaId: tx.id,
      titulo: 'Confirma la lectura de esta fila',
      detalle: `El lector marcó esta fila con confianza ${filaDudosa.confianza}. Revisa fecha, descripción y monto para asegurar que quedó bien transcrita.`,
      documento,
      resolucion: null,
      createdAt: tx.createdAt,
      updatedAt: tx.createdAt,
    });

    if (tx.kind === 'transferencia' || tx.category === 'transferencia') revisiones.push({
      id: `transferencia:${tx.id}`,
      tipo: 'transferencia',
      estado: 'pendiente',
      referenciaId: tx.id,
      titulo: 'Confirma esta transferencia',
      detalle: 'Revisa si fue un movimiento entre cuentas tuyas y comprueba los saldos de origen y destino.',
      documento,
      resolucion: null,
      createdAt: tx.createdAt,
      updatedAt: tx.createdAt,
    });
  }

  for (const posible of posiblesConfirmados) revisiones.push({
    id: `posible:${posible.transaccion.id}`,
    tipo: 'movimiento',
    estado: 'resuelta',
    referenciaId: posible.transaccion.id,
    titulo: 'Posible duplicado confirmado como distinto',
    detalle: `En el extracto: ${posible.movimiento.descripcion}. Ya estaba anotado: ${posible.yaTengo.description}.`,
    documento,
    resolucion: 'Confirmaste que son dos movimientos diferentes y elegiste importar ambos.',
    createdAt: posible.transaccion.createdAt,
    updatedAt: posible.transaccion.createdAt,
  });

  for (const excluido of transferenciasExcluidas) revisiones.push({
    id: `transferencia-excluida:${trabajoId}:${excluido.fecha}:${excluido.montoCop}:${excluido.descripcion}`,
    tipo: 'transferencia',
    estado: 'pendiente',
    referenciaId: null,
    titulo: 'Verifica una transferencia del extracto',
    detalle: `${excluido.fecha} · ${excluido.descripcion} · ${formatCop(excluido.montoCop)}. Se excluyó del total como traslado entre cuentas propias; confirma que no debía registrarse de otra forma.`,
    documento,
    resolucion: null,
    createdAt: ahora,
    updatedAt: ahora,
  });

  return revisiones;
};
