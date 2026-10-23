import React, { useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Check,
  Clock3,
  Layers3,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConfigPeriodo, FrecuenciaPeriodo } from '../lib/periodo';
import {
  claveDePeriodo,
  diasDelPeriodo,
  diasTranscurridosEnPeriodo,
  etiquetaDePeriodo,
} from '../lib/periodo';
import { bogotaDate } from '../lib/localDate';
import { SelectorFechaApp } from './SelectorFechaApp';

interface PanelPeriodoProps {
  periodo: ConfigPeriodo;
  onCambiarPeriodo: (periodo: ConfigPeriodo) => void;
}

const OPCIONES: ReadonlyArray<{ id: FrecuenciaPeriodo; titulo: string; nota: string; icono: LucideIcon }> = [
  { id: 'semanal', titulo: 'Semanal', nota: 'Se renueva cada 7 días', icono: CalendarDays },
  { id: 'quincenal', titulo: 'Cada 2 semanas', nota: 'Se renueva cada 14 días', icono: CalendarRange },
  { id: 'quincenas-mes', titulo: 'Dos veces al mes', nota: 'Del 1 al 15 y del 16 al fin de mes', icono: Layers3 },
  { id: 'mensual', titulo: 'Mensual', nota: 'Sigue el mes calendario', icono: CalendarDays },
  { id: 'personalizado', titulo: 'Personalizado', nota: 'Elige el inicio y la duración', icono: Sparkles },
  { id: 'todo-el-tiempo', titulo: 'Sin reinicio', nota: 'Un solo período continuo', icono: Clock3 },
];

