import { describe, expect, it } from 'vitest';
import bancosColombia from './bancosColombia.json';
import { nombreVisibleCuenta, ENTIDADES_FINANCIERAS, entidadDeCuenta, reconocerEntidad } from './entidadesFinancieras';

describe('reconocimiento de entidades financieras', () => {
  it.each([
    ['NuBank', 'Nu'], ['Nu Bank nómina', 'Nu'], ['NU', 'Nu'],
    ['N u', 'Nu'], ['N u b a n k', 'Nu'], ['Nubnak', 'Nu'], ['Nu ban k personal', 'Nu'],
    ['Mi Nequi personal', 'Nequi'], ['Neqii', 'Nequi'],
    ['Ne qui', 'Nequi'], ['Neqiu personal', 'Nequi'], ['Nqui', 'Nequi'], ['NÉ-QUI', 'Nequi'],
    ['Bancolmbia', 'Bancolombia'], ['Banco-Colombia', 'Bancolombia'],
    ['Ban co lom bia', 'Bancolombia'], ['Bancolomiba', 'Bancolombia'], ['Ban col mbia nómina', 'Bancolombia'],
    ['Davi plata', 'DaviPlata'], ['Daviviendaa', 'Davivienda'],
    ['Davi vie nda', 'Davivienda'], ['Da vi pla ta', 'DaviPlata'], ['Davipalta', 'DaviPlata'],
    ['Rapi', 'Rappi'], ['Rappi', 'Rappi'], ['Rappi Cuenta', 'Rappi'],
    ['Rap pi pay', 'Rappi'], ['Rappipya', 'Rappi'],
    ['Vacaciones', null], ['Manuel', null], ['Nube', null],
    ['Nuria', null], ['Davi', null], ['Nuestro ahorro', null],
    ['Nequi y Bancolombia', null], ['Nu y Neqiu', null], ['Ne qui y Ban col ombia', null], ['', null],
  ])('reconoce %s sin reescribir el nombre', (nombre, esperado) => {
    expect(reconocerEntidad(nombre)?.nombre ?? null).toBe(esperado);
  });

  it.each(bancosColombia)('reconoce el banco registrado $nombre', ({ nombre, id }) => {
    expect(reconocerEntidad(nombre)?.logo, nombre).toMatch(new RegExp(`/bancos/${id}\\.(svg|png)$`));
  });

  it.each(ENTIDADES_FINANCIERAS)('reconoce $nombre con espacios adicionales', (entidad) => {
    expect(reconocerEntidad(entidad.nombre)?.nombre).toBe(entidad.nombre);
    expect(reconocerEntidad(entidad.alias[0].split('').join(' '))?.nombre).toBe(entidad.nombre);
  });

  it('no confunde la palabra banco con Banco W y conserva marcas anteriores', () => {
    expect(reconocerEntidad('Banco personal')).toBeNull();
    expect(reconocerEntidad('Banco W')?.nombre).toBe('Banco W');
    expect(reconocerEntidad('Scotiabank Colpatria')?.nombre).toBe('DAVIbank');
    expect(reconocerEntidad('BBVA y Banco W')).toBeNull();
  });

  it('muestra Rappi sin modificar el apodo ni los datos guardados', () => {
    const cuenta = { nombre: 'Rapi viajes', tipo: 'cuenta' as const };
    expect(nombreVisibleCuenta(cuenta)).toBe('Rappi viajes');
    expect(cuenta.nombre).toBe('Rapi viajes');
    expect(nombreVisibleCuenta({ ...cuenta, tipo: 'cajita' })).toBe('Rapi viajes');
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
