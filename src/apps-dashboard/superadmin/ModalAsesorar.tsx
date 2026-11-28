import React from 'react';
import {
  Loader2,
  AlertTriangle,
  Eye,
  LogIn,
} from 'lucide-react';
import { type Perfil } from './tipos';
import { type UsuariosAdmin } from './usuarios';

export const ModalAsesorar: React.FC<{ u: UsuariosAdmin; impersonando: Perfil }> = ({ u, impersonando }) => {
  const { formError, setImpersonando, impersonacionCargando, handleImpersonar } = u;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !impersonacionCargando && setImpersonando(null)}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 font-bold">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--fin-ink)]">Iniciar Modo Asesoría</h3>
            <p className="text-xs text-[var(--fin-ink-soft)]">Acceso temporal directo a la cuenta del usuario</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-soft)] p-3.5 mb-4 text-xs">
          <p className="font-bold text-[var(--fin-ink)]">{impersonando.usuario || 'Sin nombre'}</p>
          <p className="text-[11px] text-[var(--fin-ink-soft)]">{impersonando.email}</p>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p>Tu sesión de admin quedará respaldada. Podrás volver a tu cuenta en cualquier momento con el botón superior.</p>
        </div>

        {formError && (
          <div className="mb-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{formError}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setImpersonando(null)}
            disabled={impersonacionCargando}
            className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleImpersonar}
            disabled={impersonacionCargando}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-600"
          >
            {impersonacionCargando ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Entrando...</>
            ) : (
              <><LogIn className="h-3.5 w-3.5" /> Entrar como {impersonando.usuario || impersonando.email}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
