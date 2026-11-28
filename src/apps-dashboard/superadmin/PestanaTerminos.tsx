import React from 'react';
import {
  Loader2,
  FileText,
} from 'lucide-react';
import { type TerminosAdmin } from './terminos';
import { TerminosCondiciones } from '../../features/lukapp/components/LegalLukApp';

export const PestanaTerminos: React.FC<{ t: TerminosAdmin }> = ({ t }) => {
  const { terminos, setTerminos, terminosActualizadosEn, cargandoTerminos, guardandoTerminos, errorTerminos, mensajeTerminos, terminosBaseRef, publicarTerminos } = t;

  return (
    <section className="mx-auto max-w-4xl rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm sm:p-7">
      <div ref={terminosBaseRef} aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0">
        <TerminosCondiciones />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Términos y condiciones</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--fin-ink-soft)]">
            Publica la versión vigente sin despliegues. Se muestra de inmediato en la página legal de LukApp.
          </p>
        </div>
        {terminosActualizadosEn && (
          <p className="text-xs text-[var(--fin-ink-faint)]">Publicado: {new Date(terminosActualizadosEn).toLocaleString('es-CO')}</p>
        )}
      </div>

      {!terminosActualizadosEn && !cargandoTerminos && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--fin-ink-soft)]">
          Aún se muestra la versión legal incluida con LukApp. Al publicar este texto, esta será la versión visible para todas las personas.
        </div>
      )}

      <label className="mt-6 block text-xs font-bold text-[var(--fin-ink-soft)]" htmlFor="terminos-contenido">Contenido publicado</label>
      <textarea
        id="terminos-contenido"
        value={terminos}
        onChange={(event) => setTerminos(event.target.value)}
        disabled={cargandoTerminos || guardandoTerminos}
        placeholder="Escribe o pega aquí los términos y condiciones completos. Se conservarán los saltos de línea."
        className="mt-2 min-h-96 w-full rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-soft)] p-4 text-base leading-6 text-[var(--fin-ink)] outline-none transition focus:border-purple-500 disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-[var(--fin-ink-faint)]">{terminos.length.toLocaleString('es-CO')} / 120.000 caracteres</p>
      {errorTerminos && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm font-semibold text-red-600 dark:text-red-400">{errorTerminos}</p>}
      {mensajeTerminos && <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{mensajeTerminos}</p>}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={publicarTerminos}
          disabled={cargandoTerminos || guardandoTerminos}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardandoTerminos ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Guardar y publicar
        </button>
      </div>
    </section>
  );
};
