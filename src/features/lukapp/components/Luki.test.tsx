import { render } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="lienzo-3d">{children}</div>,
  useFrame: () => undefined,
}));

import { Luki } from './Luki';

describe('Luki', () => {
  it('renderiza un personaje WebGL sin recursos de imagen ni SVG', () => {
    const { container, getByTestId } = render(<Luki />);

    expect(getByTestId('lienzo-3d')).toBeTruthy();
    expect(container.querySelector('.luki-3d')).toBeTruthy();
    expect(container.querySelector('svg, img, image')).toBeNull();
  });

  it('conserva estados expresivos para el modelo 3D', () => {
    const { container, rerender } = render(<Luki estado="pensando" mirarCursor={false} />);

    expect(container.querySelector('[data-gesto="presume"]')).toBeTruthy();

    rerender(<Luki estado="sorprendida" gesto="equilibrio" mirarCursor={false} />);

    expect(container.querySelector('[data-gesto="equilibrio"]')).toBeTruthy();
  });

  it('acepta gestos animables para reutilizarla en distintos momentos de la app', () => {
    const { container } = render(<Luki gesto="mareada" mirarCursor={false} />);

    expect(container.querySelector('[data-gesto="mareada"]')).toBeTruthy();
  });
});
