import { CalendarDays, ChevronRight } from 'lucide-react';
import type { ObligacionFutura } from '../lib/obligacionesFuturas';
import { formatCop } from '../lib/formatCop';

interface Props {
  obligaciones: readonly ObligacionFutura[];
  hoy: string;
  privacidad: boolean;
  onVerPagos: () => void;
}

export const ProximosPagosInicio = ({ obligaciones, hoy, privacidad, onVerPagos }: Props) => {
  const pendientes = obligaciones.filter((o) => o.estado !== 'confirmada');
  const fechados = pendientes.filter((o) => o.fecha !== null)
    .sort((a, b) => a.fecha!.localeCompare(b.fecha!) || a.id.localeCompare(b.id));
  const sinFecha = pendientes.filter((o) => o.fecha === null);
  const fechaCorta = (fecha: string) => fecha === hoy ? 'Hoy' : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(`${fecha}T12:00:00`));
  return <section aria-label="Próximos pagos" className="mt-5 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold text-[var(--fin-ink)]"><CalendarDays size={18} aria-hidden="true" />Próximos pagos</h2>
      <button type="button" onClick={onVerPagos} className="flex items-center gap-1 rounded-[var(--fin-r-control)] px-2 py-2 text-sm font-semibold text-[var(--fin-ink-soft)]">Ver calendario<ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">Desde hoy · próximos 90 días</p>
    {fechados.length > 0 ? <ul className="mt-2 divide-y divide-[var(--fin-line)]">
      {fechados.slice(0, 3).map((pago) => <li key={pago.id}>
        <button type="button" onClick={onVerPagos} className="flex w-full items-start justify-between gap-3 py-3 text-left">
          <span className="min-w-0"><span className="block truncate font-medium text-[var(--fin-ink)]">{pago.concepto}</span><span className="mt-1 block text-xs text-[var(--fin-ink-soft)]">{fechaCorta(pago.fecha!)} · {pago.fecha! < hoy ? 'Vencido · ' : ''}{pago.certeza === 'estimada' ? 'Estimado' : pago.certeza === 'real' ? 'Importe confirmado' : 'Programado'}</span></span>
          <span className="shrink-0 font-semibold tabular-nums text-[var(--fin-ink)]">{privacidad ? '$ ••••••' : pago.montoCop === null ? 'Por confirmar' : formatCop(pago.montoCop)}</span>
        </button>
      </li>)}
    </ul> : <p className="mt-3 text-sm text-[var(--fin-ink-soft)]">No hay pagos con fecha registrada para los próximos 90 días. Agrega los que conozcas desde Mes.</p>}
    {sinFecha.length > 0 ? <button type="button" onClick={onVerPagos} className="mt-2 w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-left text-sm text-[var(--fin-ink)]">Hay obligaciones sin fecha por confirmar. Revísalas en Mes.</button> : null}
    {pendientes.length > 0 ? <p className="mt-2 text-xs text-[var(--fin-ink-faint)]">Son compromisos previstos; aparecer aquí no registra un gasto ni un pago.</p> : null}
  </section>;
};
