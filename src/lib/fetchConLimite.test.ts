import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConLimite } from './fetchConLimite';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('proveedores con plazo máximo', () => {
  it('conserva estado y cuerpo para interpretar errores del proveedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"cuota"}', { status: 429 })));
    const r = await fetchConLimite('https://example.test', {}, 1000);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'cuota' });
  });
  it.each(['cabeceras', 'cuerpo'])('limita un bloqueo de %s aunque el transporte ignore abort', async etapa => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => {
      signal = init.signal;
      return etapa === 'cabeceras' ? new Promise(() => {}) : Promise.resolve({ arrayBuffer: () => new Promise(() => {}) });
    }));
    const resultado = fetchConLimite('https://example.test', {}, 1000);
    const verificar = expect(resultado).rejects.toThrow('tiempo-agotado');
    await vi.advanceTimersByTimeAsync(1000);
    await verificar;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
