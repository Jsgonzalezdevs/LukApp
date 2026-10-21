import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '../types';
import { TendenciasView } from './TendenciasView';

const tx = (changes: Partial<Transaction> = {}): Transaction => ({
  id: 'real', kind: 'gasto', amountCop: 25_000, category: 'comida', description: 'Almuerzo',
  occurredOn: '2026-08-10', cuentaId: null, rawTranscript: '', createdAt: '2026-08-10T12:00:00Z',
  ...changes,
});

describe('TendenciasView — cifra conectada con movimientos', () => {
  it('abre los movimientos del mes seleccionado y distingue historial que no cambia el saldo', () => {
    const real = tx();
    const historico = tx({ id: 'hist', description: 'Café antiguo', amountCop: 5_000, afectaSaldo: false });
    const onAbrir = vi.fn();
    render(<TendenciasView transacciones={[real, historico]} mes="2026-08" onAbrirMovimiento={onAbrir} />);

    fireEvent.click(screen.getByRole('button', { name: /^ago: entró/ }));
    expect(screen.getByText('🧾 Movimientos de agosto 2026')).toBeInTheDocument();
    expect(screen.getByText('🕰️ Historial importado · no modifica saldo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Almuerzo/ }));
    expect(onAbrir).toHaveBeenCalledWith(real);
    expect(screen.getByText(/pagos programados y los importes estimados se muestran aparte/)).toBeInTheDocument();
  });
});
