import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cajita, CajitaTipo } from './modelos';
import type { RevisionDudosa } from './revisiones';
import type { DocumentoNegocio } from '../negocio/modelo';
import { ES_PASIVO } from './modelos';
import { RepositorioSupabase } from './repositorioSupabase';

const TIPOS = Object.keys(ES_PASIVO) as CajitaTipo[];

/** Minimal client that replays fixed rows, so the mappers can be exercised. */
const clienteCon = (cajitas: Record<string, unknown>[], transacciones: Record<string, unknown>[] = [], movimientos: Record<string, unknown>[] = []) => {
  const vacio = { data: [], error: null };
  const guardado: Record<string, unknown>[] = [];

  const cliente = {
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({ order: () => ({ range: () => Promise.resolve(tabla === 'cajitas' ? { data: cajitas, error: null } : tabla === 'transacciones' ? { data: transacciones, error: null } : tabla === 'cajita_movimientos' ? { data: movimientos, error: null } : vacio) }) }),
      }),
      upsert: (filas: Record<string, unknown> | Record<string, unknown>[]) => {
        guardado.push(...(Array.isArray(filas) ? filas : [filas]));
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as unknown as SupabaseClient;

  return { cliente, guardado };
};

const fila = (tipo: string) => ({
  id: `c-${tipo}`,
  nombre: tipo,
  emoji: 'PiggyBank',
  tipo,
  meta_cop: null,
  tasa_ea_pct: null,
  created_at: '2026-08-01T00:00:00.000Z',
  archived_at: null,
});

describe('RepositorioSupabase — el tipo de una cajita', () => {
  it('lee de vuelta CADA tipo tal como se guardó', async () => {
    // El fallo original: la lectura era `tipo === 'cuenta' ? 'cuenta' : 'cajita'`,
    // escrita cuando solo existían esos dos. Una tarjeta se guardaba bien y
    // volvía como cajita, así que una deuda creada en Deudas aparecía en Ahorro.
    const { cliente } = clienteCon(TIPOS.map((t) => fila(t)));

    const { cajitas } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(cajitas.map((c) => c.tipo).sort()).toEqual([...TIPOS].sort());
  });

  it('cubre todos los tipos que el modelo declara, no una lista aparte', () => {
    // Si mañana aparece un quinto tipo, este test lo exige sin que nadie
    // recuerde volver aquí.
    expect(TIPOS.length).toBeGreaterThanOrEqual(4);
    expect(TIPOS).toContain('deuda');
    expect(TIPOS).toContain('tarjeta');
  });

  it('cae en cajita solo ante un valor que de verdad no conoce', async () => {
    const { cliente } = clienteCon([fila('marciano')]);

    const { cajitas } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(cajitas[0].tipo).toBe('cajita');
  });

  it('escribe el tipo sin transformarlo', async () => {
    const { cliente, guardado } = clienteCon([]);
    const tarjeta: Cajita = {
      id: 'c1',
      nombre: 'Credito NU',
      icon: 'CreditCard',
      tipo: 'tarjeta',
      metaCop: null,
      tasaEaPct: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    };

    await new RepositorioSupabase(cliente, 'u1').guardarCajita(tarjeta);

    expect(guardado[0]).toMatchObject({ tipo: 'tarjeta', user_id: 'u1' });
  });
});

describe('RepositorioSupabase — activos multimoneda', () => {
  it('lee la moneda, tipo de activo y datos originales del movimiento', async () => {
    const { cliente } = clienteCon(
      [{ ...fila('cajita'), es_inversion: true, moneda: 'USD' }],
      [],
      [{ id: 'm1', cajita_id: 'c-cajita', kind: 'deposito', delta_cop: 42000, categoria: null, occurred_on: '2026-10-20', nota: '', created_at: '2026-10-20T12:00:00Z', monto_original: '10.5', moneda_original: 'USD', tasa_cambio_cop: '4000' }],
    );
    const { cajitas, cajitaMovimientos } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(cajitas[0]).toMatchObject({ esInversion: true, moneda: 'USD' });
    expect(cajitaMovimientos[0]).toMatchObject({ montoOriginal: 10.5, monedaOriginal: 'USD', tasaCambioCop: 4000, occurredOn: '2026-10-20' });
  });
});

