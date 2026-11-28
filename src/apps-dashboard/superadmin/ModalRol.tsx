import React from 'react';
import {
  Loader2,
  X,
} from 'lucide-react';
import { type RolesAdmin } from './roles';

export const ModalRol: React.FC<{ r: RolesAdmin }> = ({ r }) => {
  const { catalogoPermisos, setModalRolAbierto, editandoRol, nombreRol, setNombreRol, descripcionRol, setDescripcionRol, permisosMarcados, rolSubmitting, rolFormError, alternarPermiso, handleGuardarRol } = r;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !rolSubmitting && setModalRolAbierto(false)}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <div className="flex items-center justify-between border-b border-[var(--fin-line)] pb-4">
          <h3 className="text-base font-bold text-[var(--fin-ink)]">
            {editandoRol ? 'Editar Rol' : 'Nuevo Rol'}
          </h3>
          <button
            onClick={() => setModalRolAbierto(false)}
            className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleGuardarRol} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Nombre</label>
            <input
              type="text"
              required
              placeholder="Ej: Supervisor"
              value={nombreRol}
              onChange={(e) => setNombreRol(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Descripción (opcional)</label>
            <textarea
              value={descripcionRol}
              onChange={(e) => setDescripcionRol(e.target.value)}
              rows={2}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Permisos</label>
            <div className="mt-1.5 space-y-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] p-3">
              {catalogoPermisos.map((p) => (
                <label key={p.clave} className="flex items-center gap-2.5 py-0.5 text-xs text-[var(--fin-ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permisosMarcados.has(p.clave)}
                    onChange={() => alternarPermiso(p.clave)}
                    className="h-4 w-4 rounded border-[var(--fin-line)] text-purple-600 focus:ring-purple-500"
                  />
                  {p.descripcion}
                </label>
              ))}
            </div>
          </div>

          {rolFormError && (
            <div className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600 dark:text-red-400">
              {rolFormError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalRolAbierto(false)}
              disabled={rolSubmitting}
              className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={rolSubmitting}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
            >
              {rolSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editandoRol ? 'Guardar Cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
