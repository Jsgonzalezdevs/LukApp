import React from 'react';
import {
  ShieldAlert,
  Edit2,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';
import { type RolesAdmin } from './roles';

export const PestanaRoles: React.FC<{ r: RolesAdmin }> = ({ r }) => {
  const { roles, catalogoPermisos, loadingRoles, setBorrandoRol, abrirCrearRol, abrirEditarRol } = r;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Roles personalizados</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Crea roles con exactamente los permisos que necesitas — 'admin' se queda fijo, con acceso
            total, y no aparece aquí.
          </p>
        </div>

        <button
          onClick={abrirCrearRol}
          className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Rol
        </button>
      </div>

      <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm overflow-hidden">
        {loadingRoles ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
          </div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <ShieldAlert className="h-8 w-8 text-[var(--fin-ink-faint)]" />
            <p className="text-sm font-bold text-[var(--fin-ink-soft)]">Todavía no hay roles personalizados.</p>
            <p className="text-xs text-[var(--fin-ink-faint)]">
              Créa uno y asígnalo desde "Editar usuario" en la pestaña de Usuarios.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--fin-line)]">
            {roles.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--fin-ink)]">{r.nombre}</p>
                  {r.descripcion && (
                    <p className="mt-0.5 text-xs text-[var(--fin-ink-soft)]">{r.descripcion}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.permisos.length === 0 ? (
                      <span className="text-[11px] text-[var(--fin-ink-faint)]">Sin permisos marcados</span>
                    ) : (
                      r.permisos.map((p) => (
                        <span
                          key={p}
                          className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                        >
                          {catalogoPermisos.find((c) => c.clave === p)?.descripcion || p}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => abrirEditarRol(r)}
                    title="Editar rol"
                    className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setBorrandoRol(r)}
                    title="Eliminar rol"
                    className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
