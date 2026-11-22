import { useEffect, useState } from 'react';
import { obtenerSupabase } from './supabase';

const SIN_DIAS: readonly string[] = [];

/**
 * Los días de racha que el equipo le sumó a esta persona desde el superadmin.
 * Si la tabla aún no existe o no hay red, la racha se calcula solo con los
 * movimientos: es un extra, nunca algo que deba bloquear la pantalla.
 */
export const useDiasRegaladosRacha = (userId: string | null): readonly string[] => {
  const [dias, setDias] = useState<readonly string[]>(SIN_DIAS);

  useEffect(() => {
    setDias(SIN_DIAS);
    const cliente = obtenerSupabase();
    if (!cliente || !userId || userId === 'usuario-local-pruebas') return undefined;

    let vigente = true;
    void cliente
      .from('racha_dias_regalados')
      .select('fecha')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!vigente || error || !data) return;
        setDias(data.map((fila) => String(fila.fecha)));
      });
    return () => { vigente = false; };
  }, [userId]);

  return dias;
};
