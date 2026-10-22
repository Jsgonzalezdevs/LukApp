import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Settings2 } from 'lucide-react';
import { useMovimientoReducido } from '../lib/useMovimientoReducido';

interface AvanzadoAhorroProps {
  habilitado: boolean;
  tasaTexto: string;
  error: boolean;
  onHabilitado: (valor: boolean) => void;
  onTasa: (valor: string) => void;
}

/** La tasa describe el ahorro; nunca registra rendimientos como dinero recibido. */
export const AvanzadoAhorro = ({ habilitado, tasaTexto, error, onHabilitado, onTasa }: AvanzadoAhorroProps) => {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const movimientoReducido = useMovimientoReducido();
  const visible = abierto || error;
  const tasa = Number(tasaTexto.replace(',', '.'));
  const tasaValida = Number.isFinite(tasa) && tasa > 0;

  return (
    <section className="mt-4 overflow-hidden rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)]">
      <button
        type="button"
        aria-expanded={visible}
        aria-controls={`${id}-panel`}
        onClick={() => setAbierto(!visible)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-[var(--fin-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--fin-accent)]"
      >
        <Settings2 className="h-5 w-5 shrink-0 text-[var(--fin-ink-soft)]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Avanzado <span className="font-normal text-[var(--fin-ink-faint)]">· opcional</span></span>
          <span className="mt-0.5 block text-[12px] text-[var(--fin-ink-soft)]">{habilitado ? (tasaValida ? `${tasaTexto}% E.A. configurada` : 'Falta indicar la tasa') : 'Configura los rendimientos de tu ahorro'}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${visible ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={`${id}-panel`} hidden={!visible} className="border-t border-[var(--fin-line)] p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <label htmlFor={`${id}-activar`} className="block cursor-pointer text-[14px] font-semibold text-[var(--fin-ink)]">Este ahorro genera rendimientos</label>
            <span id={`${id}-nota`} className="mt-1 block text-[12px] text-[var(--fin-ink-soft)]">{habilitado ? 'Indica la tasa que te ofrece tu entidad.' : 'Actívalo si tu dinero recibe intereses.'}</span>
          </span>
          <button
            id={`${id}-activar`}
            type="button"
            role="switch"
            aria-checked={habilitado}
            aria-label="Este ahorro genera rendimientos"
            aria-describedby={`${id}-nota`}
            onClick={() => onHabilitado(!habilitado)}
            className="flex min-h-11 w-14 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fin-accent)]"
          >
            <span aria-hidden="true" className={`block h-8 w-14 rounded-full p-1 transition-colors motion-reduce:transition-none ${habilitado ? 'bg-[var(--fin-accent)]' : 'bg-[var(--fin-line)]'}`}>
              <span className={`block h-6 w-6 rounded-full bg-[var(--fin-card)] shadow-sm transition-transform motion-reduce:transition-none ${habilitado ? 'translate-x-6' : 'translate-x-0'}`} />
            </span>
          </button>
        </div>
        {habilitado ? (
          <motion.div initial={movimientoReducido ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: movimientoReducido ? 0 : 0.18 }} className="mt-4">
            <label htmlFor={`${id}-tasa`} className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">Tasa efectiva anual (E.A.)</label>
            <div className="relative mt-2">
              <input id={`${id}-tasa`} value={tasaTexto} onChange={(e) => onTasa(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" placeholder="Ej. 10,5" aria-invalid={error} aria-describedby={`${id}-ayuda${error ? ` ${id}-error` : ''}`} className="min-w-0 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] py-3 pl-4 pr-20 text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:border-[var(--fin-accent)]" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--fin-ink-soft)]">% E.A.</span>
            </div>
            <p id={`${id}-ayuda`} className="mt-2 text-[12px] leading-relaxed text-[var(--fin-ink-soft)]">Es la tasa anual que informa tu entidad. Se usa para estimar rendimientos; no se suma automáticamente a tu saldo.</p>
            {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] text-[var(--fin-out)]">Escribe una tasa mayor que cero, por ejemplo 10,5, o desactiva los rendimientos.</p> : null}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
};
