import { describe, expect, it } from 'vitest';
import { urlSupabaseDelServidor } from './configuracionSupabase.ts';

describe('urlSupabaseDelServidor', () => {
  it('prioriza la URL del servidor si quedó una URL antigua de Vite', () => {
    expect(urlSupabaseDelServidor({
      SUPABASE_URL: 'https://actual.supabase.co',
      VITE_SUPABASE_URL: 'https://anterior.supabase.co',
    })).toBe('https://actual.supabase.co');
  });

  it('conserva compatibilidad local si solo existe VITE_SUPABASE_URL', () => {
    expect(urlSupabaseDelServidor({ VITE_SUPABASE_URL: ' https://local.supabase.co ' }))
      .toBe('https://local.supabase.co');
  });

  it('indica que falta configuración cuando no hay URL', () => {
    expect(urlSupabaseDelServidor({})).toBeNull();
  });
});
