import React from 'react';
import {
  Loader2,
  X,
} from 'lucide-react';
import { type RolPersonalizado } from './tipos';
import { type UsuariosAdmin } from './usuarios';
import { SelectorApp } from '../../features/lukapp/components/SelectorApp';

export const ModalUsuario: React.FC<{ u: UsuariosAdmin; rol: 'admin' | 'usuario'; roles: RolPersonalizado[] }> = ({ u, rol, roles }) => {
  const { setIsModalOpen, editando, isSubmitting, formError, nuevoEmail, setNuevoEmail, nuevoUsuario, setNuevoUsuario, nuevaPassword, setNuevaPassword, nuevoRol, setNuevoRol, nuevoRolPersonalizadoId, setNuevoRolPersonalizadoId, editaSoloRolPropio, handleSubmit } = u;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isSubmitting && setIsModalOpen(false)}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
        <div className="flex items-center justify-between border-b border-[var(--fin-line)] pb-4">
          <h3 className="text-base font-bold text-[var(--fin-ink)]">
            {editando ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!editaSoloRolPropio && <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Correo Electrónico</label>
            <input
              type="email"
              required
              value={nuevoEmail}
              onChange={(e) => setNuevoEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
            />
          </div>}

          {!editaSoloRolPropio && <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Nombre / Usuario</label>
            <input
              type="text"
              value={nuevoUsuario}
              onChange={(e) => setNuevoUsuario(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
            />
          </div>}

          {!editaSoloRolPropio && <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">
              {editando ? 'Nueva Contraseña (dejar en blanco para conservar)' : 'Contraseña'}
            </label>
            <input
              type="password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder={nuevoRol === 'admin' ? 'La contraseña que quieras' : editando ? '••••••••' : 'Mínimo 6 caracteres'}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
            />
          </div>}
          {!editaSoloRolPropio && <p className="-mt-2 text-[11px] text-[var(--fin-ink-faint)]">
            {nuevoRol === 'admin'
              ? 'Las cuentas Superadmin pueden usar la contraseña que quieras. Esta excepción no aplica a usuarios normales.'
              : 'Mínimo 6 caracteres, con mayúscula, minúscula y un carácter especial. No puede coincidir con usuario ni correo.'}
          </p>}

          {editaSoloRolPropio && <p className="rounded-xl bg-amber-500/10 p-3 text-xs font-medium text-[var(--fin-ink-soft)]">
            Esta es tu propia cuenta: desde Superadmin solo puedes cambiar su rol.
          </p>}

          <div>
            <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Rol</label>
            <SelectorApp
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value as 'admin' | 'usuario')}
              className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
            >
              <option value="usuario">Usuario Normal</option>
              <option value="admin">Superadmin</option>
            </SelectorApp>
            {nuevoRol === 'admin' && (
              <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Tendrá acceso total a Superadmin. Úsalo solo para personas de confianza.
              </p>
            )}
          </div>

          {/* Solo admin gestiona la asignación de roles personalizados
              (ver la pestaña Roles), y solo tiene sentido si el usuario no
              es ya Superadmin — 'admin' tiene acceso total de por sí. */}
          {rol === 'admin' && editando && !editaSoloRolPropio && (
            <div>
              <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Rol personalizado</label>
              <SelectorApp
                value={nuevoRolPersonalizadoId}
                onChange={(e) => setNuevoRolPersonalizadoId(e.target.value)}
                disabled={nuevoRol === 'admin'}
                className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">Ninguno</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </SelectorApp>
              {nuevoRol === 'admin' && (
                <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
                  Superadmin ya tiene acceso total; un rol personalizado no le añade nada.
                </p>
              )}
            </div>
          )}

          {formError && (
            <div className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? 'Guardar Cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
