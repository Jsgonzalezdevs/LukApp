import { ChevronRight } from 'lucide-react';
import { PANELES_AJUSTES, type PanelAjustes } from '../sections';

export const AccesosFunciones = ({ paneles, onAbrir }: { paneles: readonly PanelAjustes[]; onAbrir: (panel: PanelAjustes) => void }) =>
  <div className="grid gap-2 sm:grid-cols-2">{paneles.map((id) => {
    const funcion = PANELES_AJUSTES.find((p) => p.id === id)!;
    return <button key={id} type="button" onClick={() => onAbrir(id)} className="flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-left text-[var(--fin-ink)]">
      <span><span className="block font-semibold">{funcion.label}</span><span className="mt-1 block text-xs text-[var(--fin-ink-soft)]">{funcion.ayuda}</span></span><ChevronRight size={18} aria-hidden="true" />
    </button>;
  })}</div>;
