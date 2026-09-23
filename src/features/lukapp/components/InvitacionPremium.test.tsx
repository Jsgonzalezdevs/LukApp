import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseData from '../data/supabase';
import { InvitacionPremium } from './InvitacionPremium';

const planNormal = {
  codigo: 'normal' as const,
  preciosPremium: { mensualCop: 9_900, anualCop: 79_900 },
  limitesPremium: {
    dictadosMensual: 300,
    asesorIaMensual: 60,
    extractosMensual: 12,
    espaciosCompartidos: null,
    integrantesPorEspacio: null,
  },
};

const avanzarHastaInvitacion = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8_000);
  });
};

describe('InvitacionPremium', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-prueba' } } }) },
    } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => planNormal }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('solo aparece a una cuenta Normal y conduce a las opciones con precios reales', async () => {
    const onVerOpciones = vi.fn();
    render(<InvitacionPremium userId="persona-1" puedeMostrarse onVerOpciones={onVerOpciones} />);

    await avanzarHastaInvitacion();

    const dialogo = screen.getByRole('dialog', { name: 'Más espacio para tus finanzas, sin complicarlas.' });
    expect(dialogo).toBeTruthy();
    expect(dialogo.textContent).toMatch(/9[.,]900/);
    expect(screen.getByText('300')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ver planes y precios' }));
    expect(onVerOpciones).toHaveBeenCalledOnce();
    expect(localStorage.getItem('lukapp-proxima-invitacion-premium-v1:persona-1')).not.toBeNull();
  });

  it('no interrumpe a quien ya tiene Premium', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...planNormal, codigo: 'premium' }) }));
    render(<InvitacionPremium userId="persona-premium" puedeMostrarse onVerOpciones={vi.fn()} />);

    await avanzarHastaInvitacion();

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
