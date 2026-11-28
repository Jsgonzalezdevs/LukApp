import React from 'react';
import {
  ShieldAlert,
  Edit2,
  Trash2,
  Plus,
  Search,
  Loader2,
  Eye,
  Sparkles,
  Flame,
  Download,
} from 'lucide-react';
import { type Perfil, type RolPersonalizado } from './tipos';
import { formatearUltimoAcceso } from './formato';
import { type UsuariosAdmin } from './usuarios';
import { descargarUsuariosExcel } from '../exportarUsuarios';

export const PestanaUsuarios: React.FC<{ u: UsuariosAdmin; roles: RolPersonalizado[]; puede: (permiso: string) => boolean; abrirRacha: (perfil: Perfil) => Promise<void> }> = ({ u, roles, puede, abrirRacha }) => {
  const { loadingUsuarios, searchTerm, setSearchTerm, setBorrando, setImpersonando, abrirCrear, abrirEditar, filteredUsuarios } = u;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Usuarios & Acceso</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Administra cuentas, roles y entra en modo asesoría para soporte en vivo.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
        {/* Exporta lo que se ve: si hay búsqueda activa, solo esas filas. */}
        <button
          onClick={() => descargarUsuariosExcel(filteredUsuarios, roles)}
          disabled={loadingUsuarios || filteredUsuarios.length === 0}
          title="Descargar correos y datos de los usuarios en Excel"
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-2.5 text-xs font-bold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar a Excel ({filteredUsuarios.length})
        </button>
        {puede('crear_usuario') && (
          <button
            onClick={abrirCrear}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </button>
        )}
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--fin-line)] p-4 sm:px-6">
          <div className="relative w-full max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--fin-ink-faint)]">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por correo o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border-none bg-[var(--fin-soft)] py-2.5 pl-10 pr-4 text-base sm:text-sm text-[var(--fin-ink)] placeholder-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingUsuarios ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--fin-soft)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <tr>
                  <th className="px-6 py-3.5">Usuario</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5">Registro</th>
                  <th className="px-6 py-3.5">Último acceso</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fin-line)]">
                {filteredUsuarios.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-[var(--fin-soft)]/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold uppercase shadow-inner">
                          {u.email.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--fin-ink)]">{u.usuario || 'Sin nombre'}</p>
                          <p className="text-[11px] text-[var(--fin-ink-soft)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.rol === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                          <ShieldAlert className="h-3 w-3" />
                          Admin
                        </span>
                      ) : u.rol_personalizado_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          <Sparkles className="h-3 w-3" />
                          {roles.find((r) => r.id === u.rol_personalizado_id)?.nombre || 'Desconocido'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                          Usuario
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--fin-ink-soft)]">
                      {new Date(u.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-6 py-4 text-[var(--fin-ink-soft)] whitespace-nowrap">
                      {formatearUltimoAcceso(u.ultimo_acceso_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {puede('impersonar_usuario') && (
                          <button
                            onClick={() => setImpersonando(u)}
                            title={`Ver finanzas como ${u.usuario || u.email}`}
                            className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Asesorar</span>
                          </button>
                        )}
                        {puede('editar_usuario') && (
                          <button
                            onClick={() => void abrirRacha(u)}
                            title="Sumar días de racha"
                            aria-label={`Sumar días de racha a ${u.usuario || u.email}`}
                            className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-orange-500/10 hover:text-orange-600 transition-colors"
                          >
                            <Flame className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {puede('editar_usuario') && (
                          <button
                            onClick={() => abrirEditar(u)}
                            title="Editar usuario"
                            className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {puede('eliminar_usuario') && (
                          <button
                            onClick={() => setBorrando(u)}
                            title="Eliminar usuario"
                            className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
