import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cajita } from '../data/modelos';
import { ConfirmarComandoVoz } from './ConfirmarComandoVoz';

const cajita = (id: string, nombre: string, tipo: Cajita['tipo']): Cajita => ({
  id, nombre, tipo, icon: 'Wallet', metaCop: null, tasaEaPct: null,
  createdAt: '2026-09-01T00:00:00.000Z', archivedAt: null,
});
const CAJITAS = [
  cajita('nequi', 'Nequi', 'cuenta'),
  cajita('banco', 'Bancolombia', 'cuenta'),
  cajita('viaje', 'Viaje', 'cajita'),
  cajita('nu', 'Tarjeta Nu', 'tarjeta'),
];
const SALDOS = new Map([['nequi', 500_000], ['banco', 900_000], ['viaje', 100_000], ['nu', 300_000]]);

describe('ConfirmarComandoVoz', () => {
  it('muestra la frase exacta y confirma un abono completo', () => {
    const confirmar = vi.fn();
    render(<ConfirmarComandoVoz comando={{ tipo: 'abono', deudaId: 'nu', cuentaId: 'banco', montoCop: 200_000, raw: 'Abona doscientos mil a la Nu desde Bancolombia' }} cajitas={CAJITAS} saldos={SALDOS} onConfirmar={confirmar} onCancelar={vi.fn()} />);
    expect(screen.getByText('“Abona doscientos mil a la Nu desde Bancolombia”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Registrar abono/ }));
    expect(confirmar).toHaveBeenCalledWith({ tipo: 'abono', deudaId: 'nu', cuentaId: 'banco', montoCop: 200_000 });
  });

  it('obliga a completar una orden incompleta antes de ejecutarla', () => {
    const confirmar = vi.fn();
    render(<ConfirmarComandoVoz comando={{ tipo: 'transferencia', origenId: null, destinoId: 'viaje', montoCop: 50_000, raw: 'Aparta cincuenta mil en Viaje' }} cajitas={CAJITAS} saldos={SALDOS} onConfirmar={confirmar} onCancelar={vi.fn()} />);
    const boton = screen.getByRole('button', { name: /Transferir/ });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Cuenta de origen'), { target: { value: 'nequi' } });
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    expect(confirmar).toHaveBeenCalledWith({ tipo: 'transferencia', origenId: 'nequi', destinoId: 'viaje', montoCop: 50_000 });
  });

  it('bloquea un abono que convertiría la deuda en un saldo falso', () => {
    render(<ConfirmarComandoVoz comando={{ tipo: 'abono', deudaId: 'nu', cuentaId: 'nequi', montoCop: 400_000, raw: 'Abona cuatrocientos mil' }} cajitas={CAJITAS} saldos={SALDOS} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('supera la deuda registrada');
    expect(screen.getByRole('button', { name: /Registrar abono/ })).toBeDisabled();
  });

  it('permite dejar un saldo exactamente en cero', () => {
    const confirmar = vi.fn();
    render(<ConfirmarComandoVoz comando={{ tipo: 'saldo', cajitaId: 'nequi', saldoCop: 0, raw: 'El saldo de Nequi es cero' }} cajitas={CAJITAS} saldos={SALDOS} onConfirmar={confirmar} onCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Actualizar saldo/ }));
    expect(confirmar).toHaveBeenCalledWith({ tipo: 'saldo', cajitaId: 'nequi', saldoCop: 0 });
  });
});
