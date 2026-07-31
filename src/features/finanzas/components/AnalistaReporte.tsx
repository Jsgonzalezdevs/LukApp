import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { CATEGORY_COLOR, CATEGORY_EMOJI, CATEGORY_LABELS, tint } from '../types';
import { formatCop } from '../lib/formatCop';
import type { AnalisisResultado, UsoTokens } from '../analista/tipos';
import { metricasCoherentes, rebanadasDelAnalisis, totalesDelAnalisis } from '../analista/totales';

interface AnalistaReporteProps {
  resultado: AnalisisResultado;
  uso: UsoTokens | null;
}

const TONO_SEVERIDAD = {
  alta: { bg: '#fff1f2', ink: '#be123c', emoji: '🔴' },
  media: { bg: '#fff7ed', ink: '#c2410c', emoji: '🟠' },
  baja: { bg: '#fefce8', ink: '#a16207', emoji: '🟡' },
} as const;

export const AnalistaReporte: React.FC<AnalistaReporteProps> = ({ resultado, uso }) => {
  // Recomputed here rather than trusted: the model's own metrics table is prose,
  // the movement list is auditable line by line.
  const totales = totalesDelAnalisis(resultado.movimientos);
  const gastos = rebanadasDelAnalisis(resultado.movimientos, 'gasto');
  const cuadra = metricasCoherentes(resultado);

  return (
    <div className="flex flex-col gap-5">
      {/* Verdict */}
      <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-[#78716c]">📋 Veredicto</h2>
          <span className="shrink-0 rounded-full bg-[#f5f3f0] px-2.5 py-1 text-[10px] font-bold text-[#78716c] capitalize">
            {resultado.periodo.etiqueta}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#1c1917]">{resultado.veredicto}</p>
      </section>

      {/* Recomputed totals */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { emoji: '💰', label: 'Ingresos', valor: totales.ingresos, ink: '#15803d', bg: '#f0fdf4' },
          { emoji: '💸', label: 'Gastos', valor: totales.gastos, ink: '#be123c', bg: '#fff1f2' },
          {
            emoji: totales.balance >= 0 ? '🤑' : '😬',
            label: 'Balance',
            valor: totales.balance,
            ink: totales.balance >= 0 ? '#15803d' : '#be123c',
            bg: totales.balance >= 0 ? '#f0fdf4' : '#fff1f2',
          },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#ede9e3] bg-white p-4">
            <span
              className="fin-emoji flex h-8 w-8 items-center justify-center rounded-xl text-base"
              style={{ backgroundColor: k.bg }}
              aria-hidden="true"
            >
              {k.emoji}
            </span>
            <p className="mt-2 text-[11px] font-bold text-[#78716c]">{k.label}</p>
            <p className="truncate text-lg font-extrabold tabular-nums" style={{ color: k.ink }}>
              {formatCop(k.valor)}
            </p>
          </div>
        ))}
      </section>

      {/* What was left out of the totals, and why. Never silent. */}
      {totales.excluidos.length > 0 ? (
        <section className="rounded-3xl border border-[#ede9e3] bg-[#f5f3f0] p-5">
          <h2 className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Info className="h-3.5 w-3.5" strokeWidth={3} />
            No se sumó a los totales
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[#78716c]">
            Sumar estas líneas contaría dos veces la misma plata.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {totales.excluidos.map((ex) => (
              <li
                key={ex.motivo}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-[13px] font-semibold text-[#1c1917]">
                  {ex.motivo}
                  <span className="ml-1.5 font-normal text-[#a8a29e]">({ex.cuantos})</span>
                </span>
                <span className="shrink-0 text-[13px] font-bold text-[#78716c] tabular-nums">
                  {formatCop(ex.montoCop)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Coherence warning: the narrative disagrees with the auditable rows. */}
      {!cuadra ? (
        <p className="flex items-start gap-2 rounded-2xl bg-[#fff7ed] px-4 py-3 text-[11px] leading-relaxed text-[#c2410c]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />
          <span>
            La tabla de métricas no cuadra con los movimientos extraídos. Los totales de arriba se
            calcularon desde los movimientos, que se pueden auditar línea por línea.
          </span>
        </p>
      ) : null}

      {/* Category bars */}
      {gastos.length > 0 ? (
        <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
          <h2 className="text-xs font-bold text-[#78716c]">🎯 En qué se fue</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {gastos.map((slice) => {
              const color = CATEGORY_COLOR[slice.categoria];
              const width = Math.max((slice.total / gastos[0].total) * 100, 4);
              return (
                <li key={slice.categoria} className="flex items-center gap-2.5">
                  <span
                    className="fin-emoji flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ backgroundColor: tint(color, 0.14) }}
                    aria-hidden="true"
                  >
                    {CATEGORY_EMOJI[slice.categoria]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold">
                        {CATEGORY_LABELS[slice.categoria]}
                      </span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
                        {formatCop(slice.total)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f5f3f0]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-[#a8a29e] tabular-nums">
                        {slice.pct}%
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Alerts */}
      {resultado.alertas.length > 0 ? (
        <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
          <h2 className="text-xs font-bold text-[#78716c]">🚨 Alertas</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {resultado.alertas.map((alerta, idx) => {
              const tono = TONO_SEVERIDAD[alerta.severidad];
              return (
                <li
                  key={`${alerta.titulo}-${idx}`}
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: tono.bg }}
                >
                  <p className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: tono.ink }}>
                    <span className="fin-emoji" aria-hidden="true">
                      {tono.emoji}
                    </span>
                    {alerta.titulo}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: tono.ink }}>
                    {alerta.detalle}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Recommendations */}
      {resultado.recomendaciones.length > 0 ? (
        <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
          <h2 className="text-xs font-bold text-[#78716c]">💡 Qué puedes hacer</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {resultado.recomendaciones.map((rec, idx) => (
              <li key={`${rec.titulo}-${idx}`} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f5f3f0] text-[11px] font-extrabold text-[#78716c] tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-[#1c1917]">{rec.titulo}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#78716c]">{rec.detalle}</p>
                  {rec.ahorroMensualCop !== null ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[11px] font-bold text-[#15803d]">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                      Ahorras ~{formatCop(rec.ahorroMensualCop)}/mes
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Things the model could not read confidently */}
      {resultado.advertencias.length > 0 ? (
        <section className="rounded-3xl bg-[#fefce8] p-5">
          <h2 className="text-xs font-bold text-[#a16207]">⚠️ Lo que no quedó claro</h2>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {resultado.advertencias.map((adv, idx) => (
              <li key={idx} className="text-[12px] leading-relaxed text-[#a16207]">
                · {adv}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-[#a8a29e]">
        Análisis informativo, no asesoría financiera certificada.
        {uso ? ` · Costó USD ${uso.costoUsd.toFixed(3)} (${uso.entrada.toLocaleString('es-CO')} tokens de entrada).` : ''}
      </p>
    </div>
  );
};
