import { useLayoutEffect } from 'react';

/**
 * How many sheets are open right now. Kept at module scope because two sheets
 * can be stacked — ConfirmSheet opens over the "Más" menu — and the inner one's
 * cleanup must not unlock the page while the outer one is still up.
 */
let abiertos = 0;
/** Where the page was before the first lock, restored when the last one lifts. */
let scrollGuardado = 0;
const propiedades = ['position', 'top', 'left', 'right', 'width', 'overflow'] as const;
let estilosAnteriores: { propiedad: string; valor: string; prioridad: string }[] = [];

/**
 * Freezes the page behind an open sheet.
 *
 * `overflow: hidden` on the body is the usual recipe and iOS ignores it: the
 * drag chains through to the page underneath, which scrolls away behind the
 * sheet and is still there when the sheet closes. Only `position: fixed` really
 * stops it, and that collapses the scroll offset to zero — hence saving and
 * restoring it here, otherwise every sheet would kick the user back to the top
 * of a long list of movements.
 */
export const useBloqueoScroll = (activo: boolean): void => {
  useLayoutEffect(() => {
    if (!activo) return;

    const { body } = document;
    if (abiertos === 0) {
      scrollGuardado = window.scrollY;
      estilosAnteriores = propiedades.map((propiedad) => ({ propiedad, valor: body.style.getPropertyValue(propiedad), prioridad: body.style.getPropertyPriority(propiedad) }));
      body.style.position = 'fixed';
      body.style.top = `-${scrollGuardado}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }
    abiertos += 1;

    return () => {
      abiertos -= 1;
      if (abiertos > 0) return;
      for (const { propiedad, valor, prioridad } of estilosAnteriores) {
        if (valor) body.style.setProperty(propiedad, valor, prioridad);
        else body.style.removeProperty(propiedad);
      }
      const raiz = document.documentElement;
      const comportamiento = raiz.style.getPropertyValue('scroll-behavior');
      const prioridad = raiz.style.getPropertyPriority('scroll-behavior');
      raiz.style.setProperty('scroll-behavior', 'auto', 'important');
      window.scrollTo(0, scrollGuardado);
      if (comportamiento) raiz.style.setProperty('scroll-behavior', comportamiento, prioridad);
      else raiz.style.removeProperty('scroll-behavior');
    };
  }, [activo]);
};
