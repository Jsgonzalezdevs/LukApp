/**
 * Roles personalizados y su formulario.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import React, { useState } from 'react';
import { type RolPersonalizado, type PermisoCatalogo } from './tipos';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';

export const useRolesAdmin = () => {
  // --- Roles personalizados State ---
  const [roles, setRoles] = useState<RolPersonalizado[]>([]);
  const [catalogoPermisos, setCatalogoPermisos] = useState<PermisoCatalogo[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [modalRolAbierto, setModalRolAbierto] = useState(false);
  const [editandoRol, setEditandoRol] = useState<RolPersonalizado | null>(null);
  const [borrandoRol, setBorrandoRol] = useState<RolPersonalizado | null>(null);
  const [nombreRol, setNombreRol] = useState('');
  const [descripcionRol, setDescripcionRol] = useState('');
  const [permisosMarcados, setPermisosMarcados] = useState<Set<string>>(new Set());
  const [rolSubmitting, setRolSubmitting] = useState(false);
  const [rolFormError, setRolFormError] = useState<string | null>(null);

  // 5. Cargar Roles personalizados
  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/roles'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
        setCatalogoPermisos(data.catalogoPermisos || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRoles(false);
    }
  };

  // --- Roles personalizados: crear / editar / eliminar ---

  const abrirCrearRol = () => {
    setEditandoRol(null);
    setNombreRol('');
    setDescripcionRol('');
    setPermisosMarcados(new Set());
    setRolFormError(null);
    setModalRolAbierto(true);
  };

  const abrirEditarRol = (r: RolPersonalizado) => {
    setEditandoRol(r);
    setNombreRol(r.nombre);
    setDescripcionRol(r.descripcion ?? '');
    setPermisosMarcados(new Set(r.permisos));
    setRolFormError(null);
    setModalRolAbierto(true);
  };

  const alternarPermiso = (clave: string) => {
    setPermisosMarcados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  };

  const handleGuardarRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombreRol.trim() === '') {
      setRolFormError('El rol necesita un nombre.');
      return;
    }
    setRolSubmitting(true);
    setRolFormError(null);

    try {
      const token = await tokenSesion();
      const permisos = Array.from(permisosMarcados);

      if (!editandoRol) {
        const res = await fetch(apiUrl('/api/crear-rol'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nombre: nombreRol, descripcion: descripcionRol || null, permisos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear el rol');
      } else {
        const res = await fetch(apiUrl('/api/editar-rol'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editandoRol.id, nombre: nombreRol, descripcion: descripcionRol || null, permisos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al editar el rol');
      }

      setModalRolAbierto(false);
      fetchRoles();
    } catch (err: any) {
      setRolFormError(err.message);
    } finally {
      setRolSubmitting(false);
    }
  };

  const handleEliminarRol = async () => {
    if (!borrandoRol) return;
    setRolSubmitting(true);
    setRolFormError(null);

    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/eliminar-rol'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: borrandoRol.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el rol');

      setBorrandoRol(null);
      fetchRoles();
    } catch (err: any) {
      setRolFormError(err.message);
    } finally {
      setRolSubmitting(false);
    }
  };

  return {
    roles,
    setRoles,
    catalogoPermisos,
    setCatalogoPermisos,
    loadingRoles,
    setLoadingRoles,
    modalRolAbierto,
    setModalRolAbierto,
    editandoRol,
    setEditandoRol,
    borrandoRol,
    setBorrandoRol,
    nombreRol,
    setNombreRol,
    descripcionRol,
    setDescripcionRol,
    permisosMarcados,
    setPermisosMarcados,
    rolSubmitting,
    setRolSubmitting,
    rolFormError,
    setRolFormError,
    fetchRoles,
    abrirCrearRol,
    abrirEditarRol,
    alternarPermiso,
    handleGuardarRol,
    handleEliminarRol,
  };
};

export type RolesAdmin = ReturnType<typeof useRolesAdmin>;
