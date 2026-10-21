import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cajita } from '../data/modelos';
import { DineroView } from './DineroView';

describe('DineroView — colores de las cuentas', () => {
  it('colorea las cuentas existentes, conserva la privacidad y abre su detalle', () => {
    const cuentas: Cajita[] = ['NuBank', 'Nequi personal', 'Efectivo', 'Rapi'].map((nombre, i) => ({
      id: String(i), nombre, tipo: 'cuenta', icon: 'PiggyBank', metaCop: null, tasaEaPct: null,
      createdAt: '2026-10-21', archivedAt: null,
    }));
    const onAbrir = vi.fn();
    render(<DineroView cajitas={cuentas} movimientos={[]} transacciones={[]} mostrarAhorro onAbrir={onAbrir} onAbrirTarjetas={vi.fn()} onCrear={vi.fn()} modoPrivacidad />);
    const nu = screen.getByRole('button', { name: /NuBank/ });
    expect(nu).toHaveStyle({ backgroundColor: '#820AD1', color: '#FFFFFF' });
    expect(screen.getByRole('button', { name: /Nequi personal/ })).toHaveStyle({ backgroundColor: '#200020' });
    expect(screen.getByRole('button', { name: /Rapi/ })).toHaveStyle({ backgroundColor: '#FF441F' });
    expect(screen.getByRole('button', { name: /Efectivo/ }).style.backgroundColor).toBe('');
    expect(nu).toHaveTextContent('$ ••••••');
    fireEvent.click(nu);
    expect(onAbrir).toHaveBeenCalledWith(cuentas[0]);
  });
});
