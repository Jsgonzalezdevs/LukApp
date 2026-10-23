import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Check, Clock3, FileText, Wallet } from 'lucide-react';
import type { Transaction } from '../types';
import type { RevisionDudosa, EstadoRevision } from '../data/revisiones';
import { construirBandejaRevision } from '../lib/bandejaRevision';
import { formatCop, formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

const IDENTIDAD = {
  movimiento: { emoji: '💸', nombre: 'Movimiento', Icono: Wallet },
  documento: { emoji: '🧾', nombre: 'Documento', Icono: FileText },
  transferencia: { emoji: '🔄', nombre: 'Transferencia', Icono: ArrowLeftRight },
} as const;

interface BandejaRevisionProps {
  transacciones: readonly Transaction[];
  revisiones: readonly RevisionDudosa[];
  onGuardar: (revision: RevisionDudosa) => Promise<boolean>;
  onAbrirMovimiento: (tx: Transaction) => void;
}

const actualizarEstado = (
  revision: RevisionDudosa,
  estado: EstadoRevision,
): RevisionDudosa => ({
  ...revision,
  estado,
  resolucion: estado === 'resuelta' ? 'Revisado por la persona usuaria.' : 'Aviso descartado por la persona usuaria.',
  updatedAt: new Date().toISOString(),
});

const AVISOS_POR_GRUPO = 5;

export const BandejaRevision: React.FC<BandejaRevisionProps> = ({
  transacciones,
  revisiones,
  onGuardar,
  onAbrirMovimiento,
}) => {
  const [cantidadVisible, setCantidadVisible] = useState(AVISOS_POR_GRUPO);
  const items = construirBandejaRevision(transacciones, revisiones);
  const pendientes = items.filter((item) => item.estado === 'pendiente');
  const pendientesVisibles = pendientes.slice(0, cantidadVisible);
  const resueltas = items.filter((item) => item.estado !== 'pendiente');
  const transaccionPorId = new Map(transacciones.map((tx) => [tx.id, tx]));

  const resolver = (item: RevisionDudosa, estado: EstadoRevision) =>
    onGuardar(actualizarEstado(item, estado));

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4">
        <p className="text-[17px] font-semibold text-[var(--fin-ink)]">Pendientes por revisar</p>
        <p className="mt-1 text-[15px] leading-relaxed text-[var(--fin-ink-soft)]">
          Revisa movimientos repetidos o datos del extracto que quieras confirmar. Tus decisiones aquí no cambian los saldos.
        </p>
        <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          {pendientes.length} aviso{pendientes.length === 1 ? '' : 's'} por revisar
        </p>
      </header>

      {pendientes.length === 0 ? (
        <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-5 py-8 text-center">
          <p className="text-3xl" aria-hidden="true">✨</p>
          <p className="mt-2 text-[17px] font-semibold text-[var(--fin-ink)]">Todo revisado</p>
          <p className="mt-1 text-[15px] text-[var(--fin-ink-soft)]">Si aparece algo que merezca una segunda mirada, lo encontrarás aquí.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientesVisibles.map((item, indice) => {
            const tipo = IDENTIDAD[item.tipo];
            const tx = item.referenciaId ? transaccionPorId.get(item.referenciaId) : undefined;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(indice * 0.025, 0.1) }}
                className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fin-warn-bg)] text-xl" aria-hidden="true">{tipo.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--fin-warn-ink)]">{tipo.nombre} · Por revisar</p>
                    <h2 className="mt-1 text-[17px] font-semibold text-[var(--fin-ink)]">{item.titulo}</h2>
                    <p className="mt-1 text-[15px] leading-relaxed text-[var(--fin-ink-soft)]">{item.detalle}</p>
                    {item.documento ? <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">📄 {item.documento}</p> : null}
                    {tx ? <p className="mt-2 text-[13px] font-semibold text-[var(--fin-ink)]">{dayLabel(tx.occurredOn)} · {formatSigned(tx.amountCop, tx.kind)} · {tx.description}</p> : null}
                    {tx ? <p className="sr-only">{formatCop(tx.amountCop)}</p> : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tx ? (
                    <button type="button" onClick={() => onAbrirMovimiento(tx)} className="min-h-11 rounded-[var(--fin-r-pill)] border border-[var(--fin-line)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-ink)]">
                      Ver movimiento
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void resolver(item, 'resuelta')} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)]">
                    <Check className="h-4 w-4" aria-hidden="true" /> Marcar revisado
                  </button>
                  <button type="button" onClick={() => void resolver(item, 'descartada')} className="min-h-11 rounded-[var(--fin-r-pill)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]">
                    Descartar aviso
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {pendientesVisibles.length < pendientes.length ? (
        <button
          type="button"
          onClick={() => setCantidadVisible((actual) => actual + AVISOS_POR_GRUPO)}
          className="min-h-11 self-center rounded-[var(--fin-r-pill)] px-5 py-2 text-[14px] font-semibold text-[var(--fin-accent)] hover:bg-[var(--fin-soft)]"
        >
          Mostrar {Math.min(AVISOS_POR_GRUPO, pendientes.length - pendientesVisibles.length)} más
        </button>
      ) : null}

      {resueltas.length > 0 ? (
        <details className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-[var(--fin-ink)]">Decisiones guardadas ({resueltas.length})</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {resueltas.map((item) => {
              const tipo = IDENTIDAD[item.tipo];
              return (
                <li key={item.id} className="flex items-start gap-3 border-t border-[var(--fin-line)] pt-3">
                  <span aria-hidden="true" className="text-xl">{tipo.emoji}</span>
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--fin-ink)]">{item.titulo}</p>
                    <p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">{item.resolucion ?? 'Decisión guardada'} · {new Date(item.updatedAt).toLocaleDateString('es-CO')}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
};
