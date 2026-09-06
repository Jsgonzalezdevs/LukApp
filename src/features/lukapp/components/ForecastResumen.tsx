import React from 'react';
import type { ForecastFinanciero, EscenarioForecast } from '../lib/proyeccionFinanciera';
import { formatCop } from '../lib/formatCop';

interface Props { forecast: ForecastFinanciero | null | undefined }
const valor = (v: number | null) => v === null ? 'No disponible' : formatCop(v);

export const ForecastResumen: React.FC<Props> = ({ forecast }) => (
  <section aria-labelledby="forecast-titulo" className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="forecast-titulo" className="text-[15px] font-semibold text-[var(--fin-ink)]">Situación esperada</h2>
      <span className="text-[12px] text-[var(--fin-ink-faint)]">Escenario base</span>
    </div>
    {!forecast ? <p className="mt-3 text-[13px] text-[var(--fin-ink-faint)]">Forecast no disponible.</p> : (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {forecast.horizontes.map(({ dias, base, conservador, favorable }) => <article key={dias} className="rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] p-3">
          <h3 className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">{dias} días</h3>
          <p className="mt-2 text-[12px] text-[var(--fin-ink-faint)]">Liquidez</p><p className="font-semibold tabular-nums text-[var(--fin-ink)]">{valor(base.liquidezCop)}</p>
          <p className="mt-1 text-[12px] text-[var(--fin-ink-faint)]">Disponible diario</p><p className="font-semibold tabular-nums text-[var(--fin-ink)]">{valor(base.disponibleDiarioCop)}</p>
          <p className="mt-1 text-[12px] text-[var(--fin-ink-faint)]">Flujo neto</p><p className="font-semibold tabular-nums text-[var(--fin-ink)]">{valor(base.flujoNetoCop)}</p>
          <p className="mt-2 text-[12px] text-[var(--fin-ink-faint)]">Riesgo: {base.evidencia.length ? base.evidencia[0] : 'sin evidencia adicional'} · Confianza: {base.confianza}</p>
          <Escenarios conservador={conservador} favorable={favorable} />
        </article>)}
      </div>
    )}
  </section>
);

const Escenarios: React.FC<{ conservador: EscenarioForecast; favorable: EscenarioForecast }> = ({ conservador, favorable }) => (
  <p className="mt-2 border-t border-[var(--fin-line)] pt-2 text-[11px] text-[var(--fin-ink-faint)]">Conservador: {conservador.confianza === 'desconocida' ? 'no disponible por falta de datos' : valor(conservador.liquidezCop)} · Favorable: {favorable.confianza === 'desconocida' ? 'no disponible por falta de datos' : valor(favorable.liquidezCop)}</p>
);
