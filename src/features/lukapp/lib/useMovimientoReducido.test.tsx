import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMovimientoReducido } from './useMovimientoReducido';

describe('preferencia de movimiento reducido', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('actualiza la interfaz cuando cambia la preferencia del sistema con LukApp abierta', () => {
    let reducido = false;
    const oyentes = new Set<() => void>();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return reducido; },
      addEventListener: (_evento: string, oyente: () => void) => oyentes.add(oyente),
      removeEventListener: (_evento: string, oyente: () => void) => oyentes.delete(oyente),
    })));

    const PreferenciaVisible = () => {
      const prefiereMenosMovimiento = useMovimientoReducido();
      return <span>{prefiereMenosMovimiento ? 'Movimiento reducido' : 'Animaciones normales'}</span>;
    };

    const vista = render(<PreferenciaVisible />);
    expect(screen.getByText('Animaciones normales')).toBeTruthy();

    act(() => {
      reducido = true;
      oyentes.forEach((oyente) => oyente());
    });
    expect(screen.getByText('Movimiento reducido')).toBeTruthy();

    vista.unmount();
    expect(oyentes.size).toBe(0);
  });
});
