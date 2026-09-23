import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  Landmark,
  Printer,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';
import type { Instantanea } from '../data/repositorio';
import { formatCop } from '../lib/formatCop';
import { ES_PASIVO } from '../data/modelos';
import { descargarExcel } from '../lib/exportarExcel';
import { CATEGORY_COLOR, CATEGORY_LABELS, type Category } from '../types';

interface ReporteFinancieroModalProps {
  abierto: boolean;
  onCerrar: () => void;
  mes: string;
  datos: Instantanea;
  cajitasBalances: Record<string, number>;
  emailUsuario?: string;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const etiquetaCategoria = (categoria: string): string =>
  CATEGORY_LABELS[categoria as Category] ??
  categoria.replace(/[-_]/g, ' ').replace(/^./, (letra) => letra.toUpperCase());

const colorCategoria = (categoria: string): string => CATEGORY_COLOR[categoria as Category] ?? '#A78BFA';

export const ReporteFinancieroModal: React.FC<ReporteFinancieroModalProps> = ({
  abierto,
  onCerrar,
  mes,
  datos,
  cajitasBalances,
  emailUsuario,
}) => {
  if (!abierto) return null;

  const [anoStr, mesStr] = mes.split('-');
  const nombreMes = `${MESES[parseInt(mesStr, 10) - 1]} de ${anoStr}`;
  const txMes = datos.transacciones.filter((t) => t.occurredOn.startsWith(mes));
  const ingresos = txMes.filter((t) => t.kind === 'ingreso').reduce((sum, t) => sum + t.amountCop, 0);
  const gastos = txMes.filter((t) => t.kind === 'gasto').reduce((sum, t) => sum + t.amountCop, 0);
  const balance = ingresos - gastos;
  const porcentajeBalance = ingresos > 0 ? Math.round((balance / ingresos) * 100) : null;

  const categoriasMap = new Map<string, number>();
  for (const tx of txMes.filter((t) => t.kind === 'gasto')) {
    categoriasMap.set(tx.category, (categoriasMap.get(tx.category) || 0) + tx.amountCop);
  }
  const categoriasOrdenadas = Array.from(categoriasMap.entries()).sort((a, b) => b[1] - a[1]);

  const cuentasActivas = datos.cajitas.filter((cuenta) => !cuenta.archivedAt);
  const patrimonioTotal = cuentasActivas
    .filter((cuenta) => !ES_PASIVO[cuenta.tipo])
    .reduce((sum, cuenta) => sum + (cajitasBalances[cuenta.id] ?? 0), 0);
  const tieneBalancePositivo = balance >= 0;
  const resumenBalance = ingresos === 0
    ? 'Registra tus movimientos para ver el cierre del mes.'
    : tieneBalancePositivo
      ? `Te quedó disponible el ${porcentajeBalance}% de lo que ingresó.`
      : `Gastaste ${Math.abs(porcentajeBalance ?? 0)}% más de lo que ingresó.`;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-[var(--fin-scrim)] p-3 sm:items-center sm:p-6 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reporte-titulo"
    >
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-bg)] shadow-2xl print:max-w-none print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 sm:px-6 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--fin-accent)] text-white shadow-sm">
              <BarChart3 className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-[var(--fin-ink)]">Reporte mensual</p>
              <p className="text-[13px] text-[var(--fin-ink-soft)]">{nombreMes}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => descargarExcel(datos, cajitasBalances, mes)} className="hidden min-h-[var(--fin-tap)] items-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] sm:flex">
              <FileSpreadsheet className="h-4 w-4 text-[var(--fin-in)]" aria-hidden="true" /> Excel
            </button>
            <button type="button" onClick={() => window.print()} className="flex min-h-[var(--fin-tap)] items-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110">
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Guardar PDF</span><span className="sm:hidden">PDF</span>
            </button>
            <button type="button" onClick={onCerrar} className="flex h-[var(--fin-tap)] w-[var(--fin-tap)] items-center justify-center rounded-[var(--fin-r-control)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)]" aria-label="Cerrar reporte">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-7 print:p-6">
          <section className="relative overflow-hidden rounded-[var(--fin-r-sheet)] bg-[var(--fin-ink)] px-5 py-6 text-white sm:px-8 sm:py-8 print:bg-zinc-900">
            <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full border border-white/10" />
            <div className="absolute right-10 top-11 h-20 w-20 rounded-full border border-white/10" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-violet-200"><Sparkles className="h-4 w-4" aria-hidden="true" /> TU MES EN PERSPECTIVA</div>
                <h1 id="reporte-titulo" className="text-[30px] font-semibold tracking-[-0.04em] sm:text-[38px]">Así cerraste {nombreMes.toLowerCase()}.</h1>
                <p className="mt-2 max-w-xl text-[15px] leading-6 text-white/70">{resumenBalance}</p>
              </div>
              <div className="rounded-[var(--fin-r-card)] border border-white/15 bg-white/10 px-4 py-3 sm:min-w-44">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Movimientos</p>
                <p className="mt-1 text-[22px] font-semibold">{txMes.length}</p>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-[1.35fr_1fr_1fr] print:grid-cols-3">
            <article className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 print:bg-white">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Balance del mes</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tieneBalancePositivo ? 'bg-[color-mix(in_srgb,var(--fin-in)_14%,transparent)] text-[var(--fin-in)]' : 'bg-[color-mix(in_srgb,var(--fin-out)_14%,transparent)] text-[var(--fin-out)]'}`}>
                  {tieneBalancePositivo ? <ArrowUpRight className="h-5 w-5" aria-hidden="true" /> : <ArrowDownRight className="h-5 w-5" aria-hidden="true" />}
                </span>
              </div>
              <p className={`mt-4 text-[28px] font-semibold tracking-[-0.04em] ${tieneBalancePositivo ? 'text-[var(--fin-in)]' : 'text-[var(--fin-out)]'}`}>{formatCop(balance)}</p>
              <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">{porcentajeBalance === null ? 'Aún no hay ingresos este mes' : `${porcentajeBalance >= 0 ? '+' : ''}${porcentajeBalance}% frente a tus ingresos`}</p>
            </article>
            <article className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 print:bg-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--fin-in)_14%,transparent)] text-[var(--fin-in)]"><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></div>
              <p className="mt-4 text-[13px] font-semibold text-[var(--fin-ink-soft)]">Ingresos</p><p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--fin-ink)]">{formatCop(ingresos)}</p>
            </article>
            <article className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 print:bg-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--fin-out)_14%,transparent)] text-[var(--fin-out)]"><ArrowDownRight className="h-5 w-5" aria-hidden="true" /></div>
              <p className="mt-4 text-[13px] font-semibold text-[var(--fin-ink-soft)]">Gastos</p><p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--fin-ink)]">{formatCop(gastos)}</p>
            </article>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr] print:grid-cols-2">
            <article className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 print:bg-white">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">En qué se fue tu dinero</h2><p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">Tus gastos ordenados de mayor a menor.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-accent)]"><BarChart3 className="h-4 w-4" aria-hidden="true" /></span></div>
              {categoriasOrdenadas.length === 0 ? <div className="mt-8 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-4 text-[13px] text-[var(--fin-ink-soft)]">No registraste gastos durante este mes.</div> : (
                <div className="mt-6 space-y-4">{categoriasOrdenadas.slice(0, 6).map(([categoria, total]) => {
                  const porcentaje = gastos > 0 ? Math.round((total / gastos) * 100) : 0;
                  return <div key={categoria}><div className="flex items-baseline justify-between gap-3 text-[13px]"><span className="font-semibold text-[var(--fin-ink)]">{etiquetaCategoria(categoria)}</span><span className="shrink-0 text-[var(--fin-ink-soft)]">{formatCop(total)} <span className="text-[var(--fin-ink-faint)]">{porcentaje}%</span></span></div><div className="mt-2 h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"><div className="h-full rounded-[var(--fin-r-pill)]" style={{ width: `${porcentaje}%`, backgroundColor: colorCategoria(categoria) }} /></div></div>;
                })}</div>
              )}
            </article>
            <article className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 print:bg-white">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">Tu dinero hoy</h2><p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">El saldo actual de tus cuentas activas.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-accent)]"><WalletCards className="h-4 w-4" aria-hidden="true" /></span></div>
              <div className="mt-5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fin-ink-faint)]">Patrimonio en cuentas</p><p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--fin-ink)]">{formatCop(patrimonioTotal)}</p></div>
              <div className="mt-3 max-h-56 divide-y divide-[var(--fin-line)] overflow-y-auto">
                {cuentasActivas.length === 0 ? <p className="py-4 text-[13px] text-[var(--fin-ink-soft)]">No hay cuentas activas para mostrar.</p> : cuentasActivas.map((cuenta) => {
                  const saldo = cajitasBalances[cuenta.id] ?? 0;
                  const esPasivo = ES_PASIVO[cuenta.tipo];
                  return <div key={cuenta.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"><Landmark className="h-4 w-4" aria-hidden="true" /></span><span className="truncate text-[13px] font-medium text-[var(--fin-ink)]">{cuenta.nombre}</span></div><span className={`shrink-0 text-[13px] font-semibold ${esPasivo ? 'text-[var(--fin-out)]' : 'text-[var(--fin-ink)]'}`}>{formatCop(saldo)}</span></div>;
                })}
              </div>
            </article>
          </section>
          <footer className="mt-5 flex flex-col gap-2 border-t border-[var(--fin-line)] pt-4 text-[12px] text-[var(--fin-ink-faint)] sm:flex-row sm:items-center sm:justify-between print:text-zinc-500"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Preparado el {new Date().toLocaleDateString('es-CO')}</span><span>{emailUsuario ? `Resumen privado de ${emailUsuario}` : 'Resumen privado de tu libro financiero'} · LukApp</span></footer>
        </main>
      </div>
    </div>
  );
};
