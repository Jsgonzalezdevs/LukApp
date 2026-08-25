import { describe, expect, it } from 'vitest';
import { monthKey, monthKeyLabel, shiftMonth } from './localDate';
import {
  CLAVE_TODO_EL_TIEMPO,
  claveDePeriodo,
  diasDelPeriodo,
  diasTranscurridosEnPeriodo,
  enElPeriodo,
  etiquetaDePeriodo,
  finDePeriodo,
  inicioDePeriodo,
  periodoAdyacente,
  type ConfigPeriodo,
} from './periodo';

const MENSUAL_PURO: ConfigPeriodo = { frecuencia: 'mensual', desfaseDiasMensual: 0 };
const SEMANAL: ConfigPeriodo = { frecuencia: 'semanal', desfaseDiasMensual: 0 };
const QUINCENAL: ConfigPeriodo = { frecuencia: 'quincenal', desfaseDiasMensual: 0 };
const QUINCENAS_MES: ConfigPeriodo = { frecuencia: 'quincenas-mes', desfaseDiasMensual: 0 };
const MENSUAL_DESFASE_4: ConfigPeriodo = { frecuencia: 'mensual', desfaseDiasMensual: 4 };
const TODO_EL_TIEMPO: ConfigPeriodo = { frecuencia: 'todo-el-tiempo', desfaseDiasMensual: 0 };

describe('mensual puro: idéntico byte a byte al comportamiento de antes de este módulo', () => {
  it('claveDePeriodo es exactamente monthKey()', () => {
    for (const fecha of ['2026-08-01', '2026-08-15', '2026-08-31', '2026-01-01', '2026-12-31']) {
      expect(claveDePeriodo(fecha, MENSUAL_PURO)).toBe(monthKey(fecha));
    }
  });

  it('etiquetaDePeriodo es exactamente monthKeyLabel()', () => {
    for (const clave of ['2026-01', '2026-08', '2026-12']) {
      expect(etiquetaDePeriodo(clave, MENSUAL_PURO)).toBe(monthKeyLabel(clave));
    }
  });

  it('periodoAdyacente es exactamente shiftMonth()', () => {
    expect(periodoAdyacente('2026-08', 1, MENSUAL_PURO)).toBe(shiftMonth('2026-08', 1));
    expect(periodoAdyacente('2026-08', -1, MENSUAL_PURO)).toBe(shiftMonth('2026-08', -1));
    expect(periodoAdyacente('2026-12', 1, MENSUAL_PURO)).toBe(shiftMonth('2026-12', 1));
    expect(periodoAdyacente('2026-01', -1, MENSUAL_PURO)).toBe(shiftMonth('2026-01', -1));
  });

  it('enElPeriodo coincide con la comparación monthKey(fecha) === mes de siempre', () => {
    expect(enElPeriodo('2026-08-15', '2026-08', MENSUAL_PURO)).toBe(true);
    expect(enElPeriodo('2026-08-01', '2026-08', MENSUAL_PURO)).toBe(true);
    expect(enElPeriodo('2026-08-31', '2026-08', MENSUAL_PURO)).toBe(true);
    expect(enElPeriodo('2026-07-31', '2026-08', MENSUAL_PURO)).toBe(false);
    expect(enElPeriodo('2026-09-01', '2026-08', MENSUAL_PURO)).toBe(false);
  });

  it('diasDelPeriodo coincide con los días reales del mes calendario', () => {
    expect(diasDelPeriodo('2026-08', MENSUAL_PURO)).toBe(31);
    expect(diasDelPeriodo('2026-04', MENSUAL_PURO)).toBe(30);
    expect(diasDelPeriodo('2026-02', MENSUAL_PURO)).toBe(28); // 2026 no es bisiesto
    expect(diasDelPeriodo('2024-02', MENSUAL_PURO)).toBe(29); // 2024 sí lo es
  });
});

