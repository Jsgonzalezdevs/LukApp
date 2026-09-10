import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEXICO_VACIO } from '../lib/aprendizaje';
import { AsesorView } from './AsesorView';

const dictadoPrueba = vi.hoisted(() => ({
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
      status: 'idle',
      interim: '',
      level: 0,
      error: null,
      start: dictadoPrueba.iniciar,
      stop: dictadoPrueba.detener,
      cancel: dictadoPrueba.cancelar,
    };
  },
}));

vi.mock('../data/supabase', () => ({ obtenerSupabase: () => null }));

const props = {
  transacciones: [],
  cajitas: [],
  cajitasBalances: {},
  categorias: [],
  lexico: LEXICO_VACIO,
};

describe('AsesorView — dictado de preguntas', () => {
  beforeEach(() => {
    dictadoPrueba.iniciar.mockClear();
    dictadoPrueba.detener.mockClear();
    dictadoPrueba.alFinal = null;
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ia: true }),
    }));
  });

  it('inicia el micrófono desde el campo del asesor', () => {
    render(<AsesorView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar una pregunta' }));
    expect(dictadoPrueba.iniciar).toHaveBeenCalledTimes(1);
  });

  it('pone la transcripción en el campo para revisarla antes de enviar', () => {
    render(<AsesorView {...props} />);
    act(() => dictadoPrueba.alFinal?.('¿Cuánto gasté hoy?'));

    const campo = screen.getByPlaceholderText('Pregúntale a tu asesor...') as HTMLInputElement;
    expect(campo.value).toBe('¿Cuánto gasté hoy?');
    expect(screen.getByRole('button', { name: 'Enviar pregunta' })).not.toBeDisabled();
  });
});
