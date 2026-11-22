import { useCallback, useEffect, useState } from 'react';
import { obtenerSupabase } from './supabase';
import {
  armarFilasEspacio,
  armarRanking,
  type FilaEspacio,
  type RankingRacha,
} from '../lib/rankingRacha';

export type EstadoCarga = 'cargando' | 'listo' | 'error' | 'sin-conexion';

/**
 * El ranking vive en el servidor: la racha de los demás no se puede calcular
 * desde aquí porque RLS esconde sus movimientos. Sin Supabase (modo local o
 * demo) no hay ranking y se dice así, en vez de inventar uno.
 */
export const useRankingRacha = (alcance: 'global' | 'semana') => {
  const cliente = obtenerSupabase();
  const [estado, setEstado] = useState<EstadoCarga>(cliente ? 'cargando' : 'sin-conexion');
  const [ranking, setRanking] = useState<RankingRacha | null>(null);

  const cargar = useCallback(async () => {
    if (!cliente) return;
    setEstado('cargando');
    try {
      const funcion = alcance === 'semana' ? 'ranking_semanal' : 'ranking_racha';
      const { data, error } = await cliente.rpc(funcion, { limite: 20 });
      if (error) { setEstado('error'); return; }
      setRanking(armarRanking(data ?? []));
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [cliente, alcance]);

  useEffect(() => {
    setRanking(null);
    void cargar();
  }, [cargar]);

  const fijarVisibilidad = useCallback(async (visible: boolean) => {
    if (!cliente) return false;
    const { error } = await cliente.rpc('fijar_visibilidad_ranking', { visible });
    if (error) return false;
    await cargar();
    return true;
  }, [cliente, cargar]);

  return { estado, ranking, recargar: cargar, fijarVisibilidad };
};

export interface RetoEspacio {
  espacioId: string;
  nombre: string;
  icono: string;
  filas: FilaEspacio[];
}

/** La racha de los integrantes de cada espacio compartido al que perteneces. */
export const useRetosEspacios = () => {
  const cliente = obtenerSupabase();
  const [estado, setEstado] = useState<EstadoCarga>(cliente ? 'cargando' : 'sin-conexion');
  const [retos, setRetos] = useState<RetoEspacio[]>([]);

  const cargar = useCallback(async () => {
    if (!cliente) return;
    setEstado('cargando');
    try {
      const { data: sesion } = await cliente.auth.getSession();
      const yo = sesion.session?.user.id;
      if (!yo) { setEstado('sin-conexion'); return; }
      const { data, error } = await cliente
        .from('espacios_integrantes')
        .select('espacio_id, espacios_compartidos(id,nombre,icono)')
        .eq('user_id', yo);
      if (error) { setEstado('error'); return; }
      const espacios = ((data ?? []) as unknown as Array<{
        espacio_id: string;
        espacios_compartidos: { id: string; nombre: string; icono: string } | { id: string; nombre: string; icono: string }[] | null;
      }>).flatMap((f) => {
        const e = Array.isArray(f.espacios_compartidos) ? f.espacios_compartidos[0] : f.espacios_compartidos;
        return e ? [e] : [];
      });
      const resultados = await Promise.all(espacios.map(async (e) => {
        const { data: filas, error: fallo } = await cliente.rpc('ranking_racha_espacio', { p_espacio: e.id });
        if (fallo) throw fallo;
        return { espacioId: e.id, nombre: e.nombre, icono: e.icono, filas: armarFilasEspacio(filas ?? []) };
      }));
      setRetos(resultados);
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [cliente]);

  useEffect(() => { void cargar(); }, [cargar]);

  return { estado, retos, recargar: cargar };
};
