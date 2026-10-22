import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetalleCajita } from './DetalleCajita';
import type { Cajita } from '../data/modelos';

const montar = (datos: Partial<Cajita> = {}) => {
  const cajita: Cajita = { id: 'ahorro', nombre: 'Viaje', icon: 'PiggyBank', tipo: 'cajita', tasaEaPct: 10.5, metaCop: 1000000, createdAt: '2026-10-22', archivedAt: null, ...datos };
  const onActualizar = vi.fn();
  render(<DetalleCajita cajita={cajita} movimientos={[]} transacciones={[]} onActualizar={onActualizar} onFijarSaldo={vi.fn()} onEliminar={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Viaje' }));
  return { onActualizar, cajita };
};

describe('DetalleCajita — rendimientos opcionales', () => {
  it('mantiene la tasa existente al guardar sin abrir Avanzado', async () => {
    const { onActualizar, cajita } = montar();
    expect(screen.getByRole('button', { name: /Avanzado/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('10.5% E.A. configurada')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Vacaciones' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onActualizar).toHaveBeenCalledWith({ ...cajita, nombre: 'Vacaciones', esBajoMonto: false, limiteCreditoCop: null, diaCorte: null, diaPago: null, pagoMinimoCop: null }));
  });

  it('permite editar la tasa y desactivarla sin alterar la meta', async () => {
    const { onActualizar } = montar();
    fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByLabelText('Tasa efectiva anual (E.A.)')).toHaveValue('10.5');
    fireEvent.change(screen.getByLabelText('Tasa efectiva anual (E.A.)'), { target: { value: '9,25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onActualizar).toHaveBeenCalledWith(expect.objectContaining({ tasaEaPct: 9.25, metaCop: 1000000 })));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Viaje' }));
    fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onActualizar).toHaveBeenLastCalledWith(expect.objectContaining({ tasaEaPct: null, metaCop: 1000000 })));
  });

  it('exige una tasa válida al activar un ahorro que no tenía rendimientos', () => {
    const { onActualizar } = montar({ tasaEaPct: null });
    fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onActualizar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe una tasa mayor que cero');
    expect(screen.getByLabelText('Tasa efectiva anual (E.A.)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('no ofrece ajustes de ahorro al editar una cuenta', () => {
    montar({ tipo: 'cuenta' });
    expect(screen.queryByRole('button', { name: /Avanzado/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Meta')).not.toBeInTheDocument();
  });
});
