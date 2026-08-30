import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BarreraErrores } from './BarreraErrores';

const VistaQueFalla: React.FC = () => {
  throw new Error('fallo de prueba');
};

describe('BarreraErrores', () => {
  it('muestra una recuperación clara sin exponer el fallo técnico', () => {
    const errorDeReact = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reintentar = vi.fn();

    render(
      <BarreraErrores onReintentar={reintentar}>
        <VistaQueFalla />
      </BarreraErrores>,
    );

    expect(screen.getByRole('heading', { name: 'Algo no salió como esperábamos' })).toBeInTheDocument();
    expect(screen.getByText(/Tus datos guardados siguen intactos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a abrir' }));
    expect(reintentar).toHaveBeenCalledOnce();
    errorDeReact.mockRestore();
  });
});
