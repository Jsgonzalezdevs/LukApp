import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositorioIndexedDB } from './indexeddb';
import { RepositorioMemoria, instantaneaVacia } from './repositorio';
import { RepositorioConCola } from './repositorioConCola';
import { ColaCambios } from './colaCambios';
import type { Cajita, CajitaMovimiento } from './modelos';
import type { RevisionDudosa } from './revisiones';

const cuenta = (id: string): Cajita => ({ id, nombre: id, tipo: 'cuenta', icon: 'Wallet', metaCop: null, tasaEaPct: null, createdAt: '2026-10-20T00:00:00Z', archivedAt: null });
const movimiento = (id: string): CajitaMovimiento => ({ id, cajitaId: 'banco', kind: 'deposito', deltaCop: 1000, categoria: null, occurredOn: '2026-10-20', nota: '', createdAt: '2026-10-20T00:00:00Z' });
const revision = (id: string): RevisionDudosa => ({ id, tipo: 'documento', estado: 'pendiente', referenciaId: 'tx-1', titulo: 'Confirma la lectura', detalle: 'Revisa el monto', documento: 'octubre.pdf', resolucion: null, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('guardado financiero atómico', () => {
  it('actualiza una base existente de la versión anterior para crear la tienda de revisiones', async () => {
    const antigua = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('antes-de-revisiones', 6);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const nombre of ['transacciones', 'cajitas', 'cajitaMovimientos', 'metas', 'categorias', 'contactos', 'recurrentes']) {
          db.createObjectStore(nombre, { keyPath: 'id' });
        }
        db.createObjectStore('presupuestos', { keyPath: 'categoria' });
        db.createObjectStore('colaPendiente', { autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    antigua.close();

    const repo = new RepositorioIndexedDB('antes-de-revisiones');
    await repo.aplicarCambios({ guardar: { revisiones: [revision('documento:upgrade')] } });
    expect((await repo.cargarTodo()).revisiones).toEqual([revision('documento:upgrade')]);
  });

  it('revierte también las primeras escrituras si un registro no se puede almacenar', async () => {
    const repo = new RepositorioIndexedDB('atomico');
    await repo.guardarCajita(cuenta('original'));
    const invalida = { ...cuenta('no-guardada'), nombre: (() => 'no clonable') as unknown as string };
    await expect(repo.aplicarCambios({ reemplazar: { ...instantaneaVacia(), cajitas: [cuenta('primera'), invalida] } })).rejects.toThrow();
    expect((await repo.cargarTodo()).cajitas.map((c) => c.id)).toEqual(['original']);
  });

  it('conserva tanto el dato como su envío después de recrear el repositorio', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const remoto = new RepositorioMemoria();
    const repo = new RepositorioConCola(new RepositorioIndexedDB('durable'), remoto, new ColaCambios('durable'));
    await repo.aplicarCambios({ guardar: { cajitas: [cuenta('banco')], cajitaMovimientos: [movimiento('apertura')] } });
    const reabierto = new RepositorioConCola(new RepositorioIndexedDB('durable'), remoto, new ColaCambios('durable'));
    expect((await reabierto.cargarTodo()).cajitaMovimientos).toHaveLength(1);
    expect(await reabierto.cambiosPendientes()).toBe(1);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await reabierto.sincronizar();
    expect(await reabierto.cambiosPendientes()).toBe(0);
    expect((await remoto.cargarTodo()).cajitaMovimientos).toHaveLength(1);
  });

  it('mantiene revisiones documentales tras recargar y sincroniza su decisión', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const remoto = new RepositorioMemoria();
    const repo = new RepositorioConCola(new RepositorioIndexedDB('revisiones'), remoto, new ColaCambios('revisiones'));
    await repo.aplicarCambios({ guardar: { revisiones: [revision('documento:tx-1')] } });
    const reabierto = new RepositorioConCola(new RepositorioIndexedDB('revisiones'), remoto, new ColaCambios('revisiones'));
    expect((await reabierto.cargarTodo()).revisiones).toEqual([revision('documento:tx-1')]);

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await reabierto.sincronizar();
    expect((await remoto.cargarTodo()).revisiones).toEqual([revision('documento:tx-1')]);
    expect(await reabierto.cambiosPendientes()).toBe(0);
  });

  it('un rechazo de permisos no queda guardado localmente como si hubiera funcionado', async () => {
    const local = new RepositorioIndexedDB('rechazo');
    const remoto = new RepositorioMemoria();
    vi.spyOn(remoto, 'aplicarCambios').mockRejectedValue(new Error('Sin permiso'));
    const repo = new RepositorioConCola(local, remoto, new ColaCambios('rechazo'));
    await expect(repo.aplicarCambios({ guardar: { cajitas: [cuenta('rechazada')] } })).rejects.toThrow('Sin permiso');
    expect((await local.cargarTodo()).cajitas).toEqual([]);
    expect(await repo.cambiosPendientes()).toBe(0);
  });

  it('no deja el dato suelto si falla la creación del pendiente', async () => {
    const local = new RepositorioIndexedDB('cola-llena');
    const remoto = new RepositorioMemoria();
    vi.spyOn(local, 'confirmarPendiente').mockRejectedValue(new Error('Almacenamiento lleno'));
    const repo = new RepositorioConCola(local, remoto, new ColaCambios('cola-llena'));
    await expect(repo.guardarCajita(cuenta('sin-cola'))).rejects.toThrow('Almacenamiento lleno');
    expect((await local.cargarTodo()).cajitas).toEqual([]);
    expect((await remoto.cargarTodo()).cajitas).toEqual([]);
  });

  it('serializa escrituras y sincronizaciones simultáneas sin reenviar o perder cambios', async () => {
    const remoto = new RepositorioMemoria();
    const enviar = vi.spyOn(remoto, 'guardarCajita');
    const repo = new RepositorioConCola(new RepositorioIndexedDB('simultaneo'), remoto, new ColaCambios('simultaneo'));
    await Promise.all([repo.guardarCajita(cuenta('primera')), repo.sincronizar(), repo.guardarCajita(cuenta('segunda')), repo.sincronizar()]);
    expect((await repo.cargarTodo()).cajitas.map((c) => c.id).sort()).toEqual(['primera', 'segunda']);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(await repo.cambiosPendientes()).toBe(0);
  });

  it('conserva los cambios rechazados al sincronizar e informa el motivo', async () => {
    const remoto = new RepositorioMemoria();
    const repo = new RepositorioConCola(new RepositorioIndexedDB('sesion'), remoto, new ColaCambios('sesion'));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await repo.guardarCajita(cuenta('pendiente'));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.spyOn(remoto, 'guardarCajita').mockRejectedValue(new Error('Tu sesión venció.'));
    await repo.sincronizar();
    expect(repo.errorSincronizacion).toBe('Tu sesión venció.');
    expect(await repo.cambiosPendientes()).toBe(1);
    expect((await repo.cargarTodo()).cajitas[0].id).toBe('pendiente');
  });
});
