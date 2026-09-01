import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MascotaLuki } from './MascotaLuki';

const ENCUADRE = '16.0 33.0 240.0 343.9';

/* El vector de la portada lo genera scripts/derivar-luki-portada.py. Estas
   comprobaciones cuidan justo lo que ese script garantiza: un solo dibujo, sin
   la demo del rig encima, y con la anatomia ya corregida. */
describe('luki-portada.svg', () => {
  const svg = readFileSync('public/luki-vector/luki-portada.svg', 'utf8');

  it('es un unico dibujo, sin las copias recortadas ni la hoja de estilos de la demo', () => {
    expect(svg).not.toContain('clip-path');
    expect(svg).not.toContain('class="limb');
    expect(svg).not.toContain('<style');
    expect(svg).not.toContain('animation');
    expect(svg).not.toContain('<use');
  });

  it('no incrusta imagenes ni documentos', () => {
    for (const prohibido of ['<image', '<img', '<object', '<iframe', '<canvas', 'data:image']) {
      expect(svg).not.toContain(prohibido);
    }
  });

  it('no conserva el fondo blanco de la lamina de Illustrator', () => {
    expect(svg).not.toContain('M 0 0 L 1536 0');
  });

  it('viene con el encuadre vertical de la mascota aprobada', () => {
    expect(svg).toContain(`viewBox="${ENCUADRE}"`);
    // Mas alto que ancho: la silueta ya no se lee cuadrada.
    const [, , ancho, alto] = ENCUADRE.split(' ').map(Number);
    expect(alto / ancho).toBeGreaterThan(1.35);
  });
});

describe('MascotaLuki', () => {
  it('monta el personaje vectorial dentro del arbol de React y saluda al tocarlo', async () => {
    render(<MascotaLuki />);

    const mascota = screen.getByRole('button', { name: /Luki, la mascota/i });
    expect(mascota).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.luki-mascota-arte svg')).toHaveAttribute('viewBox', ENCUADRE);
    });

    expect(
      document.querySelector(
        '.luki-mascota-arte object, .luki-mascota-arte iframe, .luki-mascota-arte img, .luki-mascota-arte canvas'
      )
    ).not.toBeInTheDocument();

    fireEvent.click(mascota);
    expect(mascota).toHaveClass('celebrando');
  });
});
