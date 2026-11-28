/**
 * Usuarios: lista, búsqueda, formulario de crear/editar, eliminar y modo asesoría.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import React, { useState } from 'react';
import { type Perfil } from './tipos';
import { tokenSesion } from './sesion';
import { obtenerSupabase } from '../../features/lukapp/data/supabase';
import { apiUrl } from '../../lib/api';
import { validarContrasenaSegura } from '../../lib/seguridad';

export const useUsuariosAdmin = ({ onIniciarAsesoria, onNavigateTo }: { onIniciarAsesoria?: () => void; onNavigateTo?: (app: string) => void }) => {
  // --- Usuarios State ---
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [borrando, setBorrando] = useState<Perfil | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<'admin' | 'usuario'>('usuario');
  // '' = sin rol personalizado. Solo importa cuando nuevoRol === 'usuario';
  // si es 'admin' el selector queda deshabilitado, ya tiene todo.
  const [nuevoRolPersonalizadoId, setNuevoRolPersonalizadoId] = useState<string>('');

  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null);

  // Impersonation
  const [impersonando, setImpersonando] = useState<Perfil | null>(null);
  const [impersonacionCargando, setImpersonacionCargando] = useState(false);

  const editaSoloRolPropio = editando?.id === usuarioActualId;

  // 1. Cargar Usuarios
  const fetchUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl('/api/superadmin/usuarios'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error || 'No se pudieron cargar los usuarios.');
      setUsuarios(data.usuarios as Perfil[]);
    } catch (error) {
      console.error('Error cargando usuarios del superadmin:', error);
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const abrirCrear = () => {
    setEditando(null);
    setNuevoEmail('');
    setNuevoUsuario('');
    setNuevaPassword('');
    setNuevoRol('usuario');
    setNuevoRolPersonalizadoId('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const abrirEditar = (perfil: Perfil) => {
    setEditando(perfil);
    setNuevoEmail(perfil.email);
    setNuevoUsuario(perfil.usuario ?? '');
    setNuevaPassword('');
    setNuevoRol(perfil.rol);
    setNuevoRolPersonalizadoId(perfil.rol_personalizado_id ?? '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImpersonar = async () => {
    if (!impersonando) return;
    setImpersonacionCargando(true);
    setFormError(null);
    try {
      const cliente = obtenerSupabase();
      if (!cliente) throw new Error('No hay cliente Supabase');

      const {
        data: { session: adminSession },
      } = await cliente.auth.getSession();
      if (!adminSession) throw new Error('No hay sesión activa');

      sessionStorage.setItem(
        '__admin_session_backup__',
        JSON.stringify({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
          usuario: adminSession.user.user_metadata?.usuario || adminSession.user.email,
          email: adminSession.user.email,
        }),
      );

      const res = await fetch(apiUrl('/api/impersonar-usuario'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ userId: impersonando.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.tokenHash) {
        throw new Error(data.error || 'No se pudo generar el acceso al usuario');
      }

      const { error: otpError } = await cliente.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      });

      if (otpError) throw otpError;

      sessionStorage.setItem(
        '__impersonated_user__',
        JSON.stringify({
          usuario: impersonando.usuario,
          email: impersonando.email,
        }),
      );

      onIniciarAsesoria?.();
      setImpersonando(null);
      onNavigateTo?.('finanzas');
    } catch (err: any) {
      setFormError(err.message);
      sessionStorage.removeItem('__admin_session_backup__');
    } finally {
      setImpersonacionCargando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const token = await tokenSesion();

      if (!editando) {
        if (!nuevoEmail || !nuevaPassword) throw new Error('Correo y contraseña son obligatorios');
        if (nuevoRol !== 'admin') {
          const errorPassword = validarContrasenaSegura(nuevaPassword, [nuevoUsuario, nuevoEmail]);
          if (errorPassword) throw new Error(errorPassword);
        }

        const res = await fetch(apiUrl('/api/crear-usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: nuevoEmail,
            usuario: nuevoUsuario || undefined,
            password: nuevaPassword,
            rol: nuevoRol,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      } else {
        const payload: Record<string, unknown> = { userId: editando.id };
        if (nuevoEmail !== editando.email) payload.email = nuevoEmail;
        if (nuevoUsuario !== (editando.usuario ?? '')) payload.usuario = nuevoUsuario;
        if (nuevaPassword.trim() !== '') {
          if (nuevoRol !== 'admin') {
            const errorPassword = validarContrasenaSegura(nuevaPassword, [nuevoUsuario, nuevoEmail]);
            if (errorPassword) throw new Error(errorPassword);
          }
          payload.password = nuevaPassword;
        }
        if (nuevoRol !== editando.rol) payload.rol = nuevoRol;
        // '' en el selector significa "sin rol personalizado" -> null. Solo
        // se manda si de verdad cambió, igual que los demás campos.
        const rolPersonalizadoActual = editando.rol_personalizado_id ?? '';
        if (nuevoRolPersonalizadoId !== rolPersonalizadoActual) {
          payload.rolPersonalizadoId = nuevoRolPersonalizadoId === '' ? null : nuevoRolPersonalizadoId;
        }

        if (Object.keys(payload).length === 1) {
          setIsModalOpen(false);
          return;
        }

        const res = await fetch(apiUrl('/api/editar-usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al editar usuario');
      }

      setIsModalOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminar = async () => {
    if (!borrando) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/eliminar-usuario'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: borrando.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

      setBorrando(null);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.usuario && u.usuario.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return {
    usuarios,
    setUsuarios,
    loadingUsuarios,
    setLoadingUsuarios,
    searchTerm,
    setSearchTerm,
    isModalOpen,
    setIsModalOpen,
    editando,
    setEditando,
    borrando,
    setBorrando,
    isSubmitting,
    setIsSubmitting,
    formError,
    setFormError,
    nuevoEmail,
    setNuevoEmail,
    nuevoUsuario,
    setNuevoUsuario,
    nuevaPassword,
    setNuevaPassword,
    nuevoRol,
    setNuevoRol,
    nuevoRolPersonalizadoId,
    setNuevoRolPersonalizadoId,
    usuarioActualId,
    setUsuarioActualId,
    impersonando,
    setImpersonando,
    impersonacionCargando,
    setImpersonacionCargando,
    editaSoloRolPropio,
    fetchUsuarios,
    abrirCrear,
    abrirEditar,
    handleImpersonar,
    handleSubmit,
    handleEliminar,
    filteredUsuarios,
  };
};

export type UsuariosAdmin = ReturnType<typeof useUsuariosAdmin>;
