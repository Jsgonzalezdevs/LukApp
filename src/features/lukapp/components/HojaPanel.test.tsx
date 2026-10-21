import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HojaPanel } from './HojaPanel';

describe('capas de navegación', () => {
  it('Escape cierra solo la capa superior y devuelve el foco a la que queda', async () => {
    const cerrarCuenta = vi.fn();
    const cerrarImportacion = vi.fn();
    const cuenta = <HojaPanel titulo="Cuenta" onCerrar={cerrarCuenta}><p>Saldo</p></HojaPanel>;
    const vista = render(<>{cuenta}<HojaPanel titulo="Importación" onCerrar={cerrarImportacion}><p>Extractos</p></HojaPanel></>);
    const superior = screen.getByRole('dialog', { name: 'Importación' });
    await waitFor(() => expect(within(superior).getByRole('button', { name: 'Cerrar' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrarImportacion).toHaveBeenCalledOnce();
    expect(cerrarCuenta).not.toHaveBeenCalled();
    vista.rerender(<>{cuenta}</>);
    const inferior = screen.getByRole('dialog', { name: 'Cuenta' });
    await waitFor(() => expect(within(inferior).getByRole('button', { name: 'Cerrar' })).toHaveFocus());
  });
});
