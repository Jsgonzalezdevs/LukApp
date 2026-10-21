import { useSyncExternalStore } from 'react';

const consulta = '(prefers-reduced-motion: reduce)';

const suscribir = (notificar: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const preferencia = window.matchMedia(consulta);
  if (preferencia.addEventListener) {
    preferencia.addEventListener('change', notificar);
    return () => preferencia.removeEventListener('change', notificar);
  }
  preferencia.addListener?.(notificar);
  return () => preferencia.removeListener?.(notificar);
};

const leerPreferencia = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches;

/** Sigue el ajuste del sistema incluso si cambia mientras LukApp está abierta. */
export const useMovimientoReducido = () =>
  useSyncExternalStore(suscribir, leerPreferencia, () => false);
