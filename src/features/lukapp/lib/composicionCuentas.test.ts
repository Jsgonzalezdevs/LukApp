import { describe, expect, it } from 'vitest';
import type { Cajita } from '../data/modelos';
import { componerCuentas } from './composicionCuentas';
import { entidadDeCuenta } from './entidadesFinancieras';

const cuenta = (nombre: string): Cajita => ({ id: nombre, nombre, tipo: 'cuenta', icon: 'PiggyBank', metaCop: null, tasaEaPct: null, createdAt: '2026-10-21', archivedAt: null });
const cuentas = Object.freeze(['NuBank', 'Nequi', 'Efectivo', 'Bancolombia', 'Davivienda', 'Rapi', 'Daviplata'].map(cuenta));

describe('composición de los colores de las cuentas', () => {
  it('separa los dos rojos del amarillo y del naranja en la composición de siete cuentas', () => {
    const orden = componerCuentas(cuentas, null);
    expect(orden[0]).toBe(cuentas[0]);
    for (let i = 0; i < orden.length; i++) {
      if (entidadDeCuenta(orden[i])?.familiaColor !== 'rojo') continue;
      for (const vecina of [orden[i - 1], orden[i + 1]].filter(Boolean)) {
        expect(['rojo', 'amarillo', 'naranja']).not.toContain(entidadDeCuenta(vecina)?.familiaColor);
      }
    }
  });

  it('deja primero la cuenta principal aunque antes estuviera más abajo', () => {
    expect(componerCuentas(cuentas, 'Nequi')[0]).toBe(cuentas[1]);
  });

  it('conserva las cuentas y sus datos y produce un orden estable sin alterar la entrada', () => {
    const orden = componerCuentas(cuentas, null);
    expect(orden).toEqual(componerCuentas(cuentas, null));
    expect(orden).toHaveLength(cuentas.length);
    expect(new Set(orden)).toEqual(new Set(cuentas));
    expect(cuentas.map((c) => c.nombre)).toEqual(['NuBank', 'Nequi', 'Efectivo', 'Bancolombia', 'Davivienda', 'Rapi', 'Daviplata']);
  });

  it('conserva el orden financiero si los nombres no tienen una marca reconocida', () => {
    const genericas = [cuenta('Personal'), cuenta('Familia'), cuenta('Trabajo')];
    expect(componerCuentas(genericas, null)).toEqual(genericas);
  });

  it('admite listas vacías y marcas repetidas sin perder cuentas', () => {
    expect(componerCuentas([], null)).toEqual([]);
    const rojas = ['Davivienda personal', 'Davivienda trabajo', 'Daviplata'].map(cuenta);
    expect(componerCuentas(rojas, null)).toEqual(rojas);
  });
});
