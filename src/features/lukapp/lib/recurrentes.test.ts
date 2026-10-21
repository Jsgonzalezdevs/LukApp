import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  comoTransaccion,
  detectarSuscripciones,
  fechaEnMes,
  pendientesDelMes,
  proximosRecurrentes,
  totalMensual,
  yaRegistrado,
} from './recurrentes';
import type { Recurrente } from './recurrentes';

const rec = (over: Partial<Recurrente> = {}): Recurrente => ({
  id: 'r1',
  nombre: 'Arriendo',
  kind: 'gasto',
  amountCop: 1_200_000,
  categoria: 'hogar',
  cuentaId: 'nequi',
  diaDelMes: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 1_200_000,
  category: 'hogar',
  description: 'Arriendo',
  occurredOn: '2026-08-05',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-05T00:00:00.000Z',
  ...over,
});

describe('fechaEnMes', () => {
  it('usa el día configurado', () => {
    expect(fechaEnMes(rec({ diaDelMes: 5 }), '2026-08')).toBe('2026-08-05');
  });

  it('el día 31 en febrero cae el 28, no se salta el mes', () => {
    // Quien paga el arriendo el último día lo paga igual en febrero.
    expect(fechaEnMes(rec({ diaDelMes: 31 }), '2026-02')).toBe('2026-02-28');
  });

  it('el 31 en un mes de 30 cae el 30', () => {
    expect(fechaEnMes(rec({ diaDelMes: 31 }), '2026-04')).toBe('2026-04-30');
  });

  it('un día imposible se acomoda en vez de romper', () => {
    expect(fechaEnMes(rec({ diaDelMes: 0 }), '2026-08')).toBe('2026-08-01');
    expect(fechaEnMes(rec({ diaDelMes: 99 }), '2026-08')).toBe('2026-08-31');
  });
});

describe('yaRegistrado', () => {
  it('reconoce el movimiento aunque lo hayan escrito distinto', () => {
    // Se compara por monto, tipo y categoría: si se comparara la descripción,
    // registrarlo a mano con otro texto haría que la app lo volviera a proponer
    // y el arriendo quedaría cobrado dos veces.
    expect(yaRegistrado(rec(), [tx({ description: 'pago apto agosto' })], '2026-08')).toBe(true);
  });

  it('no lo confunde con otro mes', () => {
    expect(yaRegistrado(rec(), [tx({ occurredOn: '2026-07-05' })], '2026-08')).toBe(false);
  });

  it('no lo confunde con un monto distinto', () => {
    expect(yaRegistrado(rec(), [tx({ amountCop: 900_000 })], '2026-08')).toBe(false);
  });

  it('no confunde un ingreso con un gasto del mismo monto', () => {
    expect(yaRegistrado(rec(), [tx({ kind: 'ingreso' })], '2026-08')).toBe(false);
  });
});

describe('pendientesDelMes', () => {
  it('propone lo que ya llegó su día y falta', () => {
    const p = pendientesDelMes([rec()], [], '2026-08', '2026-08-10');

    expect(p).toHaveLength(1);
    expect(p[0].fecha).toBe('2026-08-05');
    expect(p[0].vencido).toBe(true);
  });

  it('NO propone lo que todavía no ha llegado', () => {
    // Ofrecer el arriendo del 30 estando a 3 invita a registrarlo antes de que
    // ocurra, y un libro adelantado es tan inútil como uno atrasado.
    expect(pendientesDelMes([rec({ diaDelMes: 30 })], [], '2026-08', '2026-08-03')).toEqual([]);
  });

  it('el mismo día sí cuenta', () => {
    expect(pendientesDelMes([rec({ diaDelMes: 10 })], [], '2026-08', '2026-08-10')).toHaveLength(1);
  });

  it('no propone lo que ya está registrado', () => {
    expect(pendientesDelMes([rec()], [tx()], '2026-08', '2026-08-10')).toEqual([]);
  });

  it('ignora los archivados', () => {
    const p = pendientesDelMes(
      [rec({ archivedAt: '2026-07-01T00:00:00.000Z' })],
      [],
      '2026-08',
      '2026-08-10',
    );

    expect(p).toEqual([]);
  });

  it('pone primero lo más atrasado', () => {
    const p = pendientesDelMes(
      [rec({ id: 'a', diaDelMes: 15 }), rec({ id: 'b', diaDelMes: 2, amountCop: 50_000 })],
      [],
      '2026-08',
      '2026-08-20',
    );

    expect(p.map((x) => x.recurrente.id)).toEqual(['b', 'a']);
  });
});

