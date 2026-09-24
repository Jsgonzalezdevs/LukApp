import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseData from '../data/supabase';
import { InvitacionPremium } from './InvitacionPremium';

const planNormal = {
  codigo: 'normal' as const,
  preciosPremium: { mensualCop: 9_900, anualCop: 79_900 },
  beneficiosPremium: [
    { clave: 'dictado' as const, titulo: 'Registro por voz', detalle: 'registros al mes', tipoValor: 'cupo' as const, limite: 300, activo: true },
    { clave: 'asesor_ia' as const, titulo: 'Asesor IA', detalle: 'consultas al mes', tipoValor: 'cupo' as const, limite: 60, activo: true },
    { clave: 'extracto' as const, titulo: 'Extractos PDF', detalle: 'extractos al mes', tipoValor: 'cupo' as const, limite: 12, activo: true },
  ],
};

const planConfiguradoPorSuperadmin = {
  codigo: 'premium' as const,
  preciosPremium: { mensualCop: 12_300, anualCop: 98_700 },
  beneficiosPremium: [
    { clave: 'dictado' as const, titulo: 'Registro por voz', detalle: 'registros al mes', tipoValor: 'cupo' as const, limite: 240, activo: true },
    { clave: 'asesor_ia' as const, titulo: 'Asesor IA', detalle: 'consultas al mes', tipoValor: 'cupo' as const, limite: 50, activo: true },
    { clave: 'extracto' as const, titulo: 'Extractos PDF', detalle: 'extractos al mes', tipoValor: 'cupo' as const, limite: 7, activo: true },
    { clave: 'espacios_compartidos' as const, titulo: 'Espacios compartidos', detalle: 'espacios para organizarte en compañía', tipoValor: 'cupo' as const, limite: 4, activo: true },
    { clave: 'integrantes_espacio' as const, titulo: 'Personas por espacio', detalle: 'personas que puedes invitar por espacio', tipoValor: 'cupo' as const, limite: null, activo: true },
    { clave: 'insights_ia' as const, titulo: 'Recomendaciones con IA', detalle: 'análisis mensuales personalizados', tipoValor: 'incluido' as const, limite: null, activo: true },
    { clave: 'pulso_premium' as const, titulo: 'Pulso Premium', detalle: 'margen diario y decisiones financieras', tipoValor: 'incluido' as const, limite: null, activo: false },
  ],
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

  it('la vista previa de superadmin refleja todos los valores y prestaciones vigentes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => planConfiguradoPorSuperadmin,
    }));
    render(<InvitacionPremium userId="vista-previa" puedeMostrarse vistaPrevia onVerOpciones={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('dialog', { name: 'Más espacio para tus finanzas, sin complicarlas.' })).toBeTruthy();
    expect(screen.getByText('240')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('∞')).toBeTruthy();
    expect(screen.getByText('Incluido')).toBeTruthy();
    expect(screen.getByText(/12[.,]300/)).toBeTruthy();
    expect(screen.getByText(/98[.,]700/)).toBeTruthy();
    expect(screen.queryByText('Pulso Premium')).toBeNull();
  });
});