describe('semanal', () => {
  it('inicioDePeriodo siempre cae en lunes, para cualquier día de la semana', () => {
    // 2026-08-17 es lunes; recorre los 7 días de esa semana.
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(Date.UTC(2026, 7, 17 + i)).toISOString().slice(0, 10);
      expect(inicioDePeriodo(fecha, SEMANAL)).toBe('2026-08-17');
    }
  });

  it('el período dura exactamente 7 días', () => {
    expect(finDePeriodo('2026-08-17', SEMANAL)).toBe('2026-08-23');
    expect(diasDelPeriodo('2026-08-17', SEMANAL)).toBe(7);
  });

  it('cruza el límite de mes correctamente', () => {
    // 2026-08-31 es lunes.
    expect(inicioDePeriodo('2026-08-31', SEMANAL)).toBe('2026-08-31');
    expect(finDePeriodo('2026-08-31', SEMANAL)).toBe('2026-09-06');
  });

  it('cruza el límite de año correctamente', () => {
    // 2026-12-28 es lunes.
    expect(inicioDePeriodo('2026-12-30', SEMANAL)).toBe('2026-12-28');
    expect(finDePeriodo('2026-12-28', SEMANAL)).toBe('2027-01-03');
  });

  it('periodoAdyacente avanza y retrocede exactamente una semana', () => {
    expect(periodoAdyacente('2026-08-17', 1, SEMANAL)).toBe('2026-08-24');
    expect(periodoAdyacente('2026-08-17', -1, SEMANAL)).toBe('2026-08-10');
  });

  it('enElPeriodo excluye el día justo antes y justo después', () => {
    const clave = '2026-08-17';
    expect(enElPeriodo('2026-08-16', clave, SEMANAL)).toBe(false);
    expect(enElPeriodo('2026-08-17', clave, SEMANAL)).toBe(true);
    expect(enElPeriodo('2026-08-23', clave, SEMANAL)).toBe(true);
    expect(enElPeriodo('2026-08-24', clave, SEMANAL)).toBe(false);
  });
});

describe('quincenal (cada 2 semanas, intervalo fijo)', () => {
  it('agrupa exactamente 14 días por período', () => {
    const inicio = inicioDePeriodo('2026-08-17', QUINCENAL);
    expect(diasDelPeriodo(inicio, QUINCENAL)).toBe(14);
  });

  it('dos lunes consecutivos caen en períodos distintos', () => {
    // Semanas consecutivas deben alternar: una es inicio de quincena, la otra no.
    const a = inicioDePeriodo('2026-08-17', QUINCENAL);
    const b = inicioDePeriodo('2026-08-24', QUINCENAL);
    expect(a).not.toBe(b);
  });

  it('periodoAdyacente avanza y retrocede exactamente 14 días', () => {
    const inicio = inicioDePeriodo('2026-08-17', QUINCENAL);
    const fin = finDePeriodo(inicio, QUINCENAL) as string;
    const siguiente = periodoAdyacente(inicio, 1, QUINCENAL);
    expect(siguiente).toBe(inicioDePeriodo(new Date(new Date(fin).getTime() + 86400000).toISOString().slice(0, 10), QUINCENAL));
  });

  it('el mismo lunes siempre resuelve al mismo inicio de quincena (determinista)', () => {
    expect(inicioDePeriodo('2026-08-17', QUINCENAL)).toBe(inicioDePeriodo('2026-08-17', QUINCENAL));
  });
});

describe('varias veces al mes (quincenas de calendario 1-15 / 16-fin)', () => {
  it('días 1 a 15 caen en la primera quincena', () => {
    expect(inicioDePeriodo('2026-08-01', QUINCENAS_MES)).toBe('2026-08-01');
    expect(inicioDePeriodo('2026-08-15', QUINCENAS_MES)).toBe('2026-08-01');
    expect(finDePeriodo('2026-08-01', QUINCENAS_MES)).toBe('2026-08-15');
  });

  it('días 16 al final caen en la segunda quincena, ajustada a los días reales del mes', () => {
    expect(inicioDePeriodo('2026-08-16', QUINCENAS_MES)).toBe('2026-08-16');
    expect(finDePeriodo('2026-08-16', QUINCENAS_MES)).toBe('2026-08-31'); // agosto tiene 31
    expect(finDePeriodo('2026-04-16', QUINCENAS_MES)).toBe('2026-04-30'); // abril tiene 30
    expect(finDePeriodo('2026-02-16', QUINCENAS_MES)).toBe('2026-02-28'); // febrero no bisiesto
    expect(finDePeriodo('2024-02-16', QUINCENAS_MES)).toBe('2024-02-29'); // 2024 sí es bisiesto
  });

  it('periodoAdyacente cruza de la primera a la segunda quincena del mismo mes', () => {
    expect(periodoAdyacente('2026-08-01', 1, QUINCENAS_MES)).toBe('2026-08-16');
  });

  it('periodoAdyacente cruza de la segunda quincena a la primera del mes siguiente', () => {
    expect(periodoAdyacente('2026-08-16', 1, QUINCENAS_MES)).toBe('2026-09-01');
  });

  it('claves distintas no se confunden entre sí (1-15 vs 16-fin)', () => {
    expect(claveDePeriodo('2026-08-10', QUINCENAS_MES)).not.toBe(claveDePeriodo('2026-08-20', QUINCENAS_MES));
  });
});

