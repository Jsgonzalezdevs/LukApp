import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseData from '../data/supabase';
import { CLAVES_BENEFICIO_PLAN } from '../../../../server_lib/suscripciones';
import { GUIA_BENEFICIOS } from '../lib/guiaBeneficiosPremium';
import { BeneficiosPremium } from './BeneficiosPremium';

const beneficio = (clave: string, titulo: string, extra: Record<string, unknown> = {}) => ({
  clave,
  titulo,
  detalle: 'al mes',
  tipoValor: 'cupo',
  limite: 50,
  activo: true,
  ...extra,
});

const planPremium = {
  codigo: 'premium',
  beneficiosPremium: [
    beneficio('dictado', 'Registro por voz', { limite: 200, detalle: 'registros al mes' }),
    beneficio('asesor_ia', 'Asesor IA', { limite: null, detalle: 'consultas al mes' }),
    beneficio('pulso_premium', 'Pulso Premium', { tipoValor: 'incluido', limite: null, detalle: 'margen diario' }),
    beneficio('extracto', 'Extractos PDF', { activo: false }),
  ],
  suscripcion: { ciclo: 'cortesia', venceEn: '2026-12-08T04:59:59.000Z' },
};

const respuesta = (cuerpo: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => cuerpo });

describe('BeneficiosPremium', () => {
  let fetchSimulado: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-prueba' } } }) },
    } as never);
    fetchSimulado = vi.fn(async () => respuesta(planPremium));
    vi.stubGlobal('fetch', fetchSimulado);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cada beneficio que puede dar el servidor tiene su explicación', () => {
    for (const clave of CLAVES_BENEFICIO_PLAN) expect(GUIA_BENEFICIOS[clave]?.explicacion).toBeTruthy();
  });

  it('muestra solo los beneficios activos, con su cupo y el vencimiento del regalo', async () => {
    render(<BeneficiosPremium onCerrar={vi.fn()} />);

    const lista = await screen.findByRole('list');
    const tarjetas = within(lista).getAllByRole('listitem');
    expect(tarjetas).toHaveLength(3);
    expect(lista.textContent).toContain('200');
    expect(lista.textContent).toContain('Sin límite');
    expect(lista.textContent).toContain('Incluido');
    expect(lista.textContent).not.toContain('Extractos PDF');

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.textContent).toContain('Regalo del equipo');
    expect(dialogo.textContent).toContain('7 de diciembre de 2026');
    expect(dialogo.textContent).toContain('¿Me van a cobrar algo?');
  });

  it('lleva a probar cada beneficio en su sitio de la app', async () => {
    const onIrA = vi.fn();
    render(<BeneficiosPremium onCerrar={vi.fn()} onIrA={onIrA} />);

    fireEvent.click(await screen.findByRole('button', { name: /Hablar con el Asesor/ }));
    expect(onIrA).toHaveBeenCalledWith({ tipo: 'seccion', id: 'asesor' });
  });

  it('a quien aún no es Premium le ofrece los planes en vez de los atajos', async () => {
    fetchSimulado.mockResolvedValue(respuesta({ ...planPremium, codigo: 'normal', suscripcion: null }));
    const onVerPlanes = vi.fn();
    render(<BeneficiosPremium onCerrar={vi.fn()} onIrA={vi.fn()} onVerPlanes={onVerPlanes} />);

    fireEvent.click(await screen.findByRole('button', { name: /Ver planes y precios/ }));
    expect(onVerPlanes).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Hablar con el Asesor/ })).toBeNull();
    expect(screen.queryByText('¿Me van a cobrar algo?')).toBeNull();
  });

  it('si falla la consulta deja reintentar', async () => {
    fetchSimulado.mockResolvedValueOnce(respuesta({}, false));
    render(<BeneficiosPremium onCerrar={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('list')).toBeTruthy();
  });

  it('se cierra con Escape y con Volver', async () => {
    const onCerrar = vi.fn();
    render(<BeneficiosPremium onCerrar={onCerrar} />);
    await screen.findByRole('list');

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Volver/ }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});