describe('comoTransaccion', () => {
  it('lleva la fecha del recurrente, no la de hoy', () => {
    // El arriendo del 5 se registra el 5 aunque se confirme el 20.
    const p = pendientesDelMes([rec()], [], '2026-08', '2026-08-20')[0];
    const t = comoTransaccion(p, 'nuevo', '2026-08-20T10:00:00.000Z');

    expect(t.occurredOn).toBe('2026-08-05');
    expect(t.createdAt).toBe('2026-08-20T10:00:00.000Z');
  });

  it('copia monto, tipo, categoría y cuenta', () => {
    const p = pendientesDelMes([rec()], [], '2026-08', '2026-08-20')[0];
    const t = comoTransaccion(p, 'nuevo', '2026-08-20T10:00:00.000Z');

    expect(t).toMatchObject({
      kind: 'gasto',
      amountCop: 1_200_000,
      category: 'hogar',
      cuentaId: 'nequi',
      description: 'Arriendo',
    });
  });

  it('deja dicho que vino de un recurrente', () => {
    // Si mañana cambia el monto, se puede ver cuáles venían de la plantilla vieja.
    const p = pendientesDelMes([rec()], [], '2026-08', '2026-08-20')[0];

    expect(comoTransaccion(p, 'n', 'x').rawTranscript).toMatch(/Recurrente/);
  });
});

describe('totalMensual', () => {
  it('separa lo que sale de lo que entra', () => {
    const t = totalMensual([
      rec({ id: 'a', amountCop: 1_200_000 }),
      rec({ id: 'b', amountCop: 40_000 }),
      rec({ id: 'c', kind: 'ingreso', amountCop: 3_000_000 }),
    ]);

    expect(t).toEqual({ gastoCop: 1_240_000, ingresoCop: 3_000_000 });
  });

  it('no cuenta los archivados', () => {
    const t = totalMensual([rec({ archivedAt: '2026-07-01T00:00:00.000Z' })]);

    expect(t).toEqual({ gastoCop: 0, ingresoCop: 0 });
  });
});

describe('detectarSuscripciones', () => {
  const tresMeses = [
    tx({ id: 't1', description: 'NETFLIX.COM', occurredOn: '2026-07-08', amountCop: 29_900, category: 'entretenimiento' }),
    tx({ id: 't2', description: 'NETFLIX.COM', occurredOn: '2026-08-08', amountCop: 29_900, category: 'entretenimiento' }),
    tx({ id: 't3', description: 'NETFLIX.COM', occurredOn: '2026-09-08', amountCop: 31_900, category: 'entretenimiento' }),
  ];

  it('sugiere un cobro parecido en tres meses seguidos sin registrarlo', () => {
    const sugerencias = detectarSuscripciones(tresMeses, [], '2026-09-10');
    expect(sugerencias).toHaveLength(1);
    expect(sugerencias[0]).toMatchObject({
      nombre: 'NETFLIX.COM', amountCop: 31_900, promedioCop: 30_567, diaDelMes: 8,
      meses: 3, cambioPrecio: false, recurrenteExistente: null,
    });
  });

  it('propone revisar el precio de un pago fijo existente, sin cambiarlo automáticamente', () => {
    const sugerencias = detectarSuscripciones(tresMeses, [rec({ nombre: 'NETFLIX.COM', amountCop: 25_000 })], '2026-09-10');
    expect(sugerencias).toHaveLength(1);
    expect(sugerencias[0]).toMatchObject({ cambioPrecio: true, recurrenteExistente: { amountCop: 25_000 }, amountCop: 31_900 });
  });

  it('ignora transferencias propias, filas históricas y patrones con huecos mensuales', () => {
    const noElegibles = tresMeses.map((fila) => ({ ...fila, kind: 'transferencia' as const }));
    expect(detectarSuscripciones(noElegibles, [], '2026-09-10')).toEqual([]);
    expect(detectarSuscripciones(tresMeses.map((fila) => ({ ...fila, afectaSaldo: false })), [], '2026-09-10')).toEqual([]);
    expect(detectarSuscripciones([
      tresMeses[0], tresMeses[2], { ...tresMeses[2], id: 't4', occurredOn: '2026-09-08' },
    ], [], '2026-09-10')).toEqual([]);
  });

  it('no vuelve a sugerir un pago fijo con precio vigente', () => {
    expect(detectarSuscripciones(tresMeses, [rec({ nombre: 'NETFLIX.COM', amountCop: 31_900 })], '2026-09-10')).toEqual([]);
  });
});

describe('proximosRecurrentes', () => {
  it('muestra las fechas de cobro de los próximos 60 días y omite ingresos/archivados', () => {
    const resultado = proximosRecurrentes([
      rec({ id: 'hoy', diaDelMes: 10 }),
      rec({ id: 'siguiente', diaDelMes: 5, amountCop: 40_000 }),
      rec({ id: 'ingreso', kind: 'ingreso' }),
      rec({ id: 'archivo', archivedAt: '2026-01-01' }),
    ], '2026-09-10');
    expect(resultado.map(({ recurrente, fecha }) => [recurrente.id, fecha])).toEqual([
      ['hoy', '2026-09-10'], ['siguiente', '2026-10-05'], ['hoy', '2026-10-10'], ['siguiente', '2026-11-05'],
    ]);
  });
});
