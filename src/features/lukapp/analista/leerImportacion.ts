import { CATEGORY_LABELS, type Category, type TxKind } from '../types';
import type { AnalisisResultado, MovimientoExtraido } from './tipos';

const FECHA_ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const FECHA_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/;

const texto = (valor: unknown): string => String(valor ?? '').replace(/\s+/g, ' ').trim();

export const fechaImportada = (valor: unknown): string | null => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // Excel stores dates as days since 1899-12-30. Reject ordinary amounts.
    if (valor < 20_000 || valor > 80_000) return null;
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86_400_000);
    return fecha.toISOString().slice(0, 10);
  }
  const valorTexto = texto(valor);
  const fechaSinHora = valorTexto.match(/^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?=$|\s)/)?.[0] ?? valorTexto;
  const iso = FECHA_ISO.exec(fechaSinHora);
  const dmy = FECHA_DMY.exec(fechaSinHora);
  if (!iso && !dmy) return null;
  const año = Number((iso ? iso[1] : dmy![3]));
  const mes = Number(iso ? iso[2] : dmy![2]);
  const dia = Number(iso ? iso[3] : dmy![1]);
  const añoCompleto = año < 100 ? (año < 70 ? 2000 + año : 1900 + año) : año;
  const fecha = new Date(Date.UTC(añoCompleto, mes - 1, dia));
  if (fecha.getUTCFullYear() !== añoCompleto || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString().slice(0, 10);
};

export const montoImportado = (valor: unknown): number | null => {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round(Math.abs(valor));
  let limpio = texto(valor).replace(/[^\d,.-]/g, '');
  if (!limpio) return null;
  const coma = limpio.lastIndexOf(',');
  const punto = limpio.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    limpio = coma > punto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  } else if (coma >= 0) {
    const decimales = limpio.length - coma - 1;
    limpio = decimales === 2 ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  } else if (punto >= 0 && limpio.length - punto - 1 === 3) {
    limpio = limpio.replace(/\./g, '');
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) ? Math.round(Math.abs(numero)) : null;
};

const cabeceraNormalizada = (valor: unknown): string => texto(valor)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ubicarColumna = (cabeceras: string[], patrones: RegExp[]): number =>
  cabeceras.findIndex((columna) => patrones.some((patron) => patron.test(columna)));

const PATRONES = {
  fecha: [/fecha/, /date/],
  descripcion: [/descripcion/, /concepto/, /detalle/, /comercio/, /referencia/, /merchant/, /establecimiento/, /nombre/],
  debito: [/debito/, /retiro/, /cargo/, /gasto/, /withdrawal/],
  credito: [/credito/, /abono/, /deposito/, /^ingresos?$/, /credit/],
  monto: [/monto/, /valor/, /importe/, /amount/, /transaccion/],
  tipo: [/^tipo$/, /movimiento/, /ingresogasto$/, /gastosingreso$/],
  categoria: [/categoria/, /category/],
  afectaSaldo: [/afectasaldo/, /impactasaldo/, /balanceactual/],
};

const inferirCategoria = (descripcion: string, tipo: TxKind, categoriaArchivo: unknown): Category => {
  const valor = cabeceraNormalizada(categoriaArchivo);
  const categoriaDeclarada = (Object.entries(CATEGORY_LABELS) as [Category, string][])
    .find(([clave, etiqueta]) => cabeceraNormalizada(clave) === valor || cabeceraNormalizada(etiqueta) === valor)?.[0];
  if (categoriaDeclarada) return categoriaDeclarada;
  if (tipo === 'ingreso') return 'ingreso';
  const descripcionNormalizada = descripcion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const reglas: [RegExp, Category][] = [
    [/supermerc|mercado|exito|carulla|\bd1\b|\bara\b|olimpica/, 'mercado'],
    [/restaurante|panader|cafe|comida|domicilio|rappi|crepes|hamburgues/, 'comida'],
    [/uber|taxi|transmi|transporte|gasolina|peaje|cabify|didi/, 'transporte'],
    [/luz|energia|agua|internet|telefon|servicio publico/, 'servicios'],
    [/farmacia|medic|clinica|salud|drogueria/, 'salud'],
    [/arriendo|hogar|ferreteria|mueble/, 'hogar'],
    [/cine|netflix|spotify|juego|entretenimiento/, 'entretenimiento'],
    [/ropa|zapato|vestuario/, 'ropa'],
    [/universidad|colegio|educacion|curso|libro/, 'educacion'],
    [/transferencia|traslado/, 'transferencia'],
    [/ahorro|inversion|bolsillo/, 'ahorro'],
  ];
  return reglas.find(([patron]) => patron.test(descripcionNormalizada))?.[1] ?? 'otros';
};

