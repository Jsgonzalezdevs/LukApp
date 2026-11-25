import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CuentaView } from './CuentaView';
import * as supabaseData from '../data/supabase';

const clienteFalso = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'token-prueba' } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { usuario: 'Pepa' } }) }) }) }),
};

const props = {
  userId: 'usuario-1',
  cuenta: { email: 'pepa@ejemplo.co', onSalir: vi.fn() },
  syncError: null,
  cambiosPendientes: 0,
  onSincronizar: async () => {},
};

const llamadasApodo = (peticiones: ReturnType<typeof vi.fn>) =>
  peticiones.mock.calls.filter(([url]) => String(url).includes('/api/mi-cuenta/apodo'));

describe('CuentaView — cambiar el nombre de usuario', () => {
  let peticiones: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue(clienteFalso as never);
    peticiones = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/mi-cuenta/apodo')) {
        const { apodo } = JSON.parse(String(init?.body));
        return Promise.resolve(apodo === 'Ocupado'
          ? { ok: false, json: async () => ({ error: 'Ese nombre ya lo tiene otra persona. Prueba con otro.' }) }
          : { ok: true, json: async () => ({ ok: true, apodo }) });
      }
      // El plan no es parte de esta prueba: que falle y quede en su aviso.
      return Promise.resolve({ ok: false, json: async () => ({ error: 'sin plan en la prueba' }) });
    });
    vi.stubGlobal('fetch', peticiones);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('guarda el nuevo nombre por el servidor y lo muestra', async () => {
    render(<CuentaView {...props} />);
    await screen.findByText('Pepa');
    fireEvent.click(screen.getByRole('button', { name: /Cambiar nombre/ }));
    fireEvent.change(screen.getByLabelText('Tu nombre o apodo'), { target: { value: '  Pepa Pig ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Pepa Pig');
    expect(JSON.parse(String(llamadasApodo(peticiones)[0][1].body))).toEqual({ apodo: 'Pepa Pig' });
    expect(screen.getByText(/así te verán ahora/)).toBeTruthy();
  });

  it('avisa sin llamar al servidor si el nombre no cumple las reglas', async () => {
    render(<CuentaView {...props} />);
    await screen.findByText('Pepa');
    fireEvent.click(screen.getByRole('button', { name: /Cambiar nombre/ }));
    fireEvent.change(screen.getByLabelText('Tu nombre o apodo'), { target: { value: 'Soporte LukApp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/reservado/);
    expect(llamadasApodo(peticiones)).toHaveLength(0);
  });

  it('muestra el motivo cuando el nombre ya está en uso', async () => {
    render(<CuentaView {...props} />);
    await screen.findByText('Pepa');
    fireEvent.click(screen.getByRole('button', { name: /Cambiar nombre/ }));
    fireEvent.change(screen.getByLabelText('Tu nombre o apodo'), { target: { value: 'Ocupado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/otra persona/));
    expect(screen.getByText('Pepa')).toBeTruthy();
  });
});
