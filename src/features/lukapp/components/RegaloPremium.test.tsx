import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseData from '../data/supabase';
import { RegaloPremium } from './RegaloPremium';

const regalo = { id: 42, dias: 15, venceEn: '2026-12-08T04:59:59.000Z' };

const respuesta = (cuerpo: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => cuerpo });

describe('RegaloPremium', () => {
  let fetchSimulado: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-prueba' } } }) },
    } as never);
    fetchSimulado = vi.fn(async (url: string) =>
      url.endsWith('/visto') ? { ok: true, status: 204, json: async () => ({}) } : respuesta({ regalo }));
    vi.stubGlobal('fetch', fetchSimulado);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('celebra el regalo con los días y la fecha, y lo marca como visto en el servidor', async () => {
    render(<RegaloPremium userId="persona-1" puedeMostrarse />);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo.textContent).toContain('te regaló');
    expect(dialogo.textContent).toContain('15');
    expect(dialogo.textContent).toContain('días');
    expect(dialogo.textContent).toContain('7 de diciembre de 2026');

    await waitFor(() => {
      expect(fetchSimulado).toHaveBeenCalledWith(
        expect.stringContaining('/api/mi-plan/regalo-premium/42/visto'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('espera a que no haya otra pantalla encima', async () => {
    const { rerender } = render(<RegaloPremium userId="persona-1" puedeMostrarse={false} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchSimulado).not.toHaveBeenCalledWith(expect.stringContaining('/visto'), expect.anything());

    rerender(<RegaloPremium userId="persona-1" puedeMostrarse />);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('no vuelve a salir en este dispositivo aunque el servidor no alcanzara a guardarlo', async () => {
    const primera = render(<RegaloPremium userId="persona-1" puedeMostrarse />);
    await screen.findByRole('dialog');
    primera.unmount();

    render(<RegaloPremium userId="persona-1" puedeMostrarse />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se cierra con el botón', async () => {
    const onCerrar = vi.fn();
    render(<RegaloPremium userId="persona-1" puedeMostrarse onCerrar={onCerrar} />);
    fireEvent.click(await screen.findByRole('button', { name: /A disfrutarlo/ }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('sin regalo pendiente no muestra nada', async () => {
    fetchSimulado.mockImplementation(async () => respuesta({ regalo: null }));
    render(<RegaloPremium userId="persona-1" puedeMostrarse />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
