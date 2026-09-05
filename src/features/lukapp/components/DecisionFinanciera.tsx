import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCop } from '../lib/formatCop';
import { detectarAnomalias } from '../lib/inteligenciaFinanciera';
import type { ContextoFinanciero, EntradaMotorFinanciero } from '../lib/motorFinanciero';
import { simularDecisiones } from '../lib/simuladorFinanciero';

interface Props { liquidez: ContextoFinanciero['liquidez']; entrada: EntradaMotorFinanciero; movimientos: readonly Transaction[]; privacidad?: boolean }

export const DecisionFinanciera: React.FC<Props> = ({ liquidez, entrada, movimientos, privacidad = false }) => {
  const [compra, setCompra] = useState('');
  const anomalias = useMemo(() => detectarAnomalias(movimientos), [movimientos]);
  const simulacion = compra ? simularDecisiones(entrada, [{ tipo: 'gasto-extraordinario', montoCop: Number(compra) || 0 }]) : null;
  const dinero = (valor: number) => privacidad ? '$ ••••••' : formatCop(Math.round(valor));
  return <section className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Decisiones financieras">
    <div className="rounded-3xl border border-[var(--fin-accent)]/25 bg-[var(--fin-accent)]/8 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">Puedes gastar hoy</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-[var(--fin-ink)]">{dinero(liquidez.disponibleDiarioCop)}</p>
      <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">Dinero libre: {dinero(liquidez.dineroLibreCop)} · {liquidez.diasRestantesPeriodo} días restantes</p>
      <p className="mt-3 flex items-center gap-1 text-sm font-semibold" style={{ color: liquidez.nivel === 'bien' ? 'var(--fin-in)' : 'var(--fin-out)' }}>
        {liquidez.nivel === 'bien' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />} {liquidez.nivel === 'bien' ? 'Vas bien' : liquidez.nivel === 'incompleto' ? 'Cálculo estimado' : 'Conviene revisar el ritmo'}
      </p>
    </div>
    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">¿Qué pasa si compro?</p>
      <label className="mt-2 flex items-center gap-2 rounded-2xl bg-[var(--fin-soft)] px-3 py-2 text-sm"><span>$</span><input value={compra} onChange={(e) => setCompra(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Escribe un monto" className="w-full bg-transparent outline-none" aria-label="Monto de la compra" /></label>
      {simulacion && <p className="mt-3 text-sm text-[var(--fin-ink-soft)]">Disponible diario: <strong>{dinero(simulacion.simulado.liquidez.disponibleDiarioCop)}</strong> ({dinero(simulacion.diferencia.disponibleDiario.cambioCop)}). Recuperarías el disponible anterior en aproximadamente <strong>{simulacion.recuperacionDias ?? 0} días</strong>.<ArrowRight className="ml-1 inline" size={14} /></p>}
    </div>
    {anomalias[0] && <div className="sm:col-span-2 rounded-3xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm"><strong>Revisa un gasto fuera de lo habitual</strong><p className="mt-1 text-[var(--fin-ink-soft)]">Tu gasto más alto en {anomalias[0].categoria} supera tu promedio en {Math.round(anomalias[0].porcentajeSobrePromedio)}%.</p></div>}
  </section>;
};
