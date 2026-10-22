import type { Cajita, ClaseCuenta } from '../data/modelos';
import type { CSSProperties } from 'react';

interface EntidadFinanciera {
  nombre: string;
  alias: readonly string[];
  fondo: string;
  texto: string;
  claseCuenta: ClaseCuenta;
  fuente: string;
  logo: string;
  encajeLogo?: string;
  posicionLogo?: string;
  luminanciaLogo?: boolean;
  sombraLectura?: number;
  familiaColor: 'morado' | 'amarillo' | 'rojo' | 'naranja';
}

// Colores tomados de los estilos de los sitios oficiales, consultados el 21/10/2026.
// Davivienda y DaviPlata comparten el rojo de su familia de marca.
export const ENTIDADES_FINANCIERAS: readonly EntidadFinanciera[] = [
  { nombre: 'Nu', logo: '/bancos/nu.svg', alias: ['nu', 'nubank', 'nu bank'], fondo: '#820AD1', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'banco', fuente: 'https://nu.com.co/' },
  { nombre: 'Nequi', logo: '/bancos/nequi.png', alias: ['nequi'], fondo: '#200020', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'billetera', fuente: 'https://www.nequi.com.co/' },
  { nombre: 'Bancolombia', logo: '/bancos/bancolombia.svg', alias: ['bancolombia', 'banco colombia'], fondo: '#FDDA24', familiaColor: 'amarillo', texto: '#2C2A29', claseCuenta: 'banco', fuente: 'https://www.bancolombia.com/' },
  { nombre: 'Davivienda', logo: '/bancos/davivienda.png', encajeLogo: 'auto 80%', posicionLogo: 'left center', alias: ['davivienda', 'davi vivienda'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'banco', fuente: 'https://epayco.com/wp-content/uploads/2026/04/Toolkit-ePayco.pdf' },
  { nombre: 'RappiPay', logo: '/bancos/rappipay.png', luminanciaLogo: true, alias: ['rapi', 'rappi', 'rappipay', 'rappi pay', 'rappicuenta', 'rappi cuenta', 'rappicard'], fondo: '#FF441F', familiaColor: 'naranja', texto: '#200020', claseCuenta: 'banco', fuente: 'https://www.rappipay.co/' },
  { nombre: 'DaviPlata', logo: '/bancos/daviplata.png', encajeLogo: 'auto 72%', alias: ['daviplata', 'davi plata'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'billetera', fuente: 'https://conectesunegocio.daviplata.com/' },
];

const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const aliasCompactos = ENTIDADES_FINANCIERAS.map((entidad) => ({
  entidad,
  alias: [...new Set(entidad.alias.map((alias) => normalizar(alias).replace(/ /g, '')))],
}));
const longitudMaxima = Math.max(...aliasCompactos.flatMap(({ alias }) => alias.map((texto) => texto.length))) + 1;

// Una edición incluye omitir, añadir, sustituir o intercambiar dos letras contiguas.
const distanciaDeEscritura = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const distancias = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      distancias[i][j] = Math.min(distancias[i - 1][j] + 1, distancias[i][j - 1] + 1, distancias[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distancias[i][j] = Math.min(distancias[i][j], distancias[i - 2][j - 2] + 1);
      }
    }
  }
  return distancias[a.length][b.length];
};

export const reconocerEntidad = (nombre: string): EntidadFinanciera | null => {
  const palabras = normalizar(nombre).split(' ').filter(Boolean);
  const candidatos = new Set<string>();
  // Las ventanas conservan los límites del nombre: «nube» no contiene la marca «Nu».
  // Unir palabras consecutivas permite reconocer «Ban co lom bia» y «Ne qui».
  for (let i = 0; i < palabras.length; i++) {
    let compacto = '';
    for (let j = i; j < palabras.length; j++) {
      compacto += palabras[j];
      if (compacto.length > longitudMaxima) break;
      candidatos.add(compacto);
    }
  }
  const coincidencias = aliasCompactos.filter(({ alias }) => alias.some((texto) =>
    candidatos.has(texto) || (texto.length >= 5 && [...candidatos].some((candidato) => candidato.length >= 4 && distanciaDeEscritura(candidato, texto) <= 1)),
  ));
  // Si el nombre menciona dos entidades, incluso con errores, no se elige una al azar.
  return coincidencias.length === 1 ? coincidencias[0].entidad : null;
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
