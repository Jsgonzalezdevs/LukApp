/**
 * Token de la sesión del admin para firmar cada llamada a la API.
 */
import { obtenerSupabase } from '../../features/lukapp/data/supabase';

export const tokenSesion = async (): Promise<string> => {
  const cliente = obtenerSupabase();
  const {
    data: { session },
  } = await cliente!.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');
  return session.access_token;
};
