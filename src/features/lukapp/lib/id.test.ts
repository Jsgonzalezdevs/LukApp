import { afterEach, describe, expect, it, vi } from 'vitest';
import { nuevoId } from './id';

afterEach(() => vi.unstubAllGlobals());

describe('ids financieros', () => {
  it('mantiene UUID válidos cuando randomUUID no existe fuera de HTTPS', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(127); return bytes; } });
    expect(nuevoId('mov')).toBe('7f7f7f7f-7f7f-4f7f-bf7f-7f7f7f7f7f7f');
  });
  it('mantiene UUID válidos también en el repositorio de memoria sin crypto', () => {
    vi.stubGlobal('crypto', undefined);
    expect(nuevoId()).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  });
});
