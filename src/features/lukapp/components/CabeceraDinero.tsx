import { useState } from 'react';
import { CalendarDays, Flame, Settings2 } from 'lucide-react';
import type { Transaction } from '../types';
import { calcularRacha } from '../lib/racha';
import { RachaModal } from './RachaModal';

export function CabeceraDinero({ periodo, opciones, onPeriodo, movimientos, hoy, onAjustes }: {
  periodo: string; opciones: { clave: string; etiqueta: string }[]; onPeriodo: (clave: string) => void;
  movimientos: readonly Transaction[]; hoy: string; onAjustes: () => void;
}) {
  const [rachaAbierta, setRachaAbierta] = useState(false);
  const racha = calcularRacha(movimientos, hoy);
  return <>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <label className="relative flex min-w-0 items-center gap-2 rounded-full bg-[var(--fin-soft)] px-3 py-2 text-[15px] font-semibold">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        <select aria-label="Cambiar período" value={periodo} onChange={(e) => onPeriodo(e.target.value)} className="min-w-0 max-w-full bg-transparent capitalize text-[var(--fin-ink)] outline-none">
          {opciones.map(({ clave, etiqueta }) => <option key={clave} value={clave}>{etiqueta}</option>)}
        </select>
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => setRachaAbierta(true)} aria-label="Ver tu racha" className="flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--fin-soft)] px-2.5 text-xs font-bold text-[var(--fin-ink-soft)]">
          <Flame className="h-4 w-4" />{racha.rachaActual} {racha.rachaActual === 1 ? 'día' : 'días'}
        </button>
        <button type="button" onClick={onAjustes} aria-label="Ajustes" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"><Settings2 className="h-4 w-4" /></button>
      </div>
    </div>
    {rachaAbierta && <RachaModal infoRacha={racha} onCerrar={() => setRachaAbierta(false)} />}
  </>;
}
