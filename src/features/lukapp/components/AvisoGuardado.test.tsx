import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('explica que un guardado sin conexión todavía no está sincronizado', () => {
    render(<AvisoGuardado guardado={{ id: 'tx', texto: 'Almuerzo' }} estado="pendiente" onDeshacer={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByText('Guardado en este dispositivo · pendiente de sincronizar')).toBeInTheDocument();
  });

  it('un error no muestra una confirmación ni ofrece deshacer un movimiento inexistente', () => {
    render(<AvisoGuardado guardado={{ id: 'error', texto: 'No se pudo guardar', esError: true }} onDeshacer={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deshacer/ })).not.toBeInTheDocument();
  });

  it('un deshacer fallido no contamina el aviso del siguiente guardado', async () => {
    const props = { onDeshacer: vi.fn().mockResolvedValue(false), onCerrar: vi.fn() };
    const { rerender } = render(<AvisoGuardado {...props} guardado={{ id: 'primero', texto: 'Primer gasto' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo deshacer'));
    rerender(<AvisoGuardado {...props} guardado={{ id: 'segundo', texto: 'Segundo gasto' }} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

});
