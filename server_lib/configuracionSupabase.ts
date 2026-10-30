/** La URL dedicada del servidor tiene prioridad sobre la variable de Vite.
 * Render puede conservar VITE_SUPABASE_URL de un frontend anterior, mientras
 * SUPABASE_URL apunta al proyecto que la app usa actualmente. */
export const urlSupabaseDelServidor = (
  entorno: { SUPABASE_URL?: string; VITE_SUPABASE_URL?: string },
): string | null => {
  const urlServidor = entorno.SUPABASE_URL?.trim();
  if (urlServidor) return urlServidor;
  const urlFrontend = entorno.VITE_SUPABASE_URL?.trim();
  return urlFrontend || null;
};
