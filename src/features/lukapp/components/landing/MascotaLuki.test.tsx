import { existsSync, readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MascotaLuki } from './MascotaLuki';

describe('luki-nutria-saludo-transparente.png', () => {
  const ruta = 'public/brand/luki-nutria-saludo-transparente.png';

  it('conserva el PNG aprobado como recurso de la landing', () => {
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  });
});

describe('MascotaLuki', () => {
  it('muestra el PNG original sin reconstruirlo como SVG ni convertirlo en un control', () => {
    render(<MascotaLuki />);

    const luki = screen.getByRole('img', { name: /Luki, la mascota de LukApp, saludando/i });
    expect(luki).toHaveAttribute('src', '/brand/luki-nutria-saludo-transparente.png');
    expect(luki).toHaveAttribute('width', '306');
    expect(luki).toHaveAttribute('height', '347');
    expect(document.querySelector('.luki-mascota svg, .luki-mascota button')).not.toBeInTheDocument();
  });
});
