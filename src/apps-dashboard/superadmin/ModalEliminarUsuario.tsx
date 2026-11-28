import React from 'react';
import {
  Loader2,
} from 'lucide-react';
import { type Perfil } from './tipos';
import { type UsuariosAdmin } from './usuarios';

export const ModalEliminarUsuario: React.FC<{ u: UsuariosAdmin; borrando: Perfil }> = ({ u, borrando }) => {
  const { setBorrando, isSubmitting, formError, handleEliminar } = u;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBorrando(null)} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <h3 className="text-base font-bold text-red-600">Eliminar Usuario</h3>
        <p className="mt-2 text-xs text-[var(--fin-ink-soft)] leading-relaxed">
          ¿Estás seguro de eliminar a <span className="font-bold text-[var(--fin-ink)]">{borrando.email}</span>?
          Esta acción no se puede deshacer.
        </p>

        {formError && (
          <div className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{formError}</div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBorrando(null)}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleEliminar}
            disabled={isSubmitting}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};
