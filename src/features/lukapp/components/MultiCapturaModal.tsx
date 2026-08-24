import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, X, Sparkles } from 'lucide-react';
import type { ParsedTransaction } from '../lib/parseTransaction';
import type { Cajita } from '../data/modelos';
import type { ConfirmDraft } from './ConfirmSheet';
import { formatCop } from '../lib/formatCop';
import { useCatalogo } from '../catalogoContexto';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';

interface MultiCapturaModalProps {
  parsedList: ParsedTransaction[];
  cajitas?: readonly Cajita[];
  cuentaPorDefecto?: string | null;
  onSaveAll: (drafts: ConfirmDraft[]) => void;
  onCancel: () => void;
}

export const MultiCapturaModal: React.FC<MultiCapturaModalProps> = ({
  parsedList,
  cajitas = [],
  cuentaPorDefecto,
  onSaveAll,
  onCancel,
}) => {
  const catalogo = useCatalogo();
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  const [items, setItems] = useState<ParsedTransaction[]>(parsedList);

  const eliminarItem = (index: number) => {
    haptic.trigger('light');
    audio.play('click');
    const filtrados = items.filter((_, i) => i !== index);
    if (filtrados.length === 0) {
      onCancel();
    } else {
      setItems(filtrados);
    }
  };

  const guardarTodos = () => {
    haptic.trigger('medium');
    audio.play('click');

    const drafts: ConfirmDraft[] = items.map((item) => {
      const amountCop = item.amount ? Math.round(item.amount) : 0;
      return {
        kind: item.kind,
        amountCop,
        category: item.category,
        description: item.description || item.raw,
        cuentaId: item.cuentaId ?? cuentaPorDefecto ?? (cajitas[0]?.id || null),
        occurredOn: item.dateOverride || undefined,
        rawTranscript: item.raw,
      };
    });

    onSaveAll(drafts);
  };

  const totalGastos = items
    .filter((i) => i.kind === 'gasto' && i.amount)
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  const totalIngresos = items
    .filter((i) => i.kind === 'ingreso' && i.amount)
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg overflow-hidden rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)]/50 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--fin-ink)]">
                {items.length} movimientos detectados
              </h2>
              <p className="text-[12px] text-[var(--fin-ink-soft)]">
                Detectamos varios registros en tu mensaje
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista de movimientos detectados */}
        <div className="mt-4 max-h-[50vh] overflow-y-auto pr-1 flex flex-col gap-2.5">
          <AnimatePresence>
            {items.map((item, idx) => {
              const catObj = catalogo.de(item.category);
              const esGasto = item.kind === 'gasto';
              const cuentaObj = cajitas.find((c) => c.id === item.cuentaId);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)]/60 bg-[var(--fin-bg)] p-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm"
                      style={{ backgroundColor: catObj.color || (esGasto ? 'var(--fin-out)' : 'var(--fin-in)') }}
                    >
                      {esGasto ? '💸' : '💰'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-[var(--fin-ink)]">
                        {item.description || catObj.nombre}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--fin-ink-soft)]">
                        <span className="font-semibold text-[var(--fin-ink-faint)]">
                          {catObj.nombre}
                        </span>
                        {cuentaObj ? (
                          <>
                            <span>•</span>
                            <span className="truncate">{cuentaObj.nombre}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className="text-[15px] font-extrabold tabular-nums"
                        style={{ color: esGasto ? 'var(--fin-out)' : 'var(--fin-in)' }}
                      >
                        {esGasto ? '-' : '+'}
                        {formatCop(item.amount || 0)}
                      </p>
                      <span className="text-[10.5px] uppercase font-bold text-[var(--fin-ink-faint)]">
                        {esGasto ? 'Gasto' : 'Ingreso'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      title="Eliminar este movimiento"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fin-ink-faint)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Resumen total */}
        <div className="mt-4 flex items-center justify-between border-t border-[var(--fin-line)]/50 pt-3 px-1 text-[13px]">
          <span className="font-medium text-[var(--fin-ink-soft)]">Total a registrar:</span>
          <div className="flex items-center gap-3 font-bold tabular-nums">
            {totalGastos > 0 && (
              <span className="text-[var(--fin-out)]">-{formatCop(totalGastos)}</span>
            )}
            {totalIngresos > 0 && (
              <span className="text-[var(--fin-in)]">+{formatCop(totalIngresos)}</span>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] py-3 text-[14.5px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
          >
            Cancelar
          </button>
          <RippleButton
            type="button"
            onClick={guardarTodos}
            rippleColor="rgba(255,255,255,0.4)"
            className="flex-[2] flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[15px] font-bold text-[var(--fin-on-accent)] shadow-lg shadow-amber-500/25 transition-all hover:bg-[var(--fin-accent-hover)]"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Guardar los {items.length} movimientos
          </RippleButton>
        </div>
      </motion.div>
    </div>
  );
};
