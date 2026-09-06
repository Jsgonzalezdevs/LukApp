import React, { useMemo, useState } from 'react';
import { CalendarDays, CircleAlert, CircleDollarSign, Plus } from 'lucide-react';
import type { ContextoFinanciero } from '../lib/motorFinanciero';
import { eventosDelContexto, type EventoFinanciero } from '../lib/calendarioFinanciero';
import { formatCop } from '../lib/formatCop';

const etiquetaFecha = (evento: EventoFinanciero) => evento.fecha ?? (evento.periodo ? `Período ${evento.periodo}` : 'Fecha no determinada');
export const CalendarioFinancieroView: React.FC<{ contexto: ContextoFinanciero; hoy: string; onAñadirPagoFijo: () => void }> = ({ contexto, hoy, onAñadirPagoFijo }) => {
  const [vista, setVista] = useState<'dia' | 'semana' | 'mes'>('mes');
  const eventos = useMemo(() => eventosDelContexto(contexto, hoy), [contexto, hoy]);
  const fechados = eventos.filter((e) => e.fecha !== null);
  const sinFecha = eventos.filter((e) => e.fecha === null);
  const agrupados = fechados.reduce<Record<string, EventoFinanciero[]>>((grupos, evento) => {
    const clave = vista === 'dia' ? evento.fecha!.slice(0, 10) : vista === 'mes' ? evento.fecha!.slice(0, 7) : evento.fecha!.slice(0, 7);
    (grupos[clave] ??= []).push(evento); return grupos;
  }, {});
  const tarjetaEvento = (evento: EventoFinanciero) => (
    <li key={evento.id} className="flex items-start gap-3 border-b border-[var(--fin-line)] py-3 last:border-0">
      {evento.impacto === 'entrada' ? <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fin-in)]" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fin-out)]" />}
      <div className="min-w-0 flex-1"><p className="font-semibold text-[15px] text-[var(--fin-ink)]">{evento.concepto}</p><p className="text-[12px] text-[var(--fin-ink-faint)]">{etiquetaFecha(evento)} · {evento.estado} · {evento.precision}</p></div>
      <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${evento.impacto === 'entrada' ? 'text-[var(--fin-in)]' : 'text-[var(--fin-out)]'}`}>{evento.montoCop === null ? 'Monto no determinado' : formatCop(evento.montoCop)}</span>
    </li>
  );
  return <section aria-labelledby="calendario-titulo"><div className="mb-5 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><CalendarDays className="h-6 w-6 text-[var(--fin-ink-soft)]" /><div><h1 id="calendario-titulo" className="text-[24px] font-semibold text-[var(--fin-ink)]">Calendario financiero</h1><p className="text-[13px] text-[var(--fin-ink-faint)]">Qué entra, qué sale y qué tan seguro es</p></div></div><button type="button" onClick={onAñadirPagoFijo} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--fin-in)] px-3 py-2 text-[12px] font-semibold text-[var(--fin-on-in)] transition-transform active:scale-95" aria-label="Añadir pago fijo"><Plus className="h-4 w-4" aria-hidden="true" />Añadir</button></div><div className="mb-4 flex gap-1 rounded-xl bg-[var(--fin-soft)] p-1">{(['dia', 'semana', 'mes'] as const).map((opcion) => <button key={opcion} type="button" onClick={() => setVista(opcion)} className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${vista === opcion ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm' : 'text-[var(--fin-ink-soft)]'}`}>{opcion[0].toUpperCase() + opcion.slice(1)}</button>)}</div>{Object.entries(agrupados).map(([clave, filas]) => <div key={clave} className="mb-4 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4"><h2 className="border-b border-[var(--fin-line)] py-3 text-[13px] font-bold text-[var(--fin-ink-soft)]">{clave}</h2><ul>{filas.map(tarjetaEvento)}</ul></div>)}{sinFecha.length > 0 ? <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4"><h2 className="border-b border-[var(--fin-warn)]/20 py-3 text-[13px] font-bold text-[var(--fin-warn-ink)]">Sin fecha exacta</h2><ul>{sinFecha.map(tarjetaEvento)}</ul></div> : null}{eventos.length === 0 ? <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5 text-center text-[14px] text-[var(--fin-ink-faint)]">No hay eventos futuros conocidos. Añade un pago fijo para proyectarlo.</p> : null}</section>;
};
