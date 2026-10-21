import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../types';
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

    expect(screen.getByText('Tu dictado')).toBeInTheDocument();
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

  it('resume un comprobante leído sin mostrar su texto técnico ni el QR', () => {
    render(
      <Captura
        parsed={parseTransaction('[OCR] Comprobante de pago Envío realizado Escanea este QR con Nequi Para Julián González Valor $9.000 Referencia M24388321')}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Comprobante leído: Gasto detectado/)).toBeInTheDocument();
    expect(screen.queryByText('Tu dictado')).not.toBeInTheDocument();
    expect(screen.queryByText(/M24388321/)).not.toBeInTheDocument();
  });

  it('mantiene las categorías en una sola fila para no tapar el teclado', () => {
    render(
      <Captura
        parsed={parseTransaction('empanada 2500')}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const categorias = screen.getByRole('group', { name: 'Categorías' });
    expect(categorias).toHaveClass('flex');
    expect(categorias).not.toHaveClass('grid-rows-2');
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });

  it('no cancela la captura al deslizar horizontalmente en el fondo', () => {
    const onCancel = vi.fn();
    render(
      <Captura
        parsed={parseTransaction('empanada 2500')}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const captura = screen.getByRole('dialog', { name: 'Anotar un movimiento' });
    fireEvent.touchStart(captura, { touches: [{ clientX: 20, clientY: 300 }] });
    fireEvent.touchEnd(captura, { changedTouches: [{ clientX: 260, clientY: 300 }] });

    expect(onCancel).not.toHaveBeenCalled();
  });
  it('espera el guardado y evita dos envíos mientras la respuesta está pendiente', async () => {
    let terminar!: (correcto: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>((resolver) => { terminar = resolver; }));
    render(<Captura parsed={parseTransaction('comida 2500')} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const boton = screen.getByRole('button', { name: 'Guardando…' });
    expect(boton).toBeDisabled();
    fireEvent.click(boton);
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => { terminar(false); });
    expect(screen.getByRole('dialog', { name: 'Anotar un movimiento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
  });

  it('en computador permite escribir el monto y confirmar con Enter', async () => {
    const consultaOriginal = window.matchMedia.bind(window);
    const consulta = vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ ...consultaOriginal(q), matches: q.includes('pointer: fine'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    try {
      const guardar = vi.fn().mockResolvedValue(true);
      render(<Captura parsed={parseTransaction('')} onSave={guardar} onCancel={vi.fn()} />);
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
      const monto = screen.getByRole('textbox', { name: 'Monto en pesos colombianos' });
      fireEvent.change(monto, { target: { value: '45.000' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Descripción' }), { target: { value: 'Almuerzo' } });
      fireEvent.keyDown(monto, { key: 'Enter' });
      await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ amountCop: 45000, category: 'comida', description: 'Almuerzo' })));
    } finally { consulta.mockRestore(); }
  });

  it('en móvil alterna escritura de monto y teclado sin perder el valor', async () => {
    const guardar = vi.fn().mockResolvedValue(true);
    render(<Captura parsed={parseTransaction('')} onSave={guardar} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Escribir el monto' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Monto en pesos colombianos' }), { target: { value: '12.000' } });
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar teclado de LukApp' }));
    expect(screen.getByRole('dialog', { name: 'Anotar un movimiento' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ amountCop: 12000 })));
  });

  it('prioriza categorías del mismo tipo y conserva acceso a todas', () => {
    const historial: Transaction[] = Array.from({ length: 8 }, (_, i) => ({ id: String(i), kind: i < 6 ? 'ingreso' : 'gasto', category: i < 6 ? 'transporte' : 'mercado', amountCop: 1000, description: 'Registro', cuentaId: null, occurredOn: '2026-10-20', createdAt: '2026-10-20', rawTranscript: '' }));
    render(<Captura parsed={parseTransaction('')} transacciones={historial} onSave={vi.fn()} onCancel={vi.fn()} />);
    const grupo = screen.getByRole('group', { name: 'Categorías' });
    expect(within(grupo).getAllByRole('button')[0]).toHaveTextContent('Mercado');
    expect(within(grupo).getAllByRole('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las categorías' }));
    expect(within(grupo).getAllByRole('button').length).toBeGreaterThan(5);
    expect(screen.getByRole('button', { name: 'Solo frecuentes' })).toBeInTheDocument();
  });

});
