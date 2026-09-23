import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as supabaseData from '../data/supabase';
import { useAiInsights } from './useAiInsights';

const opciones = {
  transacciones: [],
  presupuestos: [],
  mesCalendario: '2026-09',
  nombreDe: () => 'Comida',
};

const sesion = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-prueba' } } }),
  },
};

const respuesta = (cuerpo: unknown, ok = true) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status: ok ? 200 : 403 }));

describe('useAiInsights — recomendaciones con IA', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('no solicita ni reutiliza insights IA para una cuenta Normal', async () => {
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue(sesion as never);
    const fetcher = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('/api/mi-plan')) return respuesta({ codigo: 'normal' });
      return respuesta({ success: true, insights: [{ id: 'no-deberia-llegar' }] });
    });
    vi.stubGlobal('fetch', fetcher);

    renderHook(() => useAiInsights(opciones));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toContain('/api/mi-plan');
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/api/finanzas-insights-ia'))).toBe(false);
  });

  it('solicita insights IA solo después de confirmar Premium', async () => {
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue(sesion as never);
    const fetcher = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('/api/mi-plan')) return respuesta({ codigo: 'premium' });
      return respuesta({
        success: true,
        insights: [{ id: 'premium-1', titulo: 'Vas bien', detalle: 'Sigue así', tono: 'bien', seccion: 'mes' }],
      });
    });
    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useAiInsights(opciones));

    await waitFor(() => expect(result.current.origenIa).toBe(true));
    const llamadaInsights = fetcher.mock.calls.find(([url]) => String(url).includes('/api/finanzas-insights-ia'));
    expect(llamadaInsights).toBeDefined();
    const cuerpo = llamadaInsights?.[1]?.body;
    expect(typeof cuerpo).toBe('string');
    expect(JSON.parse(cuerpo as string)).toEqual({});
  });
});
