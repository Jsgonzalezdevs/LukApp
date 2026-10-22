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
  familiaColor: 'morado' | 'amarillo' | 'rojo' | 'naranja' | 'azul' | 'verde' | 'gris';
}

// Colores tomados de los estilos de los sitios oficiales, consultados el 21/10/2026.
// Davivienda y DaviPlata comparten el rojo de su familia de marca.
export const ENTIDADES_FINANCIERAS: readonly EntidadFinanciera[] = [
  { nombre: 'Nu', logo: '/bancos/nu.svg', alias: ['nu', 'nubank', 'nu bank'], fondo: '#820AD1', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'banco', fuente: 'https://nu.com.co/' },
  { nombre: 'Nequi', logo: '/bancos/nequi.png', alias: ['nequi'], fondo: '#200020', familiaColor: 'morado', texto: '#FFFFFF', claseCuenta: 'billetera', fuente: 'https://www.nequi.com.co/' },
  { nombre: 'Bancolombia', logo: '/bancos/bancolombia.svg', alias: ['bancolombia', 'banco colombia'], fondo: '#FDDA24', familiaColor: 'amarillo', texto: '#2C2A29', claseCuenta: 'banco', fuente: 'https://www.bancolombia.com/' },
  { nombre: 'Davivienda', logo: '/bancos/davivienda.png', encajeLogo: 'auto 80%', posicionLogo: 'left center', alias: ['davivienda', 'davi vivienda'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'banco', fuente: 'https://epayco.com/wp-content/uploads/2026/04/Toolkit-ePayco.pdf' },
  { nombre: 'Rappi', logo: '/bancos/rappipay.png', luminanciaLogo: true, alias: ['rapi', 'rappi', 'rappipay', 'rappi pay', 'rappicuenta', 'rappi cuenta', 'rappicard'], fondo: '#FF441F', familiaColor: 'naranja', texto: '#200020', claseCuenta: 'banco', fuente: 'https://www.rappipay.co/' },
  { nombre: 'DaviPlata', logo: '/bancos/daviplata.png', encajeLogo: 'auto 72%', alias: ['daviplata', 'davi plata'], fondo: '#ED1C27', familiaColor: 'rojo', texto: '#FFFFFF', sombraLectura: 0.08, claseCuenta: 'billetera', fuente: 'https://conectesunegocio.daviplata.com/' },
  {"nombre": "Banco Agrario", "alias": ["agrario", "banco agrario"], "fondo": "#5BC500", "familiaColor": "verde", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.bancoagrario.gov.co/themes/custom/bancoagrario/logo.svg", "logo": "/bancos/agrario.svg"},
  {"nombre": "Bancamía", "alias": ["bancamia", "banco de las microfinanzas"], "fondo": "#F26F21", "familiaColor": "naranja", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.bancamia.com.co/wp-content/uploads/2025/04/Logo-bancamia-solo.png", "logo": "/bancos/bancamia.svg"},
  {"nombre": "BTG Pactual", "alias": ["btg", "btg pactual"], "fondo": "#001E61", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.btgpactual.com.co/favicon.ico", "logo": "/bancos/btg.svg"},
  {"nombre": "Banco Caja Social", "alias": ["caja social", "banco caja social"], "fondo": "#003B71", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bancocajasocial.com/content/dam/bcs/logos/logo-bcs.svg", "logo": "/bancos/cajasocial.svg"},
  {"nombre": "Banco Contactar", "alias": ["contactar", "banco contactar"], "fondo": "#F26522", "familiaColor": "naranja", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://bancocontactar.com/wp-content/uploads/2023/09/cropped-faviconbc-192x192.png", "logo": "/bancos/contactar.svg"},
  {"nombre": "Ban100", "alias": ["ban100", "ban 100", "credifinanciera"], "fondo": "#1F145D", "familiaColor": "morado", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.ban100.com.co/sites/default/files/favicon_b100.ico", "logo": "/bancos/ban100.svg"},
  {"nombre": "Banco de Bogotá", "alias": ["banco de bogota", "banco bogota", "bogota"], "fondo": "#003DA5", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://saladeprensa.bancodebogota.com/wp-content/uploads/2022/12/Isotipo.png", "logo": "/bancos/bogota.svg"},
  {"nombre": "GNB Sudameris", "alias": ["gnb", "sudameris", "gnb sudameris"], "fondo": "#0073AE", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.gnbsudameris.com.co/Content/files/images/new-home/logo-gnbsudameris.png", "logo": "/bancos/gnb.svg"},
  {"nombre": "Banco Popular", "alias": ["banco popular", "popular"], "fondo": "#105163", "familiaColor": "verde", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bancopopular.com.co/wps/contenthandler/dav/themelist/TemaBancoPopular/images/favicon.svg", "logo": "/bancos/popular.svg"},
  {"nombre": "Bancoomeva", "alias": ["bancoomeva", "banco coomeva", "coomeva"], "fondo": "#008C4A", "familiaColor": "verde", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.bancoomeva.com.co/info/bancoomeva/web/portal/img/favicon.png", "logo": "/bancos/coomeva.svg"},
  {"nombre": "Banco Falabella", "alias": ["falabella", "banco falabella"], "fondo": "#007A33", "familiaColor": "verde", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bancofalabella.com.co/_next/static/media/bfisotype.812a4957.svg", "logo": "/bancos/falabella.svg"},
  {"nombre": "Santander", "alias": ["santander", "banco santander"], "fondo": "#FE0000", "familiaColor": "rojo", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.santander.com.co/img/santander.ico", "logo": "/bancos/santander.svg", "sombraLectura": 0.16},
  {"nombre": "Serfinanza", "alias": ["serfinanza", "banco serfinanza"], "fondo": "#130488", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://bancoserfinanza.com/favicon.ico", "logo": "/bancos/serfinanza.svg"},
  {"nombre": "Lulo Bank", "alias": ["lulo", "lulo bank"], "fondo": "#E6FF00", "familiaColor": "amarillo", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.lulobank.com/favicon.ico", "logo": "/bancos/lulo.svg"},
  {"nombre": "Revolut", "alias": ["revolut", "revolut bank"], "fondo": "#191C1F", "familiaColor": "gris", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://icons.duckduckgo.com/ip3/revolut.com.ico", "logo": "/bancos/revolut.svg"},
  {"nombre": "AV Villas", "alias": ["av villas", "avvillas", "banco comercial av villas"], "fondo": "#D71920", "familiaColor": "rojo", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.avvillas.com.co/documents/37648/54307914/favicon/415f2f56-1762-fe96-1a3b-5d00eb4f3e2f", "logo": "/bancos/avvillas.svg", "sombraLectura": 0.16},
  {"nombre": "BBVA", "alias": ["bbva", "bbva colombia"], "fondo": "#001391", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bbva.com.co/content/dam/library/favicons/safari-pinned-tab.svg", "logo": "/bancos/bbva.svg"},
  {"nombre": "Citibank", "alias": ["citi", "citibank"], "fondo": "#004B76", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.citibank.com/favicon.ico", "logo": "/bancos/citi.svg"},
  {"nombre": "DAVIbank", "alias": ["davibank", "davi bank", "scotiabank", "colpatria", "scotiabank colpatria"], "fondo": "#E30518", "familiaColor": "rojo", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://cdn.aglty.io/scotiabank-colombia/home-nuevo/logos/favicon-192x192.png", "logo": "/bancos/davibank.svg", "sombraLectura": 0.16},
  {"nombre": "Coopcentral", "alias": ["coopcentral", "coop central", "banco cooperativo coopcentral"], "fondo": "#003B71", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://bucketimagespayments.s3.amazonaws.com/public/marcablanca/images/d91320b6-c2cb-4e28-b61c-d1f5b5c5b48d..png", "logo": "/bancos/coopcentral.svg"},
  {"nombre": "Banco de Occidente", "alias": ["banco de occidente", "banco occidente", "occidente"], "fondo": "#008ECE", "familiaColor": "azul", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://cdn.worldvectorlogo.com/logos/logo-banco-de-occidente.svg", "logo": "/bancos/occidente.svg"},
  {"nombre": "J.P. Morgan", "alias": ["jp morgan", "j p morgan", "jpmorgan"], "fondo": "#242526", "familiaColor": "gris", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.jpmorgan.com/etc.clientlibs/cws/clientlibs/clientlib-base/resources/jpm/images/jpm-favicon-152.png", "logo": "/bancos/jpmorgan.svg"},
  {"nombre": "Itaú", "alias": ["itau", "banco itau"], "fondo": "#FF6200", "familiaColor": "naranja", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://banco.itau.co/documents/43985/111719/logo-corporate.svg/dbbb1c27-5fe2-6e4e-3aae-b8d0c1119e38", "logo": "/bancos/itau.svg"},
  {"nombre": "Banco W", "alias": ["banco w", "bancow"], "fondo": "#00B1BB", "familiaColor": "azul", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.bancow.com.co/favicon.ico", "logo": "/bancos/bancow.svg"},
  {"nombre": "Banco Finandina", "alias": ["finandina", "banco finandina"], "fondo": "#7835C3", "familiaColor": "morado", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bancofinandina.com/hubfs/faviconV2.png", "logo": "/bancos/finandina.svg"},
  {"nombre": "Banco Pichincha", "alias": ["pichincha", "banco pichincha"], "fondo": "#FFDD00", "familiaColor": "amarillo", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://www.bancopichincha.com.co/o/pichincha-theme/images/icon/apple-icon-144x144.png", "logo": "/bancos/pichincha.svg"},
  {"nombre": "Banco Mundo Mujer", "alias": ["mundo mujer", "banco mundo mujer", "bmm"], "fondo": "#173279", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://bmm.cdn.modyo.com/uploads/b48b4253-6a33-4668-a40b-8a6148b12328/original/BMM-logo.svg", "logo": "/bancos/mundomujer.svg"},
  {"nombre": "Mibanco", "alias": ["mibanco", "mi banco colombia", "banco de la microempresa"], "fondo": "#009330", "familiaColor": "verde", "texto": "#000000", "claseCuenta": "banco", "fuente": "https://cdn.modyo.cloud/uploads/3acf119b-6c28-473f-8102-20274927ba50/C144x144/favicon_mibanco.png", "logo": "/bancos/mibanco.svg"},
  {"nombre": "Banco Unión", "alias": ["banco union", "bancounion"], "fondo": "#006C96", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "banco", "fuente": "https://www.bancounion.com/info/bancounion/web/portal/img/favicon.png", "logo": "/bancos/union.svg"},
  {"nombre": "Ualá", "alias": ["uala"], "fondo": "#0054EA", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "billetera", "fuente": "https://www.uala.com.co/favicon.ico", "logo": "/bancos/uala.svg"},
  {"nombre": "Bold", "alias": ["bold"], "fondo": "#121E6C", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "billetera", "fuente": "https://bold.co/apple-touch-icon.png", "logo": "/bancos/bold.svg"},
  {"nombre": "Mercado Pago", "alias": ["mercado pago", "mercadopago"], "fondo": "#009EE3", "familiaColor": "azul", "texto": "#000000", "claseCuenta": "billetera", "fuente": "https://www.google.com/s2/favicons?domain=mercadopago.com.co&sz=128", "logo": "/bancos/mercadopago.svg"},
  {"nombre": "Dale!", "alias": ["dale", "dale!"], "fondo": "#002B49", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "billetera", "fuente": "https://www.dale.com.co/sites/default/files/favicon.ico", "logo": "/bancos/dale.svg"},
  {"nombre": "Coink", "alias": ["coink"], "fondo": "#1EEB00", "familiaColor": "verde", "texto": "#000000", "claseCuenta": "billetera", "fuente": "https://coink.com/wp-content/uploads/2025/09/imgi_12_Marranito.svg", "logo": "/bancos/coink.svg"},
  {"nombre": "Global66", "alias": ["global66", "global 66"], "fondo": "#2149B6", "familiaColor": "azul", "texto": "#FFFFFF", "claseCuenta": "billetera", "fuente": "https://icons.duckduckgo.com/ip3/global66.com.ico", "logo": "/bancos/global66.svg"},
  {"nombre": "Powwi", "alias": ["powwi", "pagos gde"], "fondo": "#77AB2C", "familiaColor": "verde", "texto": "#000000", "claseCuenta": "billetera", "fuente": "https://powwi.co/wp-content/uploads/2022/03/cropped-favicon-header-x1-192x192.png", "logo": "/bancos/gde.svg"},
];

const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const PALABRAS_GENERICAS = new Set(['banco', 'bank', 'cuenta', 'ahorro', 'ahorros', 'personal', 'colombia', 'nomina', 'bancos', 'banc', 'bancode', 'bancodel', 'bankcolombia']);

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
  if (['mi banco', 'banco', 'cuenta bancaria'].includes(normalizar(nombre))) return null;
  const palabras = normalizar(nombre).split(' ').filter(Boolean);
  const coincidencias: { entidad: EntidadFinanciera; inicio: number; fin: number; longitud: number; exacta: boolean }[] = [];
  for (let i = 0; i < palabras.length; i++) {
    let compacto = '';
    for (let j = i; j < palabras.length; j++) {
      compacto += palabras[j];
      if (compacto.length > longitudMaxima) break;
      for (const { entidad, alias } of aliasCompactos) {
        for (const texto of alias) {
          const exacta = compacto === texto;
          const aproximada = texto.length >= 5 && compacto.length >= 4
            && !PALABRAS_GENERICAS.has(compacto)
            && distanciaDeEscritura(compacto, texto) <= 1;
          if (exacta || aproximada) coincidencias.push({ entidad, inicio: i, fin: j, longitud: texto.length, exacta });
        }
      }
    }
  }
  // Una marca completa prevalece sobre fragmentos parecidos de su propio nombre.
  // Dos marcas en segmentos distintos siguen siendo ambiguas, incluso con errores.
  coincidencias.sort((a, b) => b.longitud - a.longitud || Number(b.exacta) - Number(a.exacta));
  const seleccionadas: typeof coincidencias = [];
  for (const coincidencia of coincidencias) {
    if (!seleccionadas.some((otra) => coincidencia.inicio <= otra.fin && coincidencia.fin >= otra.inicio)) seleccionadas.push(coincidencia);
  }
  const entidades = new Set(seleccionadas.map(({ entidad }) => entidad));
  return entidades.size === 1 ? [...entidades][0] : null;
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

/** Corrige la marca Rappi al mostrarla, conservando los apodos y los datos guardados. */
export const nombreVisibleCuenta = (cuenta: Pick<Cajita, 'nombre' | 'tipo' | 'claseCuenta'>): string =>
  entidadDeCuenta(cuenta)?.nombre === 'Rappi'
    ? cuenta.nombre.replace(/\brapi\b/gi, 'Rappi')
    : cuenta.nombre;
