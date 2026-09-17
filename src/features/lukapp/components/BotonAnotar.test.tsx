import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonAnotar } from './BotonAnotar';

const dictadoPrueba = vi.hoisted(() => ({
  estado: 'idle' as 'idle' | 'listening' | 'processing' | 'blocked',
  iniciar: vi.fn(),
  detener: vi.fn(),
  cancelar: vi.fn(),
  alFinal: null as ((texto: string) => void) | null,
}));

vi.mock('../hooks/useDictation', () => ({
  useDictation: (alFinal: (texto: string) => void) => {
    dictadoPrueba.alFinal = alFinal;
    return {
      supported: true,
      status: dictadoPrueba.estado,
      interim: '',
      level: 0,
      error: null,
      start: dictadoPrueba.iniciar,
      stop: dictadoPrueba.detener,
      cancel: dictadoPrueba.cancelar,
    };
  },
}));

vi.mock('../hooks/useImageOCR', () => ({
  useImageOCR: () => ({
    scanImage: vi.fn(),
    isScanning: false,
    progress: 0,
    error: null,
  }),
}));

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock('../hooks/useAudioFeedback', () => ({
  useAudioFeedback: () => ({ play: vi.fn() }),
}));

const props = {
  onDictado: vi.fn(),
  onManual: vi.fn(),
  onBuscar: vi.fn(),
};

describe('BotonAnotar — reutilizar el micrófono', () => {
  beforeEach(() => {
    dictadoPrueba.estado = 'idle';
    dictadoPrueba.iniciar.mockClear();
    dictadoPrueba.detener.mockClear();
    dictadoPrueba.cancelar.mockClear();
    dictadoPrueba.alFinal = null;
    props.onDictado.mockClear();
  });

  it('permite iniciar otra grabación después de cerrar el gasto transcrito', async () => {
    render(<BotonAnotar {...props} />);

    act(() => dictadoPrueba.alFinal?.('pagué veinte mil'));
    expect(props.onDictado).toHaveBeenCalledWith('pagué veinte mil');
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Anotar hablando' }));

    expect(dictadoPrueba.iniciar).toHaveBeenCalledTimes(1);
  });

  it('cancelar una toma no descarta la transcripción de la toma siguiente', () => {
    const vista = render(<BotonAnotar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Anotar hablando' }));
    dictadoPrueba.estado = 'listening';
    vista.rerender(<BotonAnotar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar dictado', hidden: true }));

    dictadoPrueba.estado = 'idle';
    vista.rerender(<BotonAnotar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anotar hablando' }));
    act(() => dictadoPrueba.alFinal?.('gasté diez mil'));

    expect(props.onDictado).toHaveBeenCalledWith('gasté diez mil');
  });
});
