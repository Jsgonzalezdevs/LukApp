import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvisoGuardado } from './AvisoGuardado';
import { debeCerrarPorDeslizamiento } from './avisoGuardadoGestos';

describe('AvisoGuardado', () => {
  it('no ofrece un deshacer falso para operaciones financieras compuestas', () => {
    render(
      <AvisoGuardado
        guardado={{ id: 'voz', texto: 'Abono guardado', permitirDeshacer: false }}
        onDeshacer={vi.fn()}
        onCerrar={vi.fn()}
      />,
    );
    expect(screen.getByText('Abono guardado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deshacer/ })).not.toBeInTheDocument();
  });

  it('solo cierra con un deslizamiento hacia abajo que sea intencional', () => {
    expect(debeCerrarPorDeslizamiento(30, 200)).toBe(false);
    expect(debeCerrarPorDeslizamiento(73, 200)).toBe(true);
    expect(debeCerrarPorDeslizamiento(20, 521)).toBe(true);
  });
});
