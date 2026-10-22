import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RepositorioMemoria, instantaneaVacia } from './repositorio';
import { RepositorioIndexedDB, migrarLibroLocal } from './indexeddb';
import { RepositorioConCola } from './repositorioConCola';
import { ColaCambios } from './colaCambios';
import { useAlmacen } from './useAlmacen';
import type { Cajita } from './modelos';

const cuenta = (id: string): Cajita => ({ id, nombre: 'Banco de Bogotá', tipo: 'cuenta', icon: 'Wallet', metaCop: null, tasaEaPct: null, createdAt: '2026-10-22', archivedAt: null });

beforeEach(() => {
  indexedDB = new IDBFactory();
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('arranque con datos confirmados', () => {
  it('abre el caché del usuario sin llamar al servidor', async () => {
    const remoto = new RepositorioMemoria();
    const leerRemoto = vi.spyOn(remoto, 'cargarTodo');
    const repo = new RepositorioConCola(new RepositorioMemoria({ cajitas: [cuenta('guardada')] }), remoto, new ColaCambios('cache-inicial'));
    const inicial = await repo.cargarInicial();
    expect(inicial.desdeCache).toBe(true);
    expect(inicial.datos.cajitas[0].id).toBe('guardada');
    expect(leerRemoto).not.toHaveBeenCalled();
  });

  it('muestra la copia confirmada mientras la red responde y no inventa Efectivo', async () => {
    const repo = new RepositorioMemoria();
    const fresco = { ...instantaneaVacia(), cajitas: [cuenta('remota')] };
    let responder!: (datos: typeof fresco) => void;
    const enRed = new Promise<typeof fresco>((resolve) => { responder = resolve; });
    const inicial = Object.assign(repo, { cargarInicial: async () => ({ datos: { ...instantaneaVacia(), cajitas: [cuenta('local')] }, desdeCache: true }), cargarTodo: () => enRed });
    // Conserva los métodos del repositorio sin simular las escrituras.
    const sembrar = vi.spyOn(repo, 'guardarCajita');
    const { result } = renderHook(() => useAlmacen(inicial));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos.cajitas.map((c) => c.id)).toEqual(['local']);
    expect(sembrar).not.toHaveBeenCalled();
    await act(async () => { responder(fresco); await enRed; });
    await waitFor(() => expect(result.current.datos.cajitas[0].id).toBe('remota'));
  });

  it('no vuelve a enviar un respaldo local ya completado para ese usuario', async () => {
    const origen = new RepositorioIndexedDB('finanzas');
    await origen.guardarCajita(cuenta('antigua'));
    const destino = new RepositorioMemoria();
    const guardar = vi.spyOn(destino, 'guardarCajita');
    expect(await migrarLibroLocal(destino, 'usuario-a')).toBe(true);
    expect(await migrarLibroLocal(destino, 'usuario-a')).toBe(false);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('permite reintentar una migración fallida sin marcarla completa', async () => {
    await new RepositorioIndexedDB('finanzas').guardarCajita(cuenta('antigua'));
    const destino = new RepositorioMemoria();
    const guardar = vi.spyOn(destino, 'guardarCajita').mockRejectedValueOnce(new Error('Sin conexión'));
    await migrarLibroLocal(destino, 'usuario-b');
    await migrarLibroLocal(destino, 'usuario-b');
    expect(guardar).toHaveBeenCalledTimes(2);
    expect((await destino.cargarTodo()).cajitas[0].id).toBe('antigua');
  });
});

it('dos montajes simultáneos siembran una sola cuenta con la identidad estable', async () => {
  const repo = Object.assign(new RepositorioMemoria(), { obtenerIdEfectivoInicial: async () => '12345678-1234-8123-8123-123456789abc' });
  const primera = renderHook(() => useAlmacen(repo));
  const segunda = renderHook(() => useAlmacen(repo));
  await waitFor(() => {
    expect(primera.result.current.cargando).toBe(false);
    expect(segunda.result.current.cargando).toBe(false);
  });
  const efectivos = (await repo.cargarTodo()).cajitas.filter((c) => c.nombre === 'Efectivo');
  expect(efectivos).toHaveLength(1);
  expect(efectivos[0].id).toBe('12345678-1234-8123-8123-123456789abc');
});
