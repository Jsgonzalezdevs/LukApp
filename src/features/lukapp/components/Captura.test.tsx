import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseTransaction } from '../lib/parseTransaction';
import { Captura } from './Captura';

describe('Captura desde dictado', () => {
  it('mantiene visible la transcripción definitiva y permite volver a dictar', () => {
    const onReintentarVoz = vi.fn();
    render(
      <Captura
        parsed={parseTransaction('pagué 2 pizzas por 45 mil')}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onReintentarVoz={onReintentarVoz}
      />,
    );

    expect(screen.getByText('Esto fue lo que entendí')).toBeInTheDocument();
    expect(screen.getByText('“pagué 2 pizzas por 45 mil”')).toBeInTheDocument();
    expect(screen.getByText(/Escuché más de una cifra/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dictar otra vez' }));
    expect(onReintentarVoz).toHaveBeenCalledOnce();
  });

  it('explica cuando el monto visible proviene del historial y no de la voz', () => {
    const anterior = {
      id: 't1',
      kind: 'gasto' as const,
      amountCop: 13_500,
      category: 'comida',
      description: 'Almuerzo',
      occurredOn: '2026-09-15',
      cuentaId: null,
      rawTranscript: 'almuerzo 13.500',
      createdAt: '2026-09-15T12:00:00.000Z',
    };

    render(
      <Captura
        parsed={parseTransaction('almuerzo', [], [], undefined, [anterior])}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/No escuché un monto; propuse el de un movimiento anterior/)).toBeInTheDocument();
  });
});
