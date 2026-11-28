import React from 'react';
import {
  Loader2,
} from 'lucide-react';
import { type RolPersonalizado } from './tipos';
import { type RolesAdmin } from './roles';

export const ModalEliminarRol: React.FC<{ r: RolesAdmin; borrandoRol: RolPersonalizado }> = ({ r, borrandoRol }) => {
  const { setBorrandoRol, rolSubmitting, rolFormError, handleEliminarRol } = r;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBorrandoRol(null)} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <h3 className="text-base font-bold text-red-600">Eliminar Rol</h3>
        <p className="mt-2 text-xs text-[var(--fin-ink-soft)] leading-relaxed">
          ¿Eliminar el rol <span className="font-bold text-[var(--fin-ink)]">{borrandoRol.nombre}</span>?
          Quien lo tenga asignado se queda sin ese rol — vuelve a comportarse como usuario normal, sin
          ninguno de estos permisos.
        </p>

        {rolFormError && (
          <div className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{rolFormError}</div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBorrandoRol(null)}
            disabled={rolSubmitting}
            className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleEliminarRol}
            disabled={rolSubmitting}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            {rolSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};