describe('RepositorioSupabase — bandeja de revisión', () => {
  const revision: RevisionDudosa = {
    id: 'documento:tx-1', tipo: 'documento', estado: 'pendiente', referenciaId: 'tx-1',
    titulo: 'Confirma la lectura', detalle: 'Revisa el monto.', documento: 'octubre.pdf',
    resolucion: null, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
  };

  it('mapea decisiones guardadas al formato de la tabla dentro del lote atómico', async () => {
    const argumentos: unknown[][] = [];
    const rpc = vi.fn(async (...args: unknown[]) => { argumentos.push(args); return { error: null }; });
    const cliente = { rpc } as unknown as SupabaseClient;
    await new RepositorioSupabase(cliente, 'u1').aplicarCambios({ guardar: { revisiones: [revision] } });
    const parametros = argumentos[0]?.[1] as { cambios: { guardar: Record<string, unknown[]> } };
    const cambios = parametros.cambios;
    expect(cambios.guardar.revisiones_dudosas).toEqual([{
      id: revision.id, user_id: 'u1', tipo: 'documento', estado: 'pendiente',
      referencia_id: 'tx-1', titulo: 'Confirma la lectura', detalle: 'Revisa el monto.',
      documento: 'octubre.pdf', resolucion: null,
      created_at: revision.createdAt, updated_at: revision.updatedAt,
    }]);
  });

  it('lee los estados de revisión persistidos desde Supabase', async () => {
    const filaRevision = {
      id: revision.id, tipo: revision.tipo, estado: revision.estado,
      referencia_id: revision.referenciaId, titulo: revision.titulo, detalle: revision.detalle,
      documento: revision.documento, resolucion: revision.resolucion,
      created_at: revision.createdAt, updated_at: revision.updatedAt,
    };
    const cliente = {
      from: (tabla: string) => ({
        select: () => ({
          eq: () => ({ order: () => ({ range: async () => ({ data: tabla === 'revisiones_dudosas' ? [filaRevision] : [], count: 0, error: null }) }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    const datos = await new RepositorioSupabase(cliente, 'u1').cargarTodo();
    expect(datos.revisiones).toEqual([revision]);
  });
});

describe('RepositorioSupabase — documentos de negocio', () => {
  const documento: DocumentoNegocio = { id: '9ee4a012-0c4d-49c3-8ef3-e43a2d02dfe1', tipo: 'por_cobrar', estado: 'enviado', contraparte: 'Cliente', concepto: 'Diseño', totalCop: 50000, fecha: '2026-10-20', vence: null, abonos: [], cotizacionOrigenId: null };

  it('incluye registros de negocio en los lotes atómicos con propiedad de usuario', async () => {
    const rpc = vi.fn(async (..._args: unknown[]) => ({ error: null }));
    const cliente = { rpc } as unknown as SupabaseClient;
    await new RepositorioSupabase(cliente, 'u1').guardarDocumentosNegocio([documento]);
    const parametros = rpc.mock.calls[0]?.[1] as { cambios: { guardar: Record<string, unknown[]> } };
    expect(parametros.cambios.guardar.documentos_negocio?.[0]).toMatchObject({
      id: documento.id,
      user_id: 'u1',
      datos: documento,
    });
  });
});

describe('RepositorioSupabase — errores legibles', () => {
  it('lee como balance-afectante los registros anteriores y conserva la marca histórica', async () => {
    const base = {
      kind: 'gasto', amount_cop: 1000, category: 'comida', description: 'Café', occurred_on: '2025-01-01',
      cuenta_id: 'c1', raw_transcript: 'extracto', cuotas_total: null, cuota_cop: null, created_at: '2025-01-01T00:00:00.000Z',
    };
    const { cliente } = clienteCon([], [
      { ...base, id: 't-historico', afecta_saldo: false },
      { ...base, id: 't-legado' },
    ]);

    const { transacciones } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(transacciones.map((tx) => tx.afectaSaldo)).toEqual([false, true]);
  });

  it('persiste si una transacción histórica debe dejar intacto el saldo actual', async () => {
    const { cliente, guardado } = clienteCon([]);
    const base = {
      id: 't-hist', kind: 'gasto' as const, amountCop: 1000, category: 'comida', description: 'Café',
      occurredOn: '2025-01-01', cuentaId: 'c1', rawTranscript: 'extracto', createdAt: '2025-01-01T00:00:00.000Z',
    };

    await new RepositorioSupabase(cliente, 'u1').guardarTransacciones([
      { ...base, afectaSaldo: false },
      { ...base, id: 't-actual', afectaSaldo: true },
    ]);

    expect(guardado).toMatchObject([
      { id: 't-hist', afecta_saldo: false },
      { id: 't-actual', afecta_saldo: true },
    ]);
  });

  it('traduce una restricción de Postgres a algo accionable', async () => {
    const cliente = {
      from: () => ({
        upsert: () =>
          Promise.resolve({
            error: { message: 'violates check constraint "transacciones_amount_cop_check"' },
          }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      new RepositorioSupabase(cliente, 'u1').guardarTransacciones([
        {
          id: 't1',
          kind: 'gasto',
          amountCop: 0,
          category: 'otros',
          description: '',
          occurredOn: '2026-08-01',
          cuentaId: null,
          rawTranscript: '',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ]),
    ).rejects.toThrow('El monto debe ser mayor que cero.');
  });
});

describe('RepositorioSupabase — los fallos de sesión también hablan español', () => {
  /** Un cliente cuya única lectura con datos, `categorias`, falla como diga el test. */
  const clienteQueFalla = (mensaje: string) =>
    ({
      from: (tabla: string) => ({
        select: () => ({
          eq: () => ({ order: () => ({ range: () => Promise.resolve(
              tabla === 'categorias' ? { data: null, error: { message: mensaje } } : { data: [], error: null },
            ) }) }),
        }),
      }),
    }) as unknown as SupabaseClient;

  it('no deja salir «JWT issued at future» al banner', async () => {
    // Este es el error de la captura. `crearFetchTolerante` lo reintenta y casi
    // siempre lo absorbe; si el desfase es tan grande que ni esperando se cura,
    // lo que se lee tiene que seguir siendo una frase, no jerga en inglés.
    await expect(
      new RepositorioSupabase(clienteQueFalla('JWT issued at future'), 'u1').cargarTodo(),
    ).rejects.toThrow('La hora del servidor no coincide con la de tu sesión.');
  });

  it('distingue la sesión vencida del desfase de reloj', async () => {
    // Se parecen —los dos son el token— pero uno se arregla esperando y el otro
    // volviendo a entrar. Decir lo mismo en ambos casos manda a la persona a
    // hacer justo lo que no sirve.
    await expect(
      new RepositorioSupabase(clienteQueFalla('JWT expired'), 'u1').cargarTodo(),
    ).rejects.toThrow('Tu sesión venció. Vuelve a entrar.');
  });

  it('tampoco deja escapar el resto de la familia', async () => {
    await expect(
      new RepositorioSupabase(clienteQueFalla('JWSError JWSInvalidSignature'), 'u1').cargarTodo(),
    ).rejects.toThrow('Tu sesión ya no es válida. Vuelve a entrar.');
  });

  it('no se traga un error que nada tiene que ver con el token', async () => {
    // El comodín `/jwt|jws/` es ancho; si se comiera errores ajenos, un fallo
    // real quedaría disfrazado de sesión inválida y nadie lo encontraría.
    await expect(
      new RepositorioSupabase(clienteQueFalla('column "color" does not exist'), 'u1').cargarTodo(),
    ).rejects.toThrow('incompleta o desactualizada');
  });

  it('no llama base vacía a una base que solo tiene una migración atrasada', async () => {
    await expect(
      new RepositorioSupabase(clienteQueFalla('relation "public.contactos" does not exist'), 'u1').cargarTodo(),
    ).rejects.toThrow('incompleta o desactualizada');
  });

  it('traduce también una columna nueva que todavía no existe', async () => {
    await expect(
      new RepositorioSupabase(clienteQueFalla('column "cuenta_id" does not exist in schema cache'), 'u1').cargarTodo(),
    ).rejects.toThrow('incompleta o desactualizada');
  });

  it('identifica la migración de cuotas al guardar un comprobante', async () => {
    const cliente = {
      from: () => ({
        upsert: () => Promise.resolve({ error: { message: 'column "cuotas_total" does not exist in schema cache' } }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      new RepositorioSupabase(cliente, 'u1').guardarTransacciones([
        {
          id: 't-cuotas', kind: 'gasto', amountCop: 1000, category: 'otros',
          description: 'Comprobante', occurredOn: '2026-08-31', cuentaId: null,
          rawTranscript: '[OCR] Comprobante', cuotasTotal: 3, cuotaCop: 334,
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ]),
    ).rejects.toThrow('20260830190000_cuotas_tarjetas.sql');
  });

  it('envía cuotas como null en compras simples sin financiación', async () => {
    const guardado: Record<string, unknown>[] = [];
    const cliente = {
      from: () => ({
        upsert: (filas: Record<string, unknown> | Record<string, unknown>[]) => {
          guardado.push(...(Array.isArray(filas) ? filas : [filas]));
          return Promise.resolve({ error: null });
        },
      }),
    } as unknown as SupabaseClient;

    await new RepositorioSupabase(cliente, 'u1').guardarTransacciones([
      {
        id: 't-simple', kind: 'gasto', amountCop: 50000, category: 'otros',
        description: 'Compra simple', occurredOn: '2026-09-01', cuentaId: 'tarjeta-1',
        rawTranscript: '', cuotasTotal: 1, cuotaCop: 50000,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);

    expect(guardado[0]).toMatchObject({
      id: 't-simple',
      cuotas_total: null,
      cuota_cop: null,
    });
  });

  it('envía todos los rastros en una llamada atómica y comunica el rechazo', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'importe rechazado' } });
    const cliente = { rpc } as unknown as SupabaseClient;
    const mov = {
      id: 'm1', cajitaId: 'c1', kind: 'compra' as const, deltaCop: 50000,
      categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const tx = {
      id: 't1', kind: 'gasto' as const, amountCop: 50000, category: 'otros' as const,
      description: 'Compra', occurredOn: '2026-09-01', cuentaId: 'c1', rawTranscript: '',
      cuotasTotal: null, cuotaCop: null, createdAt: '2026-09-01T00:00:00.000Z',
    };

    await expect(
      new RepositorioSupabase(cliente, 'u1').guardarMovimientosConTransaccion([mov], tx),
    ).rejects.toThrow();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].cambios.guardar).toMatchObject({
      cajita_movimientos: [{ id: 'm1', user_id: 'u1' }],
      transacciones: [{ id: 't1', user_id: 'u1' }],
    });
  });

  it('borra el movimiento y la transacción en la misma operación', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const cliente = { rpc } as unknown as SupabaseClient;
    await new RepositorioSupabase(cliente, 'u1').borrarMovimientoConTransaccion('mov-1', 'tx-1');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].cambios.borrar).toEqual({ cajita_movimientos: ['mov-1'], transacciones: ['tx-1'] });
  });

  it('lee todo el historial aunque el servidor entregue páginas menores que las solicitadas', async () => {
    const filas = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, kind: 'ingreso', amount_cop: 1000, category: 'ingreso', description: '', occurred_on: '2026-10-20', cuenta_id: null, raw_transcript: '', created_at: '2026-10-20T00:00:00Z' }));
    const rangos: number[] = [];
    const cliente = { from: (tabla: string) => ({ select: () => ({ eq: () => ({ order: () => ({ range: async (desde: number) => {
      if (tabla !== 'transacciones') return { data: [], count: 0, error: null };
      rangos.push(desde);
      return { data: filas.slice(desde, desde + 2), count: filas.length, error: null };
    } }) }) }) }) } as unknown as SupabaseClient;
    const datos = await new RepositorioSupabase(cliente, 'u1').cargarTodo();
    expect(datos.transacciones).toHaveLength(7);
    expect(rangos).toEqual([0, 2, 4, 6]);
  });

});
