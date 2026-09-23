import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './visita';

const entornoOriginal = { ...process.env };
const fetchOriginal = globalThis.fetch;

afterEach(() => {
  for (const clave of Object.keys(process.env)) {
    if (!(clave in entornoOriginal)) delete process.env[clave];
  }
  Object.assign(process.env, entornoOriginal);
  globalThis.fetch = fetchOriginal;
});

describe('registro de visitas', () => {
  it('conserva la visita básica cuando las columnas opcionales aún no existen', async () => {
    process.env.VISITAS_SAL = 'sal-de-prueba';
    process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'clave-publica';

    const fetchSimulado = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    globalThis.fetch = fetchSimulado as typeof fetch;

    const respuesta = await handler(new Request('https://lukapp.app/api/visita', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '198.51.100.7',
      },
      body: JSON.stringify({
        ruta: '/portafolio',
        referente: 'https://www.linkedin.com/in/alguien',
        utm_source: 'linkedin',
        idioma: 'es-CO',
      }),
    }));

    expect(respuesta.status).toBe(204);
    expect(fetchSimulado).toHaveBeenCalledTimes(2);

    const segundoCuerpo = JSON.parse(String(fetchSimulado.mock.calls[1][1]?.body));
    expect(segundoCuerpo).toEqual({
      ruta: '/portafolio',
      referente: 'linkedin.com',
      pais: 'XX',
      dispositivo: 'escritorio',
      visitante: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
  });
});
