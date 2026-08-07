import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { COPY } from '../copy';
import type { Cajita, CajitaMovimiento, CajitaMovKind } from '../data/modelos';
import { CAJITA_EMOJIS } from '../data/modelos';
import { resumenDeCajitas, totalEnCajitas } from '../lib/cajitas';
import { formatAmountInput, formatCop, parseAmountInput } from '../lib/formatCop';
import { CajitaCard } from './CajitaCard';

interface CajitasViewProps {
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  onCrear: (datos: { nombre: string; emoji: string; metaCop: number | null }) => void;
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  onMovimiento: (cajitaId: string, kind: CajitaMovKind, deltaCop: number) => void;
  onEliminar: (cajitaId: string) => void;
}

export const CajitasView: React.FC<CajitasViewProps> = ({
  cajitas,
  movimientos,
  onCrear,
  onFijarSaldo,
  onMovimiento,
  onEliminar,
}) => {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState<string>(CAJITA_EMOJIS[0]);
  const [metaTexto, setMetaTexto] = useState('');

  const resumenes = resumenDeCajitas(cajitas, movimientos);
  const total = totalEnCajitas(cajitas, movimientos);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;

    onCrear({ nombre: limpio, emoji, metaCop: parseAmountInput(metaTexto) });
    setNombre('');
    setEmoji(CAJITA_EMOJIS[0]);
    setMetaTexto('');
    setCreando(false);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* Total across every live pocket */}
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">
          <span className="fin-emoji mr-1.5" aria-hidden="true">
            🐷
          </span>
          {COPY.cajitas.total}
        </h2>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-ink)]">
          {formatCop(total)}
        </p>
        {resumenes.length > 0 ? (
          <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
            repartido en {resumenes.length} cajita{resumenes.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </section>

      {/* Create */}
      {creando ? (
        <form onSubmit={crear} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">{COPY.cajitas.nueva}</h2>

          <label htmlFor="cajita-nombre" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.cajitas.nombre}
          </label>
          <input
            id="cajita-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={COPY.cajitas.nombrePlaceholder}
            autoFocus
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />

          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">Ícono</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAJITA_EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  aria-pressed={emoji === option}
                  aria-label={`Ícono ${option}`}
                  className={`fin-emoji flex h-10 w-10 items-center justify-center rounded-2xl border-2 text-xl transition-colors ${
                    emoji === option
                      ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)]'
                      : 'border-[var(--fin-line)] bg-[var(--fin-card)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="cajita-meta" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.cajitas.metaOpcional}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="cajita-meta"
              value={metaTexto}
              onChange={(e) => setMetaTexto(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={nombre.trim() === ''}
              className="flex-1 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] disabled:opacity-30"
            >
              {COPY.cajitas.crear}
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="rounded-full bg-[var(--fin-soft)] px-6 py-3.5 text-sm font-bold text-[var(--fin-ink-soft)]"
            >
              {COPY.confirm.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-4 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:border-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {COPY.cajitas.nueva}
        </button>
      )}

      {/* Pockets */}
      {resumenes.length === 0 && !creando ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center">
          <span className="fin-emoji block text-4xl" aria-hidden="true">
            🐷
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">{COPY.cajitas.vacio}</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">{COPY.cajitas.vacioHint}</p>
        </div>
      ) : null}

      {resumenes.map((resumen) => (
        <CajitaCard
          key={resumen.cajita.id}
          resumen={resumen}
          movimientos={movimientos}
          onFijarSaldo={onFijarSaldo}
          onMovimiento={onMovimiento}
          onEliminar={onEliminar}
        />
      ))}
    </div>
  );
};
