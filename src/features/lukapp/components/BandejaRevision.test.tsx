import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '../types';
import type { RevisionDudosa } from '../data/revisiones';
import { BandejaRevision } from './BandejaRevision';

const tx = (id: string): Transaction => ({
  id,
  kind: 'gasto',
  amountCop: 12000,
  category: 'comida',
  description: 'Café Parque',
  occurredOn: '2026-10-20',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-10-20T12:00:00.000Z',
});

describe('BandejaRevision', () => {
  it('conserva emojis de identidad, permite abrir el movimiento y guardar una resolución', () => {
    const guardar = vi.fn(async () => true);
    const abrir = vi.fn();
    render(<BandejaRevision transacciones={[tx('uno'), tx('dos')]} revisiones={[]} onGuardar={guardar} onAbrirMovimiento={abrir} />);

    expect(screen.getByText('Pendientes por revisar')).toBeInTheDocument();
    expect(screen.getAllByText('💸')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver movimiento' })[0]);
    expect(abrir).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /Marcar revisado/ })[0]);
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'resuelta',
      resolucion: 'Revisado por la persona usuaria.',
    }));
  });

  it('muestra el nombre del documento junto al registro que necesita validación', () => {
    const revision: RevisionDudosa = {
      id: 'documento:uno', tipo: 'documento', estado: 'pendiente', referenciaId: 'uno',
      titulo: 'Confirma la lectura de esta fila', detalle: 'Revisa la cifra detectada.',
      documento: 'extracto-octubre.pdf', resolucion: null,
      createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-20T12:00:00.000Z',
    };
    render(<BandejaRevision transacciones={[tx('uno')]} revisiones={[revision]} onGuardar={vi.fn(async () => true)} onAbrirMovimiento={vi.fn()} />);
    expect(screen.getByText('📄 extracto-octubre.pdf')).toBeInTheDocument();
    expect(screen.getAllByText(/12\.000/)).toHaveLength(2);
  });
});
