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
  const inicioXRef = useRef<number | null>(null);
  const inicioYRef = useRef<number | null>(null);
  const arrastrandoRef = useRef(false);
  const esGestoHorizontalRef = useRef(false);
  const onRefrescarRef = useRef(onRefrescar);
  onRefrescarRef.current = onRefrescar;

  const enElTope = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

  const alEmpezar = useCallback((e: TouchEvent) => {
    if (!enabled || !enElTope() || refrescando) {
      inicioXRef.current = null;
      inicioYRef.current = null;
      esGestoHorizontalRef.current = false;
      return;
    }
    const touch = e.touches[0];
    inicioXRef.current = touch.clientX;
    inicioYRef.current = touch.clientY;
    arrastrandoRef.current = false;
    esGestoHorizontalRef.current = false;

    // Detectar si el toque empezó en un carrusel u objeto con scroll horizontal
    const target = e.target as HTMLElement | null;
    if (target?.closest('.overflow-x-auto, [data-scroll-horizontal], [data-no-pull-refresh]')) {
      esGestoHorizontalRef.current = true;
    }
  }, [enabled, refrescando]);

  const alMover = useCallback((e: TouchEvent) => {
    if (!enabled || inicioYRef.current === null || inicioXRef.current === null || esGestoHorizontalRef.current) {
      return;
    }
    const touch = e.touches[0];
    const deltaX = touch.clientX - inicioXRef.current;
    const deltaY = touch.clientY - inicioYRef.current;

    // Si el usuario se está moviendo hacia los lados, es un scroll horizontal (carrusel o pestañas)
    if (Math.abs(deltaX) > Math.abs(deltaY) || Math.abs(deltaX) > 12) {
      if (!arrastrandoRef.current) {
        esGestoHorizontalRef.current = true;
        setDesplazamiento(0);
        return;
      }
    }

    if (deltaY <= 0) {
      // Volvió a subir o nunca bajó: no es este gesto, se lo dejamos al scroll normal.
      setDesplazamiento(0);
      arrastrandoRef.current = false;
      return;
    }

    // Exigir que sea un gesto claramente vertical hacia abajo
    if (deltaY < Math.abs(deltaX) * 1.5) {
      if (!arrastrandoRef.current) {
        setDesplazamiento(0);
        return;
      }
    }

    if (!enElTope()) {
      // Ya se desplazó la página durante el gesto: se cancela, no se sigue "jalando".
      inicioYRef.current = null;
      inicioXRef.current = null;
      setDesplazamiento(0);
      return;
    }
    arrastrandoRef.current = true;
    // preventDefault evita que el navegador dispare SU propio pull-to-refresh
    // nativo (recargar la página entera) mientras se estira este.
    e.preventDefault();
    setDesplazamiento(Math.min(TOPE_PX, deltaY * RESISTENCIA));
  }, [enabled]);

  const alSoltar = useCallback(() => {
    inicioXRef.current = null;
    esGestoHorizontalRef.current = false;
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
