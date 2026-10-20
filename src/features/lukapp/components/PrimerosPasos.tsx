import { Check, Wallet, PencilLine } from 'lucide-react';
import type { preparacionInicio } from '../lib/preparacionInicio';

interface Props {
  estado: ReturnType<typeof preparacionInicio>;
  onCuenta?: (id: string | null) => void;
  onAnotar?: () => void;
}

export const PrimerosPasos = ({ estado, onCuenta, onAnotar }: Props) => {
  if (estado.saldosCompletos && estado.primerMovimiento) return null;
  const completados = Number(estado.saldosCompletos) + Number(estado.primerMovimiento);
  return <section aria-label="Primeros pasos" className="mt-4 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold text-[var(--fin-ink)]">Pon tu dinero al día</h2>
      <span className="text-xs text-[var(--fin-ink-soft)]">{completados} de 2 pasos</span>
    </div>
    <ol className="mt-3 space-y-4">
      <li>
        <p className="flex items-center gap-2 font-medium text-[var(--fin-ink)]">{estado.saldosCompletos ? <Check size={18} aria-hidden="true" /> : <Wallet size={18} aria-hidden="true" />}1. Confirma cuánto tienes</p>
        <p className="mt-1 text-sm text-[var(--fin-ink-soft)]">{estado.saldosCompletos ? 'Tus cuentas tienen un saldo de referencia.' : 'Escribe el saldo actual de cada cuenta, incluido Efectivo. Si está vacía, confirma $0; dejarlo pendiente no significa tener cero.'}</p>
        {!estado.saldosCompletos && onCuenta ? <div className="mt-2 flex flex-wrap gap-2">
          {estado.sinSaldo.map((c) => <button key={c.id} type="button" onClick={() => onCuenta(c.id)} className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-sm font-semibold text-[var(--fin-ink)]">Confirmar saldo de {c.nombre}</button>)}
          <button type="button" onClick={() => onCuenta(null)} className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-3 py-2 text-sm text-[var(--fin-ink)]">Agregar una cuenta</button>
        </div> : null}
      </li>
      <li>
        <p className="flex items-center gap-2 font-medium text-[var(--fin-ink)]">{estado.primerMovimiento ? <Check size={18} aria-hidden="true" /> : <PencilLine size={18} aria-hidden="true" />}2. Anota tu primer movimiento</p>
        <p className="mt-1 text-sm text-[var(--fin-ink-soft)]">{estado.primerMovimiento ? 'Ya tienes movimientos registrados.' : 'Registra un gasto o ingreso real, elige su cuenta y revisa antes de guardar. También puedes usar voz o una foto.'}</p>
        {!estado.primerMovimiento && onAnotar ? <button type="button" onClick={onAnotar} className="mt-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-sm font-semibold text-[var(--fin-on-accent)]">Anotar mi primer movimiento</button> : null}
      </li>
    </ol>
  </section>;
};
