import { obtenerSupabase } from '../data/supabase';

const LLAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();

const base64UrlABytes = (valor: string): ArrayBuffer => {
  const normalizado = `${valor}${'='.repeat((4 - (valor.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(normalizado), (caracter) => caracter.charCodeAt(0));
  const resultado = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(resultado).set(bytes);
  return resultado;
};

/** Suscribe este aparato para recibir recordatorios aun con LukApp cerrada. */
export const activarNotificacionesPush = async (): Promise<boolean> => {
  if (!LLAVE_VAPID || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const cliente = obtenerSupabase();
  if (!cliente) return false;
  const sesion = await cliente.auth.getSession();
  if (!sesion.data.session) return false;
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(LLAVE_VAPID) });
  const { error } = await cliente.from('suscripciones_push').upsert({
    user_id: sesion.data.session.user.id, endpoint: suscripcion.endpoint, suscripcion: suscripcion.toJSON(),
  }, { onConflict: 'user_id,endpoint' });
  return !error;
};

export const desactivarNotificacionesPush = async (): Promise<void> => {
  const cliente = obtenerSupabase();
  if (!cliente || !('serviceWorker' in navigator)) return;
  const sesion = await cliente.auth.getSession();
  const suscripcion = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sesion.data.session || !suscripcion) return;
  await cliente.from('suscripciones_push').delete().eq('user_id', sesion.data.session.user.id).eq('endpoint', suscripcion.endpoint);
  await suscripcion.unsubscribe();
};
