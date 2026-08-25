import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { Novedad } from '../novedades';

interface NovedadesCardProps {
  novedad: Novedad;
  onCerrar: () => void;
}

/** La tarjeta de "qué cambió" que aparece una sola vez por versión, en
 * Inicio, y se puede volver a cerrar sin que vuelva hasta el próximo
 * lanzamiento real (ver useNovedades en data/usePreferencias.ts). */
export const NovedadesCard: React.FC<NovedadesCardProps> = ({ novedad, onCerrar }) => (
  <div className="mt-5 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 shadow-sm border border-[var(--fin-line)]/50">
    <div className="flex items-start justify-between gap-3">
      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--fin-ink)]">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} aria-hidden="true" />
        Novedades de la {novedad.version}
      </p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
      >
        <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
    <p className="mt-2 text-[14px] leading-relaxed text-[var(--fin-ink-soft)]">{novedad.texto}</p>
  </div>
);
