import type { Cajita, ClaseCuenta } from '../data/modelos';
import type { CSSProperties } from 'react';

interface EntidadFinanciera {
  nombre: string;
  alias: readonly string[];
  fondo: string;
  texto: string;
  claseCuenta: ClaseCuenta;
  fuente: string;
  sombraLectura?: number;
  familiaColor: 'morado' | 'amarillo' | 'rojo' | 'naranja';
}

// Colores tomados de los estilos de los sitios oficiales, consultados el 21/10/2026.
// Davivienda y DaviPlata comparten el rojo de su familia de marca.
export const ENTIDADES_FINANCIERAS: readonly EntidadFinanciera[] = [
  { nombre: 'Nu', alias: ['nu', 'nubank', 'nu bank'], fondo: '#820AD1', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'banco', fuente: 'https://nu.com.co/' },
  { nombre: 'Nequi', alias: ['nequi'], fondo: '#200020', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'billetera', fuente: 'https://www.nequi.com.co/' },
  { nombre: 'Bancolombia', alias: ['bancolombia', 'banco colombia'], fondo: '#FDDA24', familiaColor: 'amarillo', texto: '#2C2A29', claseCuenta: 'banco', fuente: 'https://www.bancolombia.com/' },
  { nombre: 'Davivienda', alias: ['davivienda', 'davi vivienda'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'banco', fuente: 'https://epayco.com/wp-content/uploads/2026/04/Toolkit-ePayco.pdf' },
  { nombre: 'RappiPay', alias: ['rapi', 'rappi', 'rappipay', 'rappi pay', 'rappicuenta', 'rappi cuenta', 'rappicard'], fondo: '#FF441F', familiaColor: 'naranja', texto: '#200020', claseCuenta: 'banco', fuente: 'https://www.rappipay.co/' },
  { nombre: 'DaviPlata', alias: ['daviplata', 'davi plata'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'billetera', fuente: 'https://conectesunegocio.daviplata.com/' },
];

const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const difiereEnUnaLetra = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let errores = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++errores > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return errores + (a.length - i) + (b.length - j) <= 1;
};

export const reconocerEntidad = (nombre: string): EntidadFinanciera | null => {
  const limpio = normalizar(nombre);
  const exactas = ENTIDADES_FINANCIERAS.filter((entidad) => entidad.alias.some((alias) => ` ${limpio} `.includes(` ${alias} `)));
  if (exactas.length) return exactas.length === 1 ? exactas[0] : null;
  // Los alias cortos como «Nu» no admiten aproximaciones: colorearían nombres personales.
  const palabras = limpio.split(' ');
  const parecidas = ENTIDADES_FINANCIERAS.filter((entidad) => entidad.alias.some((alias) => !alias.includes(' ') && alias.length >= 5 && palabras.some((palabra) => palabra.length >= 5 && difiereEnUnaLetra(palabra, alias))));
  return parecidas.length === 1 ? parecidas[0] : null;
};

export const entidadDeCuenta = (cuenta: Pick<Cajita, 'nombre' | 'tipo' | 'claseCuenta'>): EntidadFinanciera | null =>
  (cuenta.tipo === 'cuenta' || cuenta.tipo === 'tarjeta') && cuenta.claseCuenta !== 'efectivo' ? reconocerEntidad(cuenta.nombre) : null;

export const estiloEntidad = (entidad: EntidadFinanciera): CSSProperties => ({
  backgroundColor: entidad.fondo,
  // La base conserva el color oficial; el velo permite leer texto blanco pequeño sobre el rojo.
  backgroundImage: entidad.sombraLectura
    ? `linear-gradient(115deg, rgb(0 0 0 / ${entidad.sombraLectura + 0.08}), rgb(0 0 0 / ${entidad.sombraLectura}))`
    : undefined,
  color: entidad.texto,
  '--fin-ink': entidad.texto,
  '--fin-ink-soft': entidad.texto,
  '--fin-ink-faint': entidad.texto,
  '--fin-ink-ghost': entidad.texto,
  '--fin-soft': `${entidad.texto}18`,
  '--fin-line': `${entidad.texto}30`,
} as CSSProperties);
