import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionList } from './TransactionList';

const movimiento = {
  id: 'tx-1',
  kind: 'gasto' as const,
  amountCop: 18_000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-09-23',
  cuentaId: 'nequi',
  rawTranscript: '',
  createdAt: '2026-09-23T15:00:00.000Z',
};

describe('TransactionList — atajos de movimiento', () => {
  it('mantiene acciones equivalentes y accesibles para repetir o editar una fila', () => {
    const repetir = vi.fn();
    const editar = vi.fn();
    render(
      <TransactionList
        transactions={[movimiento]}
        onAbrir={vi.fn()}
        onRepetir={repetir}
        onEditar={editar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Repetir Almuerzo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Almuerzo' }));

    expect(repetir).toHaveBeenCalledWith(movimiento);
    expect(editar).toHaveBeenCalledWith(movimiento);
  });
});