const clasificar = (fila: unknown[], columnas: Record<string, number>): MovimientoExtraido | null => {
  const fecha = fechaImportada(fila[columnas.fecha]);
  const descripcion = texto(fila[columnas.descripcion]);
  if (!fecha || !descripcion) return null;
  const debito = columnas.debito >= 0 ? montoImportado(fila[columnas.debito]) : null;
  const credito = columnas.credito >= 0 ? montoImportado(fila[columnas.credito]) : null;
  const valor = columnas.monto >= 0 ? montoImportado(fila[columnas.monto]) : null;
  const tipoTexto = columnas.tipo >= 0 ? cabeceraNormalizada(fila[columnas.tipo]) : '';
  const saldoTexto = columnas.afectaSaldo >= 0 ? cabeceraNormalizada(fila[columnas.afectaSaldo]) : '';
  let monto = 0;
  let tipo: TxKind = 'gasto';
  if (debito || credito) {
    if ((debito ?? 0) > 0 && (credito ?? 0) > 0) return null;
    monto = (debito ?? 0) || (credito ?? 0);
    tipo = credito ? 'ingreso' : 'gasto';
  } else if (valor) {
    const original = texto(fila[columnas.monto]);
    tipo = /ingreso|abono|credito|deposito|entrada/.test(tipoTexto) || /^\s*\+/.test(original) || /^\s*\(/.test(original) ? 'ingreso' : 'gasto';
    monto = valor;
    // A negative ledger amount is an outgoing movement; parentheses are a
    // common accounting notation for the same sign.
    if (/\(.*\)/.test(original) || /^\s*-/.test(original)) tipo = 'gasto';
  }
  if (!monto) return null;
  const lower = descripcion.toLowerCase();
  const exclusiones: MovimientoExtraido['exclusion'] = /transferencia entre mis cuentas|entre cuentas propias|entre mis cuentas|bolsillo a|traslado interno|traslado entre cuentas/.test(lower)
    ? 'traslado-propio'
    : /pago tarjeta|abono tarjeta|pago de tarjeta/.test(lower)
      ? 'pago-tarjeta'
      : /reverso|reversion|anulacion/.test(lower)
        ? 'reverso'
        : null;
  return {
    fecha,
    descripcion,
    montoCop: monto,
    tipo,
    categoria: inferirCategoria(descripcion, tipo, fila[columnas.categoria]),
    ...(saldoTexto ? { afectaSaldo: !['no', 'false', '0', 'historico', 'historica'].includes(saldoTexto) } : {}),
    detalle: 'Revisa la categoría y el tipo antes de importar.',
    confianza: 'alta',
    exclusion: exclusiones,
  };
};

const csvComoFilas = (csv: string): string[][] => {
  const muestra = csv.slice(0, 8_000);
  const primeraLinea = muestra.split(/\r?\n/, 1)[0] ?? '';
  const conteos = new Map([[';', 0], [',', 0], ['\t', 0]]);
  let entreComillasMuestra = false;
  for (let i = 0; i < primeraLinea.length; i++) {
    if (primeraLinea[i] === '"' && primeraLinea[i + 1] === '"' && entreComillasMuestra) i++;
    else if (primeraLinea[i] === '"') entreComillasMuestra = !entreComillasMuestra;
    else if (!entreComillasMuestra && conteos.has(primeraLinea[i])) conteos.set(primeraLinea[i], conteos.get(primeraLinea[i])! + 1);
  }
  const delimitador = [...conteos.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"' && entreComillas && csv[i + 1] === '"') { campo += '"'; i++; }
    else if (c === '"') entreComillas = !entreComillas;
    else if (c === delimitador && !entreComillas) { fila.push(campo); campo = ''; }
    else if ((c === '\n' || c === '\r') && !entreComillas) {
      if (campo || fila.length) { fila.push(campo); filas.push(fila); }
      fila = []; campo = '';
      if (c === '\r' && csv[i + 1] === '\n') i++;
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
};

const columnasDe = (cabeceras: unknown[]): Record<string, number> => {
  const normalizadas = cabeceras.map(cabeceraNormalizada);
  return {
    fecha: ubicarColumna(normalizadas, PATRONES.fecha),
    descripcion: ubicarColumna(normalizadas, PATRONES.descripcion),
    debito: ubicarColumna(normalizadas, PATRONES.debito),
    credito: ubicarColumna(normalizadas, PATRONES.credito),
    monto: ubicarColumna(normalizadas, PATRONES.monto),
    tipo: ubicarColumna(normalizadas, PATRONES.tipo),
    categoria: ubicarColumna(normalizadas, PATRONES.categoria),
    afectaSaldo: ubicarColumna(normalizadas, PATRONES.afectaSaldo),
  };
};

export const analizarFilas = (filas: unknown[][], entidad: string | null = null): AnalisisResultado => {
  const indiceCabecera = filas.findIndex((fila) => {
    const columnas = columnasDe(fila);
    return columnas.fecha >= 0 && columnas.descripcion >= 0 && (columnas.monto >= 0 || columnas.debito >= 0 || columnas.credito >= 0);
  });
  if (indiceCabecera < 0) throw new Error('No encontramos columnas de fecha, descripción y monto. Revisa que el archivo tenga encabezados.');
  const columnas = columnasDe(filas[indiceCabecera]);
  const movimientos = filas.slice(indiceCabecera + 1)
    .map((fila) => clasificar(fila, columnas))
    .filter((mov): mov is MovimientoExtraido => mov !== null);
  if (!movimientos.length) throw new Error('No encontramos movimientos legibles en el archivo. Verifica las fechas, descripciones y montos.');
  const fechas = movimientos.map((mov) => mov.fecha).sort();
  const primera = fechas[0];
  const ultima = fechas[fechas.length - 1];
  return {
    entidad,
    periodo: { desde: primera, hasta: ultima, etiqueta: primera === ultima ? primera : `${primera} – ${ultima}` },
    veredicto: `Encontramos ${movimientos.length} filas con movimientos. Revisa cada fila, categoría y posible duplicado antes de importarla.`,
    metricas: [],
    alertas: [],
    recomendaciones: [],
    movimientos,
    advertencias: ['El archivo se procesó en este dispositivo; comprueba los datos antes de guardar.'],
  };
};

const leerU16 = (vista: DataView, pos: number): number => vista.getUint16(pos, true);
const leerU32 = (vista: DataView, pos: number): number => vista.getUint32(pos, true);

const entradasZip = async (buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> => {
  const vista = new DataView(buffer);
  let fin = buffer.byteLength - 22;
  while (fin >= Math.max(0, buffer.byteLength - 65_557) && leerU32(vista, fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('El archivo Excel está dañado o no es un .xlsx válido.');
  const cantidad = leerU16(vista, fin + 10);
  const inicio = leerU32(vista, fin + 16);
  if (cantidad > 1_000) throw new Error('El Excel contiene demasiados archivos internos y no se puede procesar con seguridad.');
  const archivos = new Map<string, Uint8Array>();
  const decodificar = new TextDecoder();
  let pos = inicio;
  let totalDescomprimido = 0;
  for (let i = 0; i < cantidad; i++) {
    if (leerU32(vista, pos) !== 0x02014b50) break;
    const metodo = leerU16(vista, pos + 10);
    const banderas = leerU16(vista, pos + 8);
    const tamano = leerU32(vista, pos + 20);
    const tamanoOriginal = leerU32(vista, pos + 24);
    const largoNombre = leerU16(vista, pos + 28);
    const largoExtra = leerU16(vista, pos + 30);
    const largoComentario = leerU16(vista, pos + 32);
    const local = leerU32(vista, pos + 42);
    const nombre = decodificar.decode(new Uint8Array(buffer, pos + 46, largoNombre));
    const nombreLocal = leerU16(vista, local + 26);
    const extraLocal = leerU16(vista, local + 28);
    const datosInicio = local + 30 + nombreLocal + extraLocal;
    const datos = new Uint8Array(buffer, datosInicio, tamano);
    totalDescomprimido += tamanoOriginal;
    if (tamanoOriginal > 8 * 1024 * 1024 || totalDescomprimido > 24 * 1024 * 1024) {
      throw new Error('El Excel se expande demasiado al abrirlo. Guarda solo la hoja de movimientos o expórtalo como CSV.');
    }
    if (banderas & 1) throw new Error('Este Excel está protegido con contraseña. Guárdalo sin contraseña para importarlo.');
    const relevante = nombre === 'xl/workbook.xml' || nombre === 'xl/_rels/workbook.xml.rels' || nombre === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(nombre);
    if (!relevante) {
      pos += 46 + largoNombre + largoExtra + largoComentario;
      continue;
    }
    if (metodo === 0) archivos.set(nombre, datos.slice());
    else if (metodo === 8 && typeof DecompressionStream !== 'undefined' && typeof Blob.prototype.stream === 'function') {
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      archivos.set(nombre, new Uint8Array(await new Response(flujo).arrayBuffer()));
    } else throw new Error('Este navegador no puede descomprimir el Excel. Expórtalo como CSV para importarlo.');
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
};

const leerXlsx = async (archivo: File): Promise<unknown[][]> => {
  const archivos = await entradasZip(await archivo.arrayBuffer());
  const lector = new TextDecoder();
  const xml = (nombre: string): Document => {
    const contenido = archivos.get(nombre);
    if (!contenido) throw new Error('Este Excel no contiene una hoja que podamos leer. Guárdalo de nuevo como .xlsx o CSV.');
    return new DOMParser().parseFromString(lector.decode(contenido), 'application/xml');
  };
  const compartidas = archivos.has('xl/sharedStrings.xml')
    ? [...xml('xl/sharedStrings.xml').getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
    : [];
  const libro = xml('xl/workbook.xml');
  const hojaNombre = libro.getElementsByTagName('sheet')[0]?.getAttribute('name');
  if (!hojaNombre) throw new Error('El Excel no tiene hojas con datos.');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const id = libro.getElementsByTagName('sheet')[0].getAttribute('r:id');
  const relacion = [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === id);
  const ruta = relacion?.getAttribute('Target') ?? 'worksheets/sheet1.xml';
  const rutaHoja = ruta.startsWith('/') ? ruta.slice(1) : `xl/${ruta.replace(/^\.\//, '')}`;
  const hoja = xml(rutaHoja);
  const celdas = [...hoja.getElementsByTagName('row')].map((fila) => {
    const resultado: unknown[] = [];
    for (const celda of [...fila.getElementsByTagName('c')]) {
      const referencia = celda.getAttribute('r') ?? '';
      const letras = referencia.match(/^[A-Z]+/)?.[0] ?? '';
      let columna = 0;
      for (const letra of letras) columna = columna * 26 + letra.charCodeAt(0) - 64;
      columna--;
      const v = celda.getElementsByTagName('v')[0]?.textContent ?? '';
      const tipo = celda.getAttribute('t');
      const valor: unknown = tipo === 's' ? compartidas[Number(v)] ?? '' : tipo === 'inlineStr' ? [...celda.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('') : Number.isFinite(Number(v)) && v !== '' ? Number(v) : v;
      resultado[columna] = valor;
    }
    return resultado;
  });
  return celdas;
};

export const leerArchivoTabular = async (archivo: File): Promise<AnalisisResultado> => {
  const extension = archivo.name.toLowerCase().split('.').pop();
  if (extension === 'csv' || archivo.type === 'text/csv') {
    const contenido = await archivo.text();
    return analizarFilas(csvComoFilas(contenido));
  }
  if (extension === 'xlsx' || archivo.type.includes('spreadsheetml')) {
    return analizarFilas(await leerXlsx(archivo));
  }
  throw new Error('Este formato no es compatible. Usa PDF, imagen, Excel .xlsx o CSV.');
};

export const analizarTextoOCR = (contenido: string): AnalisisResultado => {
  const filas = contenido.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean).map((linea) => {
    const fecha = linea.match(/\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/);
    if (!fecha) return null;
    const resto = linea.replace(fecha[0], '');
    const montos = resto.match(/(?:COP\s*)?\$?\s*-?\d[\d.,]*/g);
    // A second number may be a running balance or a quota. Without the visual
    // column boundaries, guessing which one is the movement could corrupt the
    // ledger, so that line is left for CSV/PDF import instead.
    if (montos?.length !== 1) return null;
    const monto = montoImportado(montos[montos.length - 1]);
    const descripcion = resto.replace(montos[montos.length - 1], '').replace(/\s+/g, ' ').trim();
    if (!monto || !descripcion) return null;
    return [fecha[0], descripcion, /\b(abono|ingreso|deposito|consignacion|transferencia recibida)\b/i.test(linea) ? monto : '', /\b(abono|ingreso|deposito|consignacion|transferencia recibida)\b/i.test(linea) ? '' : monto];
  }).filter((fila): fila is string[] => fila !== null);
  if (!filas.length) throw new Error('No logramos reconocer filas con fecha, detalle y valor en la imagen. Prueba una foto nítida o sube el extracto como PDF o CSV.');
  const resultado = analizarFilas([['Fecha', 'Descripción', 'Crédito', 'Débito'], ...filas]);
  resultado.movimientos = resultado.movimientos.map((movimiento) => ({ ...movimiento, confianza: 'media' }));
  resultado.advertencias.unshift('El reconocimiento de la foto puede confundir cifras; revisa cada movimiento antes de confirmarlo.');
  return resultado;
};
