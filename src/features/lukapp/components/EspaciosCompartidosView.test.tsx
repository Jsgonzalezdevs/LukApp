import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EspaciosCompartidosView } from './EspaciosCompartidosView';
import { useEspaciosCompartidos } from '../data/useEspaciosCompartidos';

vi.mock('../data/useEspaciosCompartidos', () => ({ useEspaciosCompartidos: vi.fn() }));

const unEspacio = (conPareja: boolean) => ({
  id: 'espacio-1', nombre: 'Viaje', icono: '✈️', color: '#8b5cf6', createdAt: '2026-10-21',
  integrantes: [
    ...(conPareja ? [{ id: 'pareja-id', nombre: 'Ana', avatarColor: '#ec4899', emoji: '🐱' }] : []),
    { id: 'yo', nombre: 'Tú', avatarColor: '#3b82f6', emoji: '🙂' },
  ],
  gastos: conPareja ? [{ id: 'gasto-1', descripcion: 'Bus', montoCop: 60_000, fecha: '2026-10-21', pagadoPorId: 'pareja-id', categoria: 'otros' }] : [],
});

const prepararHook = (conPareja: boolean) => {
  vi.mocked(useEspaciosCompartidos).mockReturnValue({
    espacios: [unEspacio(conPareja)], error: null, limpiarError: vi.fn(), crearEspacio: vi.fn(),
    agregarGasto: vi.fn().mockResolvedValue(true), borrarGasto: vi.fn(), saldarCuentas: vi.fn(),
    crearInvitacion: vi.fn().mockResolvedValue('https://lukapp.app/?invitacion=token'), aceptarInvitacion: vi.fn(),
  });
};

describe('EspaciosCompartidosView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no ofrece un pagador inexistente ni calcula mitades antes de aceptar una invitación', () => {
    prepararHook(false);
    render(<EspaciosCompartidosView onCerrar={() => {}} userId="yo-id" />);
    expect(screen.getByText(/Invita a alguien para empezar a repartir los gastos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anotar gasto compartido' }));
    expect(screen.getByRole('button', { name: 'Pagué Yo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagó Tu pareja' })).not.toBeInTheDocument();
  });

  it('muestra el nombre y emoji del integrante que realmente pagó', () => {
    prepararHook(true);
    render(<EspaciosCompartidosView onCerrar={() => {}} userId="yo-id" />);
    expect(screen.getByText('Pagó Ana • 2026-10-21')).toBeInTheDocument();
    expect(screen.getByLabelText('Pagó Ana')).toBeInTheDocument();
  });
});
