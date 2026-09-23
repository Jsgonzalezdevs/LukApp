import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

const abrirFuentes = async () => {
  render(<Onboarding onTerminar={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Prefiero no decirlo' }));
  await screen.findByRole('button', { name: 'Bancolombia' });
};

describe('Onboarding — fuente inicial de dinero', () => {
  it('no ofrece Efectivo porque la app ya crea esa cuenta', async () => {
    await abrirFuentes();

    expect(screen.queryByRole('button', { name: 'Efectivo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bancolombia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nequi' })).toBeInTheDocument();
  });

  it('no permite recrear Efectivo mediante la opción Otro', async () => {
    await abrirFuentes();

    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    fireEvent.change(screen.getByLabelText('Nombre del banco'), {
      target: { value: 'Efectivo de la casa' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Efectivo ya viene incluido');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });
});
