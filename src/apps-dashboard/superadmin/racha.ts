/**
 * Racha regalada: el modal que suma o quita días a una persona.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import { useState } from 'react';
import { type Perfil } from './tipos';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';
import type { EstadoRacha } from '../superadmin.types';

export const useRachaAdmin = () => {
  // --- Racha regalada ---
  const [rachaDe, setRachaDe] = useState<Perfil | null>(null);
  const [estadoRacha, setEstadoRacha] = useState<EstadoRacha | null>(null);
  const [diasASumar, setDiasASumar] = useState('1');
  const [rachaCargando, setRachaCargando] = useState(false);
  const [rachaError, setRachaError] = useState<string | null>(null);

  const abrirRacha = async (perfil: Perfil) => {
    setRachaDe(perfil);
    setEstadoRacha(null);
    setDiasASumar('1');
    setRachaError(null);
    setRachaCargando(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl(`/api/superadmin/racha?userId=${encodeURIComponent(perfil.id)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo leer la racha');
      setEstadoRacha(data);
    } catch (err: any) {
      setRachaError(err.message);
    } finally {
      setRachaCargando(false);
    }
  };

  const cambiarRacha = async (accion: 'sumar' | 'quitar') => {
    if (!rachaDe) return;
    const dias = Number(diasASumar);
    if (accion === 'sumar' && (!Number.isInteger(dias) || dias < 1 || dias > 365)) {
      setRachaError('Escribe cuántos días sumar, de 1 a 365.');
      return;
    }
    setRachaCargando(true);
    setRachaError(null);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/superadmin/racha'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: rachaDe.id, accion, dias }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la racha');
      setEstadoRacha(data);
    } catch (err: any) {
      setRachaError(err.message);
    } finally {
      setRachaCargando(false);
    }
  };

  return {
    rachaDe,
    setRachaDe,
    estadoRacha,
    setEstadoRacha,
    diasASumar,
    setDiasASumar,
    rachaCargando,
    setRachaCargando,
    rachaError,
    setRachaError,
    abrirRacha,
    cambiarRacha,
  };
};

export type RachaAdmin = ReturnType<typeof useRachaAdmin>;
