import { describe, expect, it } from 'vitest';
import { construirPerfilFinancieroCompleto } from './perfilAsesor';
import { detectarHallazgos, elegirHallazgo, esCharlaBreve, hallazgoDePregunta, seguimientosDeRespaldo } from './hallazgoAsesor';
import { resolverBloquesAsesor } from './resolverBloquesAsesor';
import { extraerPropuestaModelo, extraerSeguimientosModelo, leerRespuestaVisual, serializarRespuestaVisual } from '../src/lib/bloquesAsesor';

const base = {
  cajitas: [{ id: 'nequi', nombre: 'Nequi', tipo: 'cuenta' }],
  categorias: [],
  movimientosCajitas: [],
  recurrentes: [],
};

// El caso de la captura: casi todo el gasto del mes se fue a Salud.
const perfilSalud = construirPerfilFinancieroCompleto({
  ...base,
  transacciones: [
    { occurred_on: '2026-10-05', kind: 'ingreso', amount_cop: 750_000, category: 'Salario', cuenta_id: 'nequi' },
    { occurred_on: '2026-10-08', kind: 'gasto', amount_cop: 40_000, category: 'Salud', cuenta_id: 'nequi' },
    { occurred_on: '2026-10-09', kind: 'gasto', amount_cop: 30_000, category: 'Comida', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-02', kind: 'ingreso', amount_cop: 750_000, category: 'Salario', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-03', kind: 'gasto', amount_cop: 340_000, category: 'Salud', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-04', kind: 'gasto', amount_cop: 13_400, category: 'Comida', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-05', kind: 'gasto', amount_cop: 6_000, category: 'Transporte', cuenta_id: 'nequi' },
  ],
  metas: [],
  presupuestos: [],
});

describe('detectarHallazgos', () => {
  it('nota que una categoría se disparó frente al mes anterior, con cifras reales', () => {
    const [primero] = detectarHallazgos(perfilSalud, '2026-11-24');
    expect(primero.id).toBe('salto:salud:2026-11');
    expect(primero.titulo).toBe('Salud subió 750 % frente a octubre');
    expect(primero.detalle).toContain('$40.000');
    expect(primero.detalle).toContain('$340.000');
  });

  it('también ve la concentración, el sobrante sin meta y la falta de topes', () => {
    const ids = detectarHallazgos(perfilSalud, '2026-11-24').map((hallazgo) => hallazgo.id);
    expect(ids).toEqual(expect.arrayContaining(['concentracion:salud:2026-11', 'sobrante-sin-meta:2026-11', 'sin-presupuestos']));
  });

  it('avisa primero de un presupuesto pasado en el mes en curso', () => {
    const perfil = construirPerfilFinancieroCompleto({
      ...base,
      transacciones: [
        { occurred_on: '2026-11-02', kind: 'ingreso', amount_cop: 1_000_000, category: 'Salario', cuenta_id: 'nequi' },
        { occurred_on: '2026-11-03', kind: 'gasto', amount_cop: 260_000, category: 'Comida', cuenta_id: 'nequi' },
      ],
      metas: [],
      presupuestos: [{ categoria: 'Comida', monto_cop: 200_000 }],
    });
    const [primero] = detectarHallazgos(perfil, '2026-11-24');
    expect(primero).toMatchObject({ id: 'presupuesto-pasado:comida:2026-11', tono: 'atento', titulo: 'Te pasaste del tope de Comida' });
    // Un tope de un mes que ya pasó no se comenta.
    expect(detectarHallazgos(perfil, '2026-12-03').some((hallazgo) => hallazgo.id.startsWith('presupuesto'))).toBe(false);
  });

  it('celebra una meta casi cumplida', () => {
    const perfil = construirPerfilFinancieroCompleto({
      ...base,
      transacciones: [],
      metas: [{ nombre: 'Viaje', objetivo_cop: 1_000_000, ahorrado_cop: 800_000 }],
      presupuestos: [],
    });
    expect(detectarHallazgos(perfil, '2026-11-24')).toEqual([
      expect.objectContaining({ id: 'meta-cerca:viaje', tono: 'bien', titulo: 'Tu meta «Viaje» va en el 80 %' }),
    ]);
  });

  it('sin expediente no hay nada que notar', () => {
    expect(detectarHallazgos(null, '2026-11-24')).toEqual([]);
  });
});

describe('elegirHallazgo', () => {
  it('no repite uno que la persona ya vio en la conversación', () => {
    const elegido = elegirHallazgo(perfilSalud, '2026-11-24', ['salto:salud:2026-11'], []);
    expect(elegido?.id).toBe('concentracion:salud:2026-11');
  });

  it('se calla si el modelo ya puso una alerta', () => {
    expect(elegirHallazgo(perfilSalud, '2026-11-24', [], [{ tipo: 'alerta', tono: 'atento', titulo: 'Ojo', detalle: 'Algo.' }])).toBeNull();
  });
});

