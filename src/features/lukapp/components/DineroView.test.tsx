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
    expect(nu.querySelector('.cuenta-identidad')).toHaveStyle({ backgroundColor: '#820AD1', color: '#FFFFFF' });
    expect(screen.getByRole('button', { name: /Nequi personal/ }).querySelector('.cuenta-identidad')).toHaveStyle({ backgroundColor: '#200020' });
    expect(screen.getByRole('button', { name: /Rappi/ }).querySelector('.cuenta-identidad')).toHaveStyle({ backgroundColor: '#FF441F' });
    expect(nu.style.backgroundColor).toBe('');
    expect(screen.getByRole('button', { name: /Efectivo/ }).style.backgroundColor).toBe('');
    expect(nu).toHaveTextContent('$ ••••••');
    fireEvent.click(nu);
    expect(onAbrir).toHaveBeenCalledWith(cuentas[0]);
  });

  it('usa blanco en las cuentas rojas y reserva la superficie neutra para sus saldos', () => {
    const cuenta: Cajita = { id: 'davi', nombre: 'Davivienda', tipo: 'cuenta', icon: 'PiggyBank', metaCop: null, tasaEaPct: null, createdAt: '2026-10-21', archivedAt: null };
    render(<DineroView cajitas={[cuenta]} movimientos={[]} transacciones={[]} mostrarAhorro onAbrir={vi.fn()} onAbrirTarjetas={vi.fn()} onCrear={vi.fn()} />);
    const fila = screen.getByRole('button', { name: /Davivienda/ });
    const identidad = fila.querySelector('.cuenta-identidad')!;
    expect(identidad).toHaveStyle({ color: '#FFFFFF', backgroundColor: '#ED1C27' });
    expect(identidad).not.toContainElement(fila.querySelector('.cuenta-saldo') as HTMLElement);
    expect(fila.querySelector('.cuenta-nombre')).toHaveTextContent('Davivienda');
  });
});
