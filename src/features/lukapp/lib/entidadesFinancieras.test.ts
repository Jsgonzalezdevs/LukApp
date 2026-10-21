import { describe, expect, it } from 'vitest';
import { ENTIDADES_FINANCIERAS, entidadDeCuenta, reconocerEntidad } from './entidadesFinancieras';

describe('reconocimiento de entidades financieras', () => {
  it.each([
    ['NuBank', 'Nu'], ['Nu Bank nómina', 'Nu'], ['NU', 'Nu'],
    ['Mi Nequi personal', 'Nequi'], ['Neqii', 'Nequi'],
    ['Bancolmbia', 'Bancolombia'], ['Banco-Colombia', 'Bancolombia'],
    ['Davi plata', 'DaviPlata'], ['Daviviendaa', 'Davivienda'],
    ['Rapi', 'RappiPay'], ['Rappi', 'RappiPay'], ['Rappi Cuenta', 'RappiPay'],
    ['Vacaciones', null], ['Manuel', null], ['Nube', null],
    ['Nequi y Bancolombia', null], ['', null],
  ])('reconoce %s sin reescribir el nombre', (nombre, esperado) => {
    expect(reconocerEntidad(nombre)?.nombre ?? null).toBe(esperado);
  });

  it('no asigna marcas a efectivo ni a metas de ahorro', () => {
    expect(entidadDeCuenta({ nombre: 'Nu vacaciones', tipo: 'cajita' })).toBeNull();
    expect(entidadDeCuenta({ nombre: 'Nequi', tipo: 'cuenta', claseCuenta: 'efectivo' })).toBeNull();
    expect(entidadDeCuenta({ nombre: 'Nu Visa', tipo: 'tarjeta' })?.nombre).toBe('Nu');
  });

  it('mantiene contraste AA, incluido el blanco sobre el rojo con su velo de lectura', () => {
    const luminancia = (hex: string) => {
      const rgb = hex.slice(1).match(/../g)!.map((par) => parseInt(par, 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    for (const entidad of ENTIDADES_FINANCIERAS) {
      const velos = entidad.sombraLectura ? [entidad.sombraLectura, entidad.sombraLectura + 0.08] : [0];
      for (const velo of velos) {
        const fondo = '#' + entidad.fondo.slice(1).match(/../g)!.map((par) => Math.round(parseInt(par, 16) * (1 - velo)).toString(16).padStart(2, '0')).join('');
        const valores = [luminancia(fondo), luminancia(entidad.texto)].sort((a, b) => a - b);
        expect((valores[1] + 0.05) / (valores[0] + 0.05), entidad.nombre).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
