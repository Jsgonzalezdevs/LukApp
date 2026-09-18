import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DictadoOverlay } from './DictadoOverlay';

const props = {
  abierto: true,
  nivelAudio: 0.5,
  error: null,
  onCancelar: vi.fn(),
  onTerminar: vi.fn(),
  onContinuar: vi.fn(),
};

describe('DictadoOverlay — flujo intuitivo de voz', () => {
  it('explica cómo terminar sin mostrar un check antes de tener el texto definitivo', () => {
    render(<DictadoOverlay {...props} fase="escuchando" texto="" />);

    expect(screen.getByText(/Al terminar, toca/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminé de hablar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar texto y revisar movimiento' })).not.toBeInTheDocument();
  });

  it('conserva la transcripción y recién entonces ofrece el check para continuar', () => {
    const continuar = vi.fn();
    render(
      <DictadoOverlay
        {...props}
        fase="revelando"
        texto="Gasté veinte mil en almuerzo"
        onContinuar={continuar}
      />,
    );

    expect(screen.getByText('Esto fue lo que entendí')).toBeInTheDocument();
    expect(screen.getByLabelText('Transcripción final')).toHaveTextContent('Gasté veinte mil en almuerzo');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar texto y revisar movimiento' }));
    expect(continuar).toHaveBeenCalledTimes(1);
  });
});
