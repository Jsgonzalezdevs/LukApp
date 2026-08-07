import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Edit2, Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { TemaToggle } from '../features/finanzas/components/TemaToggle';
import type { Tema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';

interface SuperadminPanelProps {
  onBack: () => void;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
}

interface Perfil {
  id: string;
  email: string;
  usuario: string | null;
  rol: 'admin' | 'usuario';
  created_at: string;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ onBack, tema, onCambiarTema }) => {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsuarios = async () => {
      const cliente = obtenerSupabase();
      if (!cliente) return;
      
      const { data, error } = await cliente
        .from('perfiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (data && !error) {
        setUsuarios(data as Perfil[]);
      }
      setLoading(false);
    };
    
    fetchUsuarios();
  }, []);

  const filteredUsuarios = usuarios.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.usuario && u.usuario.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--fin-bg)] text-[var(--fin-ink)] transition-colors duration-300 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4 transition-colors">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Superadmin</h1>
          </div>
        </div>
        
        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:p-10">
        <div className="mx-auto max-w-5xl">
          
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Gestión de Usuarios</h2>
              <p className="mt-2 text-sm text-[var(--fin-ink-soft)]">
                Administra los accesos al ecosistema, roles y permisos.
              </p>
            </div>
            
            <button className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:bg-purple-700 hover:shadow-purple-500/40 hover:-translate-y-0.5">
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </button>
          </div>

          <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm overflow-hidden">
            
            <div className="border-b border-[var(--fin-line)] p-4 sm:px-6 flex items-center justify-between">
               <div className="relative w-full max-w-sm">
                 <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--fin-ink-faint)]">
                   <Search className="h-4 w-4" />
                 </div>
                 <input
                   type="text"
                   placeholder="Buscar por correo o usuario..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="block w-full rounded-xl border-none bg-[var(--fin-soft)] py-2.5 pl-10 pr-4 text-sm text-[var(--fin-ink)] placeholder-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                 />
               </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                 <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                 </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--fin-soft)]/50 text-[11px] font-semibold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Fecha de Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fin-line)]">
                    {filteredUsuarios.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-[var(--fin-soft)]/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-600 dark:text-gray-300 font-bold uppercase shadow-inner">
                              {u.email.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold">{u.usuario || 'Sin nombre'}</p>
                              <p className="text-[12px] text-[var(--fin-ink-soft)]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            u.rol === 'admin' 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                          }`}>
                            {u.rol === 'admin' && <ShieldAlert className="h-3 w-3" />}
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[var(--fin-ink-soft)]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="rounded-lg p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-blue-500" title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button className="rounded-lg p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-red-500" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsuarios.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-[var(--fin-ink-soft)]">
                          No se encontraron usuarios que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
};
