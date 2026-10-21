import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { VaquitasModal } from './VaquitasModal';

describe('VaquitasModal', () => {
  beforeEach(() => localStorage.clear());

  it('reparte el presupuesto exacto, registra gastos y no mezcla proyectos entre cuentas', async () => {
    const vista = render(<VaquitasModal isOpen onClose={() => {}} userId="persona-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Armar mi primera vaquita' }));
    fireEvent.change(screen.getByPlaceholderText('Ej. Paseo a Melgar, Asado, Regalo Mamá...'), { target: { value: 'Paseo' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 200000'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Carlos, María, Juan...'), { target: { value: 'Ana, Juan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Vaquita' }));

    expect(await screen.findByText('0% recolectado')).toBeInTheDocument();
    expect(screen.getAllByText(/Cuota:/).map((nodo) => nodo.textContent)).toEqual([
      'Cuota: $34 · Aportó: $0', 'Cuota: $33 · Aportó: $0', 'Cuota: $33 · Aportó: $0',
    ]);
    expect(localStorage.getItem('lukapp_vaquitas_v1:persona-a')).toContain('"aportadoCop":0');

    fireEvent.click(screen.getByRole('button', { name: '＋ Anotar gasto' }));
    fireEvent.change(screen.getByPlaceholderText('Ej. Transporte del paseo'), { target: { value: 'Bus' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 85000'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar gasto 🐮' }));
    expect(await screen.findByText('Bus')).toBeInTheDocument();
    expect(screen.getAllByText('$120')).toHaveLength(2);
    expect(screen.getByText('-$120')).toBeInTheDocument();

    vista.rerender(<VaquitasModal isOpen onClose={() => {}} userId="persona-b" />);
    expect(await screen.findByText('Sin vaquitas activas')).toBeInTheDocument();
    expect(localStorage.getItem('lukapp_vaquitas_v1:persona-b')).toBe('[]');

    vista.rerender(<VaquitasModal isOpen onClose={() => {}} userId="persona-a" />);
    expect(await screen.findByText('Bus')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('lukapp_vaquitas_v1:persona-a')).toContain('"descripcion":"Bus"'));
  });
});
