import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  desplazamiento: number;
  progreso: number;
  refrescando: boolean;
}

/**
 * El circulito que aparece empujado desde arriba mientras se jala. Gira con
 * el dedo (progreso 0→1) y, al soltar y disparar `recargar`, se queda dando
 * vueltas solo hasta que la sincronización de verdad termina -- nunca antes,
 * para no prometer que ya se actualizó cuando todavía está en camino.
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  desplazamiento,
  progreso,
  refrescando,
}) => {
  if (desplazamiento <= 0 && !refrescando) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 flex justify-center overflow-hidden"
      style={{ height: desplazamiento, transition: refrescando ? 'height 0.2s ease-out' : 'none' }}
      aria-hidden="true"
    >
      <div className="flex items-end pb-2" style={{ height: desplazamiento }}>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] shadow-[var(--fin-glass-shadow)]"
          style={{ opacity: Math.max(progreso, refrescando ? 1 : 0) }}
        >
          {refrescando ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--fin-accent)]" strokeWidth={2.5} />
          ) : (
            <RefreshCw
              className="h-4 w-4 text-[var(--fin-ink-soft)]"
              strokeWidth={2.5}
              style={{ transform: `rotate(${progreso * 220}deg)` }}
            />
          )}
        </span>
      </div>
    </div>
  );
};
