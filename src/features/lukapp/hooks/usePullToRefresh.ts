import { useCallback, useEffect, useRef, useState } from 'react';

const UMBRAL_PX = 70;
/** Tope de cuánto se deja estirar el dedo, para que no se sienta un chicle infinito. */
const TOPE_PX = 110;
/** Cuánto se resiste el arrastre según baja el dedo -- 1 = sigue al dedo 1:1, 0 = no se mueve nada. */
const RESISTENCIA = 0.45;

export interface UsePullToRefresh {
  /** 0 a 1: qué tan cerca está de soltar y disparar el refresco. */
  progreso: number;
  /** Cuánto bajar visualmente el indicador, en px. */
  desplazamiento: number;
  refrescando: boolean;
}

/**
 * "Jalar para refrescar" sobre el scroll de la VENTANA -- esta app no tiene
 * contenedores propios con su scroll (ver el comentario en LukAppApp.tsx),
 * así que el gesto se engancha a `window`/`document`, no a un `<div>` con
 * `overflow-y-auto` como en la receta de siempre.
 *
 * Solo arranca a medir cuando el dedo baja con el scroll YA en el tope (si no,
 * sería imposible bajar a leer un movimiento de más arriba sin disparar un
 * refresco). Cada arrastre nuevo revisa el scroll de nuevo, así que si la
 * persona se desplaza hacia abajo a mitad de gesto, se cancela solo.
 */
export const usePullToRefresh = (
  onRefrescar: () => Promise<void> | void,
  enabled: boolean = true,
): UsePullToRefresh => {
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const inicioYRef = useRef<number | null>(null);
  const arrastrandoRef = useRef(false);
  const onRefrescarRef = useRef(onRefrescar);
  onRefrescarRef.current = onRefrescar;

  const enElTope = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

  const alEmpezar = useCallback((e: TouchEvent) => {
    if (!enabled || !enElTope() || refrescando) {
      inicioYRef.current = null;
      return;
    }
    inicioYRef.current = e.touches[0].clientY;
    arrastrandoRef.current = false;
  }, [enabled, refrescando]);

  const alMover = useCallback((e: TouchEvent) => {
    if (!enabled || inicioYRef.current === null) return;
    const delta = e.touches[0].clientY - inicioYRef.current;
    if (delta <= 0) {
      // Volvió a subir o nunca bajó: no es este gesto, se lo dejamos al scroll normal.
      setDesplazamiento(0);
      arrastrandoRef.current = false;
      return;
    }
    if (!enElTope()) {
      // Ya se desplazó la página durante el gesto: se cancela, no se sigue "jalando".
      inicioYRef.current = null;
      setDesplazamiento(0);
      return;
    }
    arrastrandoRef.current = true;
    // preventDefault evita que el navegador dispare SU propio pull-to-refresh
    // nativo (recargar la página entera) mientras se estira este.
    e.preventDefault();
    setDesplazamiento(Math.min(TOPE_PX, delta * RESISTENCIA));
  }, [enabled]);

  const alSoltar = useCallback(() => {
    if (!arrastrandoRef.current) {
      inicioYRef.current = null;
      return;
    }
    arrastrandoRef.current = false;
    inicioYRef.current = null;
    setDesplazamiento((actual) => {
      if (actual >= UMBRAL_PX) {
        setRefrescando(true);
        void Promise.resolve(onRefrescarRef.current()).finally(() => {
          setRefrescando(false);
        });
      }
      return 0;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDesplazamiento(0);
      setRefrescando(false);
      inicioYRef.current = null;
      arrastrandoRef.current = false;
      return;
    }

    window.addEventListener('touchstart', alEmpezar, { passive: true });
    window.addEventListener('touchmove', alMover, { passive: false });
    window.addEventListener('touchend', alSoltar, { passive: true });
    window.addEventListener('touchcancel', alSoltar, { passive: true });
    return () => {
      window.removeEventListener('touchstart', alEmpezar);
      window.removeEventListener('touchmove', alMover);
      window.removeEventListener('touchend', alSoltar);
      window.removeEventListener('touchcancel', alSoltar);
    };
  }, [enabled, alEmpezar, alMover, alSoltar]);

  return {
    progreso: Math.min(1, desplazamiento / UMBRAL_PX),
    desplazamiento: refrescando ? UMBRAL_PX : desplazamiento,
    refrescando,
  };
};