describe('mensual con desfase de inicio', () => {
  it('el período empieza el día (1 + desfase) del mes', () => {
    expect(inicioDePeriodo('2026-08-05', MENSUAL_DESFASE_4)).toBe('2026-08-05');
    expect(inicioDePeriodo('2026-08-20', MENSUAL_DESFASE_4)).toBe('2026-08-05');
  });

  it('una fecha ANTES del día de corte pertenece al período que empezó el mes anterior', () => {
    expect(inicioDePeriodo('2026-08-04', MENSUAL_DESFASE_4)).toBe('2026-07-05');
    expect(inicioDePeriodo('2026-08-01', MENSUAL_DESFASE_4)).toBe('2026-07-05');
  });

  it('el período termina el día anterior al próximo corte', () => {
    expect(finDePeriodo('2026-08-05', MENSUAL_DESFASE_4)).toBe('2026-09-04');
  });

  it('cruza el límite de año correctamente', () => {
    expect(inicioDePeriodo('2026-01-03', MENSUAL_DESFASE_4)).toBe('2025-12-05');
    expect(finDePeriodo('2025-12-05', MENSUAL_DESFASE_4)).toBe('2026-01-04');
  });

  it('desfase 0 se comporta exactamente igual que mensual puro (caso límite)', () => {
    expect(inicioDePeriodo('2026-08-15', { frecuencia: 'mensual', desfaseDiasMensual: 0 })).toBe('2026-08-01');
  });
});

describe('todo el tiempo', () => {
  it('claveDePeriodo siempre devuelve la misma constante, sin importar la fecha', () => {
    expect(claveDePeriodo('2020-01-01', TODO_EL_TIEMPO)).toBe(CLAVE_TODO_EL_TIEMPO);
    expect(claveDePeriodo('2030-12-31', TODO_EL_TIEMPO)).toBe(CLAVE_TODO_EL_TIEMPO);
  });

  it('enElPeriodo siempre es verdadero, para cualquier fecha', () => {
    expect(enElPeriodo('2000-01-01', CLAVE_TODO_EL_TIEMPO, TODO_EL_TIEMPO)).toBe(true);
    expect(enElPeriodo('2099-12-31', CLAVE_TODO_EL_TIEMPO, TODO_EL_TIEMPO)).toBe(true);
  });

  it('no tiene fin, ni total de días, ni días transcurridos', () => {
    expect(finDePeriodo(CLAVE_TODO_EL_TIEMPO, TODO_EL_TIEMPO)).toBeNull();
    expect(diasDelPeriodo(CLAVE_TODO_EL_TIEMPO, TODO_EL_TIEMPO)).toBeNull();
    expect(diasTranscurridosEnPeriodo(CLAVE_TODO_EL_TIEMPO, '2026-08-25', TODO_EL_TIEMPO)).toBeNull();
  });

  it('periodoAdyacente no se mueve -- no hay periodo siguiente ni anterior', () => {
    expect(periodoAdyacente(CLAVE_TODO_EL_TIEMPO, 1, TODO_EL_TIEMPO)).toBe(CLAVE_TODO_EL_TIEMPO);
    expect(periodoAdyacente(CLAVE_TODO_EL_TIEMPO, -1, TODO_EL_TIEMPO)).toBe(CLAVE_TODO_EL_TIEMPO);
  });

  it('etiquetaDePeriodo dice "Todo el tiempo"', () => {
    expect(etiquetaDePeriodo(CLAVE_TODO_EL_TIEMPO, TODO_EL_TIEMPO)).toBe('Todo el tiempo');
  });
});

describe('diasTranscurridosEnPeriodo', () => {
  it('en un período mensual en curso, es el día del mes de hoy', () => {
    expect(diasTranscurridosEnPeriodo('2026-08', '2026-08-15', MENSUAL_PURO)).toBe(15);
  });

  it('en un período ya cerrado, es el total de días del período (no más)', () => {
    expect(diasTranscurridosEnPeriodo('2026-07', '2026-08-15', MENSUAL_PURO)).toBe(31);
  });

  it('en un período semanal, cuenta desde el lunes de esa semana', () => {
    expect(diasTranscurridosEnPeriodo('2026-08-17', '2026-08-19', SEMANAL)).toBe(3); // lun,mar,mié
  });
});

describe('round-trip: avanzar y luego retroceder un período vuelve al punto de partida', () => {
  const configs: Array<[string, ConfigPeriodo]> = [
    ['semanal', SEMANAL],
    ['quincenal', QUINCENAL],
    ['quincenas-mes', QUINCENAS_MES],
    ['mensual puro', MENSUAL_PURO],
    ['mensual con desfase', MENSUAL_DESFASE_4],
  ];

  for (const [nombre, config] of configs) {
    it(`funciona para ${nombre}`, () => {
      const clave = claveDePeriodo('2026-08-20', config);
      const siguiente = periodoAdyacente(clave, 1, config);
      const vuelta = periodoAdyacente(siguiente, -1, config);
      expect(vuelta).toBe(clave);
    });
  }
});
