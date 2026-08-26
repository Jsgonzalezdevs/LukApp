/**
 * El único camino real que existe hoy para sentir una vibración de verdad en
 * Safari de iOS (18+): `navigator.vibrate` no existe ahí y Apple nunca lo ha
 * implementado (ver la nota en useHapticFeedback.ts). Pero desde iOS 18 el
 * sistema SÍ le da su haptic nativo a un `<input type="checkbox" switch>`
 * cuando lo toca un click de verdad -- es el mismo golpecito que se siente al
 * activar un switch de Ajustes.
 *
 * Tocarlo POR CÓDIGO desde DENTRO del mismo manejador de clic de un botón
 * cuenta como "el mismo toque" para el navegador (activación transitoria del
 * usuario), así que el switch igual dispara su haptic. Es el mismo mecanismo
 * que usan los polyfills de vibración para iOS (ios-vibrator-pro-max, entre
 * otros) -- la diferencia es que ellos envuelven TODO el `document.body` en
 * un `<label>` con un `MutationObserver` para poder interceptar clics de
 * cualquier parte del código sin saber de antemano dónde. Esta app no
 * necesita eso: cada botón que quiere haptic ya llama a `trigger()`
 * directamente desde su propio `onClick`, así que basta con un único switch
 * escondido y tocarlo ahí mismo -- sin tocar `document.body` ni tener nada
 * observando el DOM todo el tiempo.
 *
 * Limitación real (iOS 18.4+): el navegador exige que sea un clic de verdad
 * -- no sirve desde un `setTimeout`, una respuesta de red, ni un gesto de
 * arrastre -- y la ventana de gracia dura ~1s desde ese clic. Coincide
 * exactamente con cómo se usa `trigger()` en esta app: siempre dentro de un
 * `onClick` real.
 *
 * En cualquier otro navegador (Android, escritorio, iOS viejo) el atributo
 * `switch` no existe: el checkbox se comporta como uno normal, invisible, sin
 * ningún efecto -- `navigator.vibrate` de siempre sigue siendo el camino ahí.
 *
 * Dos detalles que faltaban y que en la práctica hacen que iOS ignore el
 * truco por completo:
 *
 * 1. WebKit solo dibuja el control como switch NATIVO (con su haptic
 *    incluido) cuando el checkbox está asociado a un `<label>` -- suelto, sin
 *    label, algunos iOS lo siguen tratando como checkbox de toda la vida, sin
 *    vibración. Por eso ahora se crea envuelto en su propio `<label>`.
 * 2. Un elemento de 1x1px a veces cae por debajo del tamaño mínimo que iOS
 *    exige para montar el control nativo de verdad (no solo pintarlo). Se
 *    sube a un tamaño de toque normal (24x24) y se sigue ocultando con
 *    `opacity: 0` + posición fuera de pantalla, nunca con `display: none`.
 */

let switchInput: HTMLInputElement | null = null;

const obtenerSwitch = (): HTMLInputElement | null => {
  if (typeof document === 'undefined') return null;
  if (switchInput && document.body.contains(switchInput)) return switchInput;

  const label = document.createElement('label');
  Object.assign(label.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '24px',
    height: '24px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  });
  label.setAttribute('aria-hidden', 'true');

  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  el.tabIndex = -1;

  label.appendChild(el);
  document.body.appendChild(label);
  switchInput = el;
  return el;
};

/** Se llama SIEMPRE desde dentro de un manejador de clic real -- ver el porqué arriba. */
export const pulsarSwitchIOS = (): void => {
  obtenerSwitch()?.click();
};
