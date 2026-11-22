import { useEffect, useState } from 'react';
import { obtenerSupabase } from './supabase';
import type { BonoRacha } from '../lib/racha';

const SIN_BONOS: readonly BonoRacha[] = [];

/**
 * Los días de racha que el equipo le sumó a esta persona desde el superadmin.
 * Si la tabla aún no existe o no hay red, la racha se calcula solo con los
 * movimientos: es un extra, nunca algo que deba bloquear la pantalla.
 */
export const useBonosRacha = (userId: string | null): readonly BonoRacha[] => {
  const [bonos, setBonos] = useState<readonly BonoRacha[]>(SIN_BONOS);

  useEffect(() => {
    setBonos(SIN_BONOS);
    const cliente = obtenerSupabase();
    if (!cliente || !userId || userId === 'usuario-local-pruebas') return undefined;

    let vigente = true;
    void cliente
      .from('racha_bonos')
      .select('inicio_racha, dias')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!vigente || error || !data) return;
        setBonos(data.map((fila) => ({ inicioRacha: String(fila.inicio_racha), dias: Number(fila.dias) })));
      });
    return () => { vigente = false; };
  }, [userId]);

  return bonos;
};