/** El periodo activo de Inicio, Mes, Presupuestos y recomendaciones del Asesor. */
export const PanelPeriodo: React.FC<PanelPeriodoProps> = ({ periodo, onCambiarPeriodo }) => {
  const [conDesfase, setConDesfase] = useState(periodo.desfaseDiasMensual > 0);
  const [borradorDuracion, setBorradorDuracion] = useState({
    guardado: periodo.diasPersonalizados,
    valor: periodo.diasPersonalizados ?? 14,
  });
  const duracionBorrador = borradorDuracion.guardado === periodo.diasPersonalizados
    ? borradorDuracion.valor
    : periodo.diasPersonalizados ?? 14;
  const hoy = bogotaDate();
  const duracion = duracionBorrador;
  const periodoVista = periodo.frecuencia === 'personalizado'
    ? { ...periodo, diasPersonalizados: duracion }
    : periodo;
  const claveActual = claveDePeriodo(hoy, periodoVista);
  const etiquetaActual = etiquetaDePeriodo(claveActual, periodoVista);

  const elegirFrecuencia = (frecuencia: FrecuenciaPeriodo) => {
    if (frecuencia === 'personalizado') {
      onCambiarPeriodo({
        frecuencia,
        desfaseDiasMensual: 0,
        diasPersonalizados: periodo.diasPersonalizados ?? 14,
        fechaAnclaPersonalizada: periodo.fechaAnclaPersonalizada ?? hoy,
      });
      return;
    }
    onCambiarPeriodo({
      ...periodo,
      frecuencia,
      desfaseDiasMensual: frecuencia === 'mensual' ? periodo.desfaseDiasMensual : 0,
    });
    if (frecuencia !== 'mensual') setConDesfase(false);
  };

  const cambiarDesfase = (dias: number) => {
    const acotado = Math.min(27, Math.max(0, Math.round(dias)));
    onCambiarPeriodo({ frecuencia: 'mensual', desfaseDiasMensual: acotado });
  };

  const cambiarDuracion = (dias: number) => {
    setBorradorDuracion({ guardado: periodo.diasPersonalizados, valor: dias });
  };

  const guardarDuracion = () => {
    if (periodo.frecuencia !== 'personalizado' || duracionBorrador === periodo.diasPersonalizados) return;
    onCambiarPeriodo({
      ...periodo,
      desfaseDiasMensual: 0,
      diasPersonalizados: duracionBorrador,
      fechaAnclaPersonalizada: periodo.fechaAnclaPersonalizada ?? hoy,
    });
  };

  const cambiarAncla = (evento: React.ChangeEvent<HTMLInputElement>) => {
    onCambiarPeriodo({
      ...periodo,
      frecuencia: 'personalizado',
      desfaseDiasMensual: 0,
      diasPersonalizados: periodo.diasPersonalizados ?? 14,
      fechaAnclaPersonalizada: evento.target.value,
    });
  };

  const fechaAncla = periodo.fechaAnclaPersonalizada ?? hoy;
  const diasDelCiclo = diasDelPeriodo(claveActual, periodoVista);
  const diasPasados = diasTranscurridosEnPeriodo(claveActual, hoy, periodoVista);
  const progreso = diasDelCiclo && diasPasados !== null
    ? Math.min(100, Math.max(0, (diasPasados / diasDelCiclo) * 100))
    : 0;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <CalendarRange className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          Período
        </h2>
        <div className="mt-2 flex items-center gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-soft)] px-4 py-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--fin-card)] text-[var(--fin-accent)] shadow-sm">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            Elige cómo se agrupan tus finanzas en Inicio, Mes, Presupuestos y el Asesor.
            <span className="mt-0.5 block font-semibold text-[var(--fin-ink)]">Período actual: {etiquetaActual}</span>
          </p>
        </div>
      </div>

      <fieldset className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4 sm:p-5">
        <legend className="px-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">Frecuencia</legend>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {OPCIONES.map((op) => {
            const seleccionada = periodo.frecuencia === op.id;
            const Icono = op.icono;
            return (
              <label
                key={op.id}
                className={`group relative flex min-h-[82px] cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  seleccionada
                    ? 'border-[var(--fin-accent)] bg-[var(--fin-soft)] shadow-sm ring-1 ring-[var(--fin-accent)]/20'
                    : 'border-[var(--fin-line)] bg-[var(--fin-bg)] hover:border-[var(--fin-ink-faint)]'
                }`}
              >
                <input
                  type="radio"
                  name="frecuencia-periodo"
                  checked={seleccionada}
                  onChange={() => elegirFrecuencia(op.id)}
                  className="sr-only"
                />
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${seleccionada ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]' : 'bg-[var(--fin-card)] text-[var(--fin-ink-soft)]'}`}>
                  <Icono className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block pr-5 text-[14px] font-semibold leading-snug text-[var(--fin-ink)]">{op.titulo}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-[var(--fin-ink-faint)]">{op.nota}</span>
                </span>
                <span className={`absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${seleccionada ? 'border-[var(--fin-accent)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)]' : 'border-[var(--fin-line)] text-transparent'}`}>
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>

        {periodo.frecuencia === 'mensual' ? (
          conDesfase || periodo.desfaseDiasMensual > 0 ? (
            <div className="mt-4 rounded-2xl bg-[var(--fin-soft)] p-4">
              <label htmlFor="desfase-mes" className="block text-[13px] font-semibold text-[var(--fin-ink)]">
                Día de inicio del mes
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  id="desfase-mes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={28}
                  value={periodo.desfaseDiasMensual + 1}
                  onChange={(e) => cambiarDesfase(Number(e.target.value) - 1)}
                  className="w-20 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-center text-[17px] font-semibold text-[var(--fin-ink)] focus:border-[var(--fin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/20"
                />
                <span className="text-[12px] text-[var(--fin-ink-faint)]">Del día elegido al día anterior del mes siguiente.</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConDesfase(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--fin-line)] px-3.5 py-2 text-[12px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Ajustar día de inicio
            </button>
          )
        ) : null}

        {periodo.frecuencia === 'personalizado' ? (
          <div className="mt-4 space-y-4 rounded-[22px] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-4 sm:p-5">
            <div className="rounded-2xl bg-[var(--fin-soft)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fin-ink-faint)]">Vista previa de tu ciclo</p>
                  <p className="mt-1 text-[19px] font-bold tracking-tight text-[var(--fin-ink)]">{etiquetaActual}</p>
                </div>
                <span className="rounded-full bg-[var(--fin-card)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fin-accent)] shadow-sm">{diasPasados ?? 0} de {diasDelCiclo ?? duracion} días</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--fin-card)]">
                <div className="h-full rounded-full bg-[var(--fin-accent)] transition-[width] duration-300" style={{ width: `${progreso}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-medium text-[var(--fin-ink-faint)]">
                <span>Inicio del ciclo</span>
                <span>{diasPasados === diasDelCiclo ? 'Cierra hoy · mañana inicia otro' : `Quedan ${Math.max(0, (diasDelCiclo ?? duracion) - (diasPasados ?? 0))} días`}</span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <label htmlFor="duracion-personalizada" className="text-[13px] font-semibold text-[var(--fin-ink)]">Duración del ciclo</label>
                <span className="rounded-full bg-[var(--fin-card)] px-3 py-1 text-[13px] font-bold text-[var(--fin-accent)]">{duracion} días</span>
              </div>
              <input
                id="duracion-personalizada"
                type="range"
                min={1}
                max={90}
                value={duracion}
                onChange={(evento) => cambiarDuracion(Number(evento.target.value))}
                onPointerUp={guardarDuracion}
                onKeyUp={guardarDuracion}
                onBlur={guardarDuracion}
                aria-label="Duración del ciclo en días"
                className="h-2 w-full cursor-pointer accent-[var(--fin-accent)]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--fin-ink-faint)]"><span>1 día</span><span>45 días</span><span>90 días</span></div>
            </div>

            <div>
              <label htmlFor="ancla-personalizada" className="mb-2 block text-[13px] font-semibold text-[var(--fin-ink)]">El ciclo empieza desde</label>
              <SelectorFechaApp
                id="ancla-personalizada"
                aria-label="Fecha de inicio del primer ciclo"
                value={fechaAncla}
                onChange={cambiarAncla}
                max={hoy}
                className="w-full rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[15px] font-medium text-[var(--fin-ink)] transition-colors focus:border-[var(--fin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/20"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">A partir de esta fecha, LukApp repetirá el ciclo con la duración que elegiste.</p>
            </div>
          </div>
        ) : null}
      </fieldset>

      <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-[var(--fin-ink-faint)]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fin-accent)]" aria-hidden="true" />
        El 4x1000, los pagos recurrentes y el resumen tipo Wrapped siguen el mes calendario real.
      </p>
    </section>
  );
};