describe('esCharlaBreve', () => {
  it('reconoce saludos y agradecimientos, no preguntas reales', () => {
    expect(esCharlaBreve('¡Hola Luki!')).toBe(true);
    expect(esCharlaBreve('muchas gracias')).toBe(true);
    expect(esCharlaBreve('Hola, ¿cómo voy este mes con mis gastos de comida?')).toBe(false);
    expect(esCharlaBreve('Dame un resumen')).toBe(false);
  });
});

describe('seguimientos', () => {
  it('lee los del modelo, recortados, sin repetidos y sin la pregunta que ya hizo', () => {
    const crudo = JSON.stringify({ texto: 'Ok', seguimientos: ['¿Cómo bajo lo de Salud?', '¿como bajo lo de salud', 'Dame mi resumen', '¿Qué es Supabase?', 'Ayúdame a crear una meta', 'Otra más'] });
    expect(extraerSeguimientosModelo(crudo, ['Dame mi resumen'])).toEqual([
      '¿Cómo bajo lo de Salud?',
      'Ayúdame a crear una meta',
      'Otra más',
    ]);
  });

  it('si el modelo no los trae, salen de lo que mostró la respuesta', () => {
    const bloques = resolverBloquesAsesor([{ tipo: 'cifras' }, { tipo: 'barras_categorias' }], perfilSalud);
    expect(seguimientosDeRespaldo(bloques, null)).toEqual([
      '¿Cuánto puedo ahorrar este mes?',
      '¿Cómo bajo lo de Salud?',
      '¿Cuánto puedo gastar al día?',
    ]);
  });

  it('sobreviven al viaje por la base de datos junto con el hallazgo', () => {
    const hallazgo = elegirHallazgo(perfilSalud, '2026-11-24', [], [])!;
    const guardado = serializarRespuestaVisual({ texto: 'Hola', bloques: [], seguimientos: ['¿Y el mes pasado?'], hallazgo });
    expect(leerRespuestaVisual(guardado)).toEqual({ texto: 'Hola', bloques: [], seguimientos: ['¿Y el mes pasado?'], hallazgo });
  });
});

describe('propuestas', () => {
  it('el tope propuesto sale de los meses normales, con holgura, y no del mes atípico', () => {
    const concentracion = detectarHallazgos(perfilSalud, '2026-11-24').find((hallazgo) => hallazgo.id.startsWith('concentracion'));
    // Octubre: 40.000 en Salud → +10 % → 44.000 → se redondea a 50.000.
    expect(concentracion?.propuesta).toEqual({ tipo: 'presupuesto', categoria: 'Salud', montoCop: 50_000 });
  });

  it('el sobrante sin meta propone un fondo de emergencia de tres meses de gasto', () => {
    const sobrante = detectarHallazgos(perfilSalud, '2026-11-24').find((hallazgo) => hallazgo.id.startsWith('sobrante'));
    // Promedio de octubre (70.000) y noviembre (359.400) = 214.700 × 3 → 700.000.
    expect(sobrante?.propuesta).toEqual({ tipo: 'meta', nombre: 'Fondo de emergencia', objetivoCop: 700_000, fechaObjetivo: null });
  });

  it('reconoce la pregunta de un hallazgo aunque cambien tildes o signos', () => {
    expect(hallazgoDePregunta(perfilSalud, '2026-11-24', 'ayudame a ponerle tope a salud')?.id).toBe('concentracion:salud:2026-11');
    expect(hallazgoDePregunta(perfilSalud, '2026-11-24', 'Dame mi resumen')).toBeNull();
  });

  it('acepta la propuesta del modelo solo si está completa', () => {
    expect(extraerPropuestaModelo(JSON.stringify({ texto: 'x', propuesta: { tipo: 'presupuesto', categoria: 'Comida', montoCop: 300000.4 } })))
      .toEqual({ tipo: 'presupuesto', categoria: 'Comida', montoCop: 300_000 });
    expect(extraerPropuestaModelo(JSON.stringify({ texto: 'x', propuesta: { tipo: 'meta', nombre: 'Viaje', objetivoCop: 2_000_000, fechaObjetivo: 'pronto' } })))
      .toEqual({ tipo: 'meta', nombre: 'Viaje', objetivoCop: 2_000_000, fechaObjetivo: null });
    expect(extraerPropuestaModelo(JSON.stringify({ texto: 'x', propuesta: { tipo: 'presupuesto', categoria: 'Comida', montoCop: -5 } }))).toBeNull();
    expect(extraerPropuestaModelo(JSON.stringify({ texto: 'x', propuesta: { tipo: 'borrar_todo' } }))).toBeNull();
  });
});
