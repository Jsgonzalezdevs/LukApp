import React, { useState, useMemo } from 'react';
import { type BarraItem } from './tipos';
import { safeNum } from './formato';

/** Gráfica de barras interactiva unificada con visualización instantánea (0ms espera). */
export const GraficaBarrasUnificada: React.FC<{
  titulo: string;
  subtitulo?: string;
  icono?: React.ReactNode;
  items: BarraItem[];
  vacio: string;
  pieDeGrafica?: React.ReactNode;
}> = ({ titulo, subtitulo, icono, items, vacio, pieDeGrafica }) => {
  const [hovered, setHovered] = useState<BarraItem | null>(null);
  const maxValor = Math.max(...items.map((i) => i.valor), 1);
  const total = items.reduce((acc, i) => acc + i.valor, 0);

  const pico = useMemo(() => {
    if (total === 0) return null;
    return items.reduce((max, i) => (i.valor > max.valor ? i : max), items[0]);
  }, [items, total]);

  const activo = hovered ?? pico;

  return (
    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-sm transition-colors">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icono}
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
              {titulo}
            </h3>
          </div>
          {subtitulo && <p className="text-[10px] text-[var(--fin-ink-faint)] mt-0.5">{subtitulo}</p>}
        </div>

        {/* Resumen instantáneo en vivo sin tener que esperar tooltips */}
        {total > 0 && activo && (
          <div className="flex items-center gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-1.5 transition-all self-start sm:self-auto">
            <span className="text-[10px] font-semibold text-[var(--fin-ink-faint)] uppercase tracking-wider">
              {hovered ? 'Seleccionado:' : 'Pico más alto:'}
            </span>
            <span className="text-xs font-bold text-[var(--fin-ink)]">
              {activo.etiqueta}
            </span>
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
              {safeNum(activo.valor)} {activo.valor === 1 ? 'vista' : 'vistas'}
            </span>
            {activo.secundario !== undefined && activo.secundario > 0 && (
              <span className="text-[10px] text-[var(--fin-ink-soft)] font-medium">
                · {activo.secundario} {activo.secundario === 1 ? 'visitante' : 'visitantes'}
              </span>
            )}
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--fin-ink-faint)]">{vacio}</p>
      ) : (
        <div>
          <div className="flex h-36 items-end gap-[3px] sm:gap-1.5 pt-7 pb-1">
            {items.map((item) => {
              const esHover = hovered?.id === item.id;
              const esPico = !hovered && pico?.id === item.id && item.valor > 0;
              const destacado = esHover || esPico;
              const porcentaje = Math.max((item.valor / maxValor) * 100, item.valor > 0 ? 8 : 3);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setHovered(item)}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer select-none"
                >
                  {/* Tooltip flotante instantáneo (0ms de retraso) */}
                  <div
                    className={`pointer-events-none absolute -top-8 z-30 whitespace-nowrap rounded-lg bg-[var(--fin-ink)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-bg)] shadow-xl transition-all duration-150 ${
                      esHover ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    }`}
                  >
                    {item.etiqueta}: {item.valor} vistas
                    <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-[var(--fin-ink)]" />
                  </div>

                  {/* Barra única y consistente */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      destacado
                        ? 'bg-sky-400'
                        : item.valor > 0
                        ? 'bg-sky-500/80 hover:bg-sky-400'
                        : 'bg-[var(--fin-soft)]/60 hover:bg-[var(--fin-soft)]'
                    }`}
                    style={{ height: `${porcentaje}%` }}
                  />
                </div>
              );
            })}
          </div>

          {pieDeGrafica}
        </div>
      )}
    </div>
  );
};
