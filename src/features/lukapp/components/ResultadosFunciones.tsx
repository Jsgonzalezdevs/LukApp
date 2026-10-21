import { ChevronRight } from 'lucide-react';
import { buscarFunciones } from '../lib/navegacionFunciones';

export const ResultadosFunciones = ({ texto, onAbrir }: { texto: string; onAbrir: (ruta: string) => void }) => {
  const funciones = buscarFunciones(texto);
  if (funciones.length === 0) return null;
  return <section aria-label="Funciones encontradas">
    <h2 className="mb-2 font-semibold text-[var(--fin-ink)]">Funciones de LukApp</h2>
    <ul className="divide-y divide-[var(--fin-line)] rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
      {funciones.map((f) => <li key={f.id}><button type="button" onClick={() => onAbrir(f.ruta)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[var(--fin-ink)]">
        <span><span className="block font-semibold">{f.titulo}</span><span className="mt-1 block text-xs text-[var(--fin-ink-soft)]">{f.seccion === 'dinero' ? 'Dinero' : f.seccion === 'mes' ? 'Mes' : 'Más'} · {f.ayuda}</span></span><ChevronRight size={18} aria-hidden="true" />
      </button></li>)}
    </ul>
  </section>;
};
