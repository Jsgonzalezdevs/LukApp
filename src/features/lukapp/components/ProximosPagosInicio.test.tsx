import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ObligacionFutura } from '../lib/obligacionesFuturas';
import { ProximosPagosInicio } from './ProximosPagosInicio';

const pago = (id: string, fecha: string | null, cambios: Partial<ObligacionFutura> = {}): ObligacionFutura => ({ id, fecha, origen: 'recurrente', concepto: id, periodo: '2026-10', montoCop: 123456, cuentaId: null, estado: 'programada', certeza: 'programada', ...cambios });

describe('Próximos pagos del inicio', () => {
  it('muestra los tres siguientes por fecha, excluye los confirmados y abre el calendario', () => {
    const abrir = vi.fn();
    render(<ProximosPagosInicio hoy="2026-10-20" privacidad={false} onVerPagos={abrir} obligaciones={[pago('Cuarto', '2026-10-25'), pago('Hoy', '2026-10-20'), pago('Tercero', '2026-10-24'), pago('Segundo', '2026-10-21'), pago('Pagado', '2026-10-20', { estado: 'confirmada' })]} />);
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(within(filas[0]).getByRole('button')).toHaveTextContent('Hoy');
    expect(within(filas[1]).getByRole('button')).toHaveTextContent('Segundo');
    expect(screen.queryByText('Pagado')).not.toBeInTheDocument();
    expect(screen.queryByText('Cuarto')).not.toBeInTheDocument();
    fireEvent.click(within(filas[0]).getByRole('button'));
    expect(abrir).toHaveBeenCalledOnce();
  });

  it('respeta privacidad y distingue estimaciones y fechas pendientes', () => {
    render(<ProximosPagosInicio hoy="2026-10-20" privacidad onVerPagos={vi.fn()} obligaciones={[pago('Tarjeta', '2026-10-21', { certeza: 'estimada' }), pago('Préstamo', null)]} />);
    expect(screen.queryByText('$123.456')).not.toBeInTheDocument();
    expect(screen.getByText(/Estimado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /obligaciones sin fecha/ })).toBeInTheDocument();
    expect(screen.getByText(/no registra un gasto ni un pago/)).toBeInTheDocument();
  });

  it('un calendario vacío informa que faltan pagos registrados', () => {
    render(<ProximosPagosInicio hoy="2026-10-20" privacidad={false} onVerPagos={vi.fn()} obligaciones={[]} />);
    expect(screen.getByText(/No hay pagos con fecha registrada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver calendario' })).toBeInTheDocument();
  });
});
