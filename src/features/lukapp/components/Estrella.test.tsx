import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Estrella } from './Estrella';

/* Lo que se comprueba aquí es la geometría y la accesibilidad, no el
   movimiento: el parpadeo y el balanceo los pinta framer-motion contra
   requestAnimationFrame, que en jsdom no avanza, así que afirmarlos sería
   afirmar el mock y no el componente. */

const caraDe = (): HTMLImageElement =>
  document.querySelector('img[src*="estrella"]') as HTMLImageElement;

describe('Estrella', () => {
  it('usa el recorte de la cara para avatares y el cuerpo entero cuando se pide', () => {
    const { rerender } = render(<Estrella />);
    expect(caraDe().getAttribute('src')).toBe('/lukapp-estrella-cara.png');

    rerender(<Estrella variante="cuerpo" />);
    expect(caraDe().getAttribute('src')).toBe('/lukapp-estrella.png');
  });

  /* Los párpados se colocan en porcentajes de su caja, así que esa caja tiene
     que tener la proporción exacta del dibujo. Si alguien le pone un
     `object-fit` o le cuadra la caja, las barras del letterbox corren los ojos
     y el parpadeo aparece fuera de sitio. */
  it('mantiene la caja del dibujo en su proporción, sin letterbox', () => {
    render(<Estrella variante="cuerpo" />);
    const caja = caraDe().parentElement as HTMLElement;
    expect(parseFloat(caja.style.aspectRatio)).toBeCloseTo(716 / 741, 4);
    expect(caraDe().style.objectFit).toBe('');
  });

  it('pone un párpado sobre cada ojo', () => {
    render(<Estrella />);
    const parpados = (caraDe().parentElement as HTMLElement).querySelectorAll('span');
    expect(parpados).toHaveLength(2);
    // Uno a cada lado de la cara, y ninguno encima del otro. El `left` es un
    // calc() con la holgura restada, así que se compara el porcentaje base.
    const porcentaje = (parpado: Element) =>
      parseFloat(/([\d.]+)%/.exec((parpado as HTMLElement).style.left)![1]);
    expect(porcentaje(parpados[0])).toBeLessThan(porcentaje(parpados[1]));
  });

  it('es decorativa salvo que se le dé un texto alternativo', () => {
    const { rerender } = render(<Estrella />);
    expect(caraDe()).toHaveAttribute('aria-hidden', 'true');
    expect(caraDe()).toHaveAttribute('alt', '');

    rerender(<Estrella alt="La Estrella IA de LukApp" />);
    expect(screen.getByAltText('La Estrella IA de LukApp')).toBeInTheDocument();
    expect(caraDe()).not.toHaveAttribute('aria-hidden');
  });
});
