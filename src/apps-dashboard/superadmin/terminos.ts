/**
 * Términos y condiciones que publica el superadmin fijo.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import { useState, useRef } from 'react';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';

export const useTerminosAdmin = (rol: 'admin' | 'usuario') => {
  // Solo superadmin fijo puede publicar el documento que ve toda la app.
  const [terminos, setTerminos] = useState('');
  const [terminosActualizadosEn, setTerminosActualizadosEn] = useState<string | null>(null);
  const [cargandoTerminos, setCargandoTerminos] = useState(false);
  const [guardandoTerminos, setGuardandoTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState<string | null>(null);
  const [mensajeTerminos, setMensajeTerminos] = useState<string | null>(null);
  const terminosBaseRef = useRef<HTMLDivElement>(null);

  const cargarTerminos = async () => {
    if (rol !== 'admin') return;
    setCargandoTerminos(true);
    setErrorTerminos(null);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/superadmin/legal/terminos'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los términos.');
      const contenidoActual = typeof data.contenido === 'string' && data.contenido.trim()
        ? data.contenido
        : terminosBaseRef.current?.innerText.trim() ?? '';
      setTerminos(contenidoActual);
      setTerminosActualizadosEn(data.actualizadoEn || null);
    } catch (error: any) {
      setErrorTerminos(error.message || 'No se pudieron cargar los términos.');
    } finally {
      setCargandoTerminos(false);
    }
  };

  const publicarTerminos = async () => {
    setErrorTerminos(null);
    setMensajeTerminos(null);
    setGuardandoTerminos(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/superadmin/legal/terminos'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: terminos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron publicar los términos.');
      setTerminos(data.contenido);
      setTerminosActualizadosEn(data.actualizadoEn);
      setMensajeTerminos('Los términos y condiciones ya están publicados.');
    } catch (error: any) {
      setErrorTerminos(error.message || 'No se pudieron publicar los términos.');
    } finally {
      setGuardandoTerminos(false);
    }
  };

  return {
    terminos,
    setTerminos,
    terminosActualizadosEn,
    setTerminosActualizadosEn,
    cargandoTerminos,
    setCargandoTerminos,
    guardandoTerminos,
    setGuardandoTerminos,
    errorTerminos,
    setErrorTerminos,
    mensajeTerminos,
    setMensajeTerminos,
    terminosBaseRef,
    cargarTerminos,
    publicarTerminos,
  };
};

export type TerminosAdmin = ReturnType<typeof useTerminosAdmin>;
