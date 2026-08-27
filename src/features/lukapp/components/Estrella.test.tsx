import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Estrella } from './Estrella';

/* Lo que se comprueba aquí es la geometría y la accesibilidad, no el
   movimiento: el parpadeo y el balanceo los pinta framer-motion contra
   requestAnimationFrame, que en jsdom no avanza, así que afirmarlos sería
   afirmar el mock y no el componente. */

describe('Estrella', () => {
  it('renderiza la mascota Estrella vectorizada', () => {
    const { container } = render(<Estrella />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('cambia el tamaño según la variante', () => {
    const { container, rerender } = render(<Estrella variante="cara" />);
    let svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');

    rerender(<Estrella variante="cuerpo" />);
    svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
  });

  it('es decorativa salvo que se le dé un texto alternativo', () => {
    const { rerender } = render(<Estrella />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(<Estrella alt="La Estrella IA de LukApp" />);
    expect(screen.getByRole('img', { name: 'La Estrella IA de LukApp' })).toBeInTheDocument();
  });
});
