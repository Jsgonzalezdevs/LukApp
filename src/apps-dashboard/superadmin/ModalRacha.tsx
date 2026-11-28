import React from 'react';
import {
  Loader2,
} from 'lucide-react';
import { type Perfil } from './tipos';
import { type RachaAdmin } from './racha';

export const ModalRacha: React.FC<{ racha: RachaAdmin; rachaDe: Perfil }> = ({ racha, rachaDe }) => {
  const { setRachaDe, estadoRacha, diasASumar, setDiasASumar, rachaCargando, rachaError, cambiarRacha } = racha;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !rachaCargando && setRachaDe(null)} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <h3 className="text-base font-bold text-[var(--fin-ink)]">🔥 Racha de {rachaDe.usuario || rachaDe.email}</h3>
        <p className="mt-2 text-xs text-[var(--fin-ink-soft)] leading-relaxed">
          Se suman exactamente a su racha actual. Si la racha se corta, los días regalados se
          van con ella. No crean movimientos: solo cuentan para la racha.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { etiqueta: 'Actual', valor: estadoRacha?.rachaActual },
            { etiqueta: 'Máxima', valor: estadoRacha?.rachaMaxima },
            { etiqueta: 'Regalados', valor: estadoRacha?.diasRegalados },
          ].map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="rounded-2xl bg-[var(--fin-soft)] p-2.5">
              <p className="text-lg font-bold tabular-nums text-[var(--fin-ink)]">
                {valor ?? (rachaCargando ? '…' : '—')}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">{etiqueta}</p>
            </div>
          ))}
        </div>
        {estadoRacha && !estadoRacha.anotadoHoy && (
          <p className="mt-2 text-[11px] text-[var(--fin-ink-soft)]">Hoy aún no ha anotado: la conserva si anota antes de medianoche.</p>
        )}

        <label className="mt-4 block text-xs font-bold text-[var(--fin-ink)]" htmlFor="dias-racha">Días a sumar</label>
        <input
          id="dias-racha"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          value={diasASumar}
          onChange={(e) => setDiasASumar(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-base text-[var(--fin-ink)] outline-none focus:border-[var(--fin-ink-soft)]"
        />

        {rachaError && (
          <div className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{rachaError}</div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {(estadoRacha?.diasRegalados ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => void cambiarRacha('quitar')}
              disabled={rachaCargando}
              className="mr-auto rounded-xl px-3 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
            >
              Quitar regalados
            </button>
          )}
          <button
            type="button"
            onClick={() => setRachaDe(null)}
            disabled={rachaCargando}
            className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void cambiarRacha('sumar')}
            disabled={rachaCargando}
            className="rounded-xl bg-[var(--fin-ink)] px-4 py-2 text-xs font-bold text-[var(--fin-card)] hover:opacity-90"
          >
            {rachaCargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sumar días'}
          </button>
        </div>
      </div>
    </div>
  );
};
