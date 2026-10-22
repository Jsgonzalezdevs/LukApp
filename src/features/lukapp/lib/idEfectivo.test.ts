import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { idEfectivoParaUsuario } from './id';
import { RepositorioSupabase } from '../data/repositorioSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('identidad del Efectivo automático', () => {
  it('dos dispositivos del mismo usuario obtienen la misma clave primaria', async () => {
    vi.stubGlobal('crypto', webcrypto);
    try {
      const dispositivoA = new RepositorioSupabase({} as SupabaseClient, 'usuario-a');
      const dispositivoB = new RepositorioSupabase({} as SupabaseClient, 'usuario-a');
      const [a, b, otro] = await Promise.all([dispositivoA.obtenerIdEfectivoInicial(), dispositivoB.obtenerIdEfectivoInicial(), idEfectivoParaUsuario('usuario-b')]);
      expect(a).toBe(b);
      expect(a).not.toBe(otro);
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally { vi.unstubAllGlobals(); }
  });
});
