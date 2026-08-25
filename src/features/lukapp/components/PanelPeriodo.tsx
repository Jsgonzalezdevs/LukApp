import React, { useState } from 'react';
import { CalendarRange, Plus } from 'lucide-react';
import type { ConfigPeriodo, FrecuenciaPeriodo } from '../lib/periodo';
import { claveDePeriodo, etiquetaDePeriodo } from '../lib/periodo';
import { bogotaDate } from '../lib/localDate';

interface PanelPeriodoProps {
  periodo: ConfigPeriodo;
  onCambiarPeriodo: (periodo: ConfigPeriodo) => void;
}

const OPCIONES: ReadonlyArray<{ id: FrecuenciaPeriodo; titulo: string; nota: string }> = [
  { id: 'semanal', titulo: 'Semanal', nota: 'Intervalo fijo de 7 días' },
  { id: 'quincenal', titulo: 'Cada 2 semanas', nota: 'Intervalo fijo de 14 días' },
  { id: 'quincenas-mes', titulo: 'Varias veces al mes', nota: 'Del 1 al 15, y del 16 al fin de mes' },
  { id: 'mensual', titulo: 'Mensual', nota: 'Como siempre — un mes calendario, con inicio ajustable' },
  { id: 'todo-el-tiempo', titulo: 'Todo el tiempo', nota: 'Sin reinicio. Útil para vacaciones o un proyecto puntual' },
];

/**
 * Con qué frecuencia se reinicia Inicio, Mes, Presupuestos y el Asesor.
 *
 * Mensual sin desfase es el valor de siempre -- nadie que no toque esta
 * pantalla nota ningún cambio. El 4x1000, los pagos recurrentes y el resumen
 * tipo Wrapped se quedan siempre en mes calendario real, sin importar lo que
 * se elija aquí: son cosas que o bien la ley (el 4x1000) o bien su propio
 * formato (un resumen "del mes") no dejan estirar a otra frecuencia.
 */
export const PanelPeriodo: React.FC<PanelPeriodoProps> = ({ periodo, onCambiarPeriodo }) => {
  const [conDesfase, setConDesfase] = useState(periodo.desfaseDiasMensual > 0);

  const elegirFrecuencia = (frecuencia: FrecuenciaPeriodo) => {
    onCambiarPeriodo({
      frecuencia,
      desfaseDiasMensual: frecuencia === 'mensual' ? periodo.desfaseDiasMensual : 0,
    });
    if (frecuencia !== 'mensual') setConDesfase(false);
  };

  const cambiarDesfase = (dias: number) => {
    const acotado = Math.min(27, Math.max(0, Math.round(dias)));
    onCambiarPeriodo({ frecuencia: 'mensual', desfaseDiasMensual: acotado });
  };

  const hoy = bogotaDate();
  const claveActual = claveDePeriodo(hoy, periodo);
  const etiquetaActual = etiquetaDePeriodo(claveActual, periodo);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <CalendarRange className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Período
        </h2>
        <p className="mt-2 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          Con qué frecuencia se reinicia Inicio, Mes, Presupuestos y las recomendaciones del
          Asesor. Ahora mismo: <strong className="text-[var(--fin-ink)]">{etiquetaActual}</strong>.
        </p>
      </div>

      <fieldset className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <legend className="px-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">Frecuencia</legend>
        <div className="mt-1 flex flex-col gap-1.5">
          {OPCIONES.map((op) => (
            <label
              key={op.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--fin-r-control)] border-2 px-3 py-2.5 transition-colors ${
                periodo.frecuencia === op.id
                  ? 'border-[var(--fin-ink)] bg-[var(--fin-bg)]'
                  : 'border-[var(--fin-line)]'
              }`}
            >
              <input
                type="radio"
                name="frecuencia-periodo"
                checked={periodo.frecuencia === op.id}
                onChange={() => elegirFrecuencia(op.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fin-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[var(--fin-ink)]">{op.titulo}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                  {op.nota}
                </span>
              </span>
            </label>
          ))}
        </div>

        {periodo.frecuencia === 'mensual' ? (
          conDesfase || periodo.desfaseDiasMensual > 0 ? (
            <div className="mt-3">
              <label htmlFor="desfase-mes" className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">
                Tu mes empieza el día
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="desfase-mes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={28}
                  value={periodo.desfaseDiasMensual + 1}
                  onChange={(e) => cambiarDesfase(Number(e.target.value) - 1)}
                  className="w-20 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
                />
                <span className="text-[13px] text-[var(--fin-ink-faint)]">
                  en vez del día 1 — para alinear con tu día de pago
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConDesfase(true)}
              className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Añadir desfase de inicio de mes
            </button>
          )
        ) : null}
      </fieldset>

      <p className="px-1 text-[12px] leading-relaxed text-[var(--fin-ink-faint)]">
        El 4x1000, los pagos recurrentes y el resumen tipo Wrapped siguen siempre el mes
        calendario real, sin importar lo que elijas aquí.
      </p>
    </section>
  );
};
