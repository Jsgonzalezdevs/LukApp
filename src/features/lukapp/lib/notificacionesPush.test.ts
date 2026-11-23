import { afterEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn(async () => ({ error: null }));
vi.mock('../data/supabase', () => ({
  obtenerSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({ upsert }),
  }),
}));

const prepararNavegador = (existente: unknown) => {
  const subscribe = vi.fn(async () => ({ endpoint: 'https://push/nueva', toJSON: () => ({ endpoint: 'https://push/nueva' }) }));
  const pushManager = { getSubscription: vi.fn(async () => existente), subscribe };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
  return { subscribe };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  upsert.mockClear();
});

describe('notificaciones push', () => {
  it('sin llave VAPID en el build no suscribe y lo dice', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { activarNotificacionesPush, pushConfigurado } = await import('./notificacionesPush');
    expect(pushConfigurado()).toBe(false);
    expect(await activarNotificacionesPush()).toBe(false);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('VITE_VAPID_PUBLIC_KEY'));
    aviso.mockRestore();
  });

  it('reutiliza la suscripción del aparato y la vuelve a guardar', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BElAvePublicaDePrueba');
    const existente = { endpoint: 'https://push/vieja', toJSON: () => ({ endpoint: 'https://push/vieja' }) };
    const { subscribe } = prepararNavegador(existente);
    const { activarNotificacionesPush } = await import('./notificacionesPush');
    expect(await activarNotificacionesPush()).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', endpoint: 'https://push/vieja' }),
      { onConflict: 'user_id,endpoint' },
    );
  });

  it('si el navegador rechaza la suscripción devuelve false en vez de romper', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BElAvePublicaDePrueba');
    const { subscribe } = prepararNavegador(null);
    subscribe.mockRejectedValueOnce(new Error('denegado'));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { activarNotificacionesPush } = await import('./notificacionesPush');
    expect(await activarNotificacionesPush()).toBe(false);
    aviso.mockRestore();
  });
});
