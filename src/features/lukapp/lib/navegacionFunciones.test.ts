import { describe, it, expect } from 'vitest';
import { buscarFunciones, panelDeSegmentos, rutaDePanel } from './navegacionFunciones';

describe('navegación de herramientas financieras', () => {
  it('ubica metas/importaciones en Dinero y pagos/proyección en Mes', () => {
    expect(rutaDePanel('metas')).toBe('/dinero/metas');
    expect(rutaDePanel('extractos')).toBe('/dinero/extractos');
    expect(rutaDePanel('recurrentes')).toBe('/mes/recurrentes');
    expect(rutaDePanel('forecast')).toBe('/mes/forecast');
    expect(rutaDePanel('respaldo')).toBe('/ajustes/respaldo');
  });
  it('conserva el calendario como origen al añadir un pago fijo', () => {
    expect(rutaDePanel('recurrentes', 'calendario')).toBe('/calendario/recurrentes');
    expect(panelDeSegmentos(['calendario', 'recurrentes'])).toBe('recurrentes');
  });
  it('reconoce las rutas anteriores y rechaza destinos desconocidos', () => {
    expect(panelDeSegmentos(['ajustes', 'metas'])).toBe('metas');
    expect(panelDeSegmentos(['dinero', 'metas'])).toBe('metas');
    expect(panelDeSegmentos(['mes', 'no-existe'])).toBeNull();
    expect(panelDeSegmentos(['no-existe', 'metas'])).toBeNull();
  });
  it('busca sin tildes y encuentra herramientas por sus usos', () => {
    expect(buscarFunciones('proyeccion').map((f) => f.id)).toContain('forecast');
    expect(buscarFunciones('importación').map((f) => f.id)).toContain('extractos');
    expect(buscarFunciones('suscripciones').map((f) => f.id)).toContain('recurrentes');
    expect(buscarFunciones('algo inexistente')).toEqual([]);
    expect(buscarFunciones(' ')).toEqual([]);
  });
});
