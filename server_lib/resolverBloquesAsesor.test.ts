import { describe, expect, it } from 'vitest';
import { construirPerfilFinancieroCompleto } from './perfilAsesor';
import { resolverBloquesAsesor } from './resolverBloquesAsesor';
import { interpretarRespuestaModelo, leerRespuestaVisual, serializarRespuestaVisual } from '../src/lib/bloquesAsesor';

const perfil = construirPerfilFinancieroCompleto({
  cajitas: [{ id: 'nequi', nombre: 'Nequi', tipo: 'cuenta' }],
  categorias: [],
  transacciones: [
    { occurred_on: '2026-10-05', kind: 'ingreso', amount_cop: 1_000_000, category: 'Salario', cuenta_id: 'nequi' },
    { occurred_on: '2026-10-10', kind: 'gasto', amount_cop: 200_000, category: 'Comida', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-02', kind: 'ingreso', amount_cop: 900_000, category: 'Salario', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-03', kind: 'gasto', amount_cop: 300_000, category: 'Transporte', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-04', kind: 'gasto', amount_cop: 100_000, category: 'Comida', cuenta_id: 'nequi' },
    { occurred_on: '2026-11-05', kind: 'gasto', amount_cop: 500_000, category: 'Transferencia', cuenta_id: 'nequi' },
  ],
  movimientosCajitas: [],
  metas: [],
  presupuestos: [],
  recurrentes: [],
});

describe('interpretarRespuestaModelo', () => {
  it('lee el JSON del modelo y descarta tipos que no están en el catálogo', () => {
    const { texto, solicitudes } = interpretarRespuestaModelo(JSON.stringify({
      texto: 'Vas bien este mes.',
      bloques: [{ tipo: 'cifras', mes: '2026-11' }, { tipo: 'html', contenido: '<script>' }, { tipo: 'accion', etiqueta: 'Ver mes', seccion: 'ajustes' }],
    }));
    expect(texto).toBe('Vas bien este mes.');
    expect(solicitudes).toEqual([{ tipo: 'cifras', mes: '2026-11' }]);
  });

  it('rescata el texto de un JSON cortado sin mostrar llaves', () => {
    expect(interpretarRespuestaModelo('{"texto": "Vas **bien**, sigue así.\\nOjo con", "bloques": [{"tipo": "cif')).toEqual({
      texto: 'Vas **bien**, sigue así.\nOjo con',
      solicitudes: [],
    });
  });

  it('acepta el texto aunque el modelo cambie el nombre del campo', () => {
    expect(interpretarRespuestaModelo('{"respuesta": "Hola"}')).toEqual({ texto: 'Hola', solicitudes: [] });
  });

  it('si el proveedor responde en prosa, la prosa queda como respuesta', () => {
    expect(interpretarRespuestaModelo('Hola, ¿cómo vas?')).toEqual({ texto: 'Hola, ¿cómo vas?', solicitudes: [] });
  });
});

describe('resolverBloquesAsesor', () => {
  it('pone las cifras del expediente, no las del modelo', () => {
    const [cifras] = resolverBloquesAsesor([{ tipo: 'cifras' }], perfil);
    expect(cifras).toEqual({ tipo: 'cifras', periodo: 'noviembre 2026', ingresosCop: 900_000, gastosCop: 900_000, balanceCop: 0 });
  });

  it('las barras son del mes pedido y omiten las transferencias propias', () => {
    const [barras] = resolverBloquesAsesor([{ tipo: 'barras_categorias', mes: '2026-11', top: 4 }], perfil);
    expect(barras).toEqual({
      tipo: 'barras_categorias',
      periodo: 'noviembre 2026',
      items: [{ nombre: 'Transporte', valorCop: 300_000 }, { nombre: 'Comida', valorCop: 100_000 }],
    });
  });

  it('descarta un bloque cuando el dato no existe', () => {
    expect(resolverBloquesAsesor([{ tipo: 'cifras', mes: '2025-01' }, { tipo: 'tendencia', meses: 4 }], null)).toEqual([]);
  });

  it('arma la tendencia con los últimos meses', () => {
    const [tendencia] = resolverBloquesAsesor([{ tipo: 'tendencia', meses: 4 }], perfil);
    expect(tendencia.tipo === 'tendencia' && tendencia.items.map((item) => item.etiqueta)).toEqual(['oct 26', 'nov 26']);
  });
});

describe('respuesta guardada', () => {
  it('sobrevive al viaje por la base de datos', () => {
    const bloques = resolverBloquesAsesor([{ tipo: 'cifras' }, { tipo: 'alerta', tono: 'atento', titulo: 'Ojo', detalle: 'Gastaste todo lo que entró.' }], perfil);
    const guardado = serializarRespuestaVisual({ texto: 'Mes justo.', bloques });
    expect(leerRespuestaVisual(guardado)).toEqual({ texto: 'Mes justo.', bloques });
  });

  it('una respuesta sin bloques se guarda como texto normal', () => {
    expect(serializarRespuestaVisual({ texto: 'Hola', bloques: [] })).toBe('Hola');
    expect(leerRespuestaVisual('Hola')).toBeNull();
  });
});
