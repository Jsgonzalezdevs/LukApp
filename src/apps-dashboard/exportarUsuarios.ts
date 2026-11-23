import type { Perfil } from './superadmin.types';

// El panel tiene su propia forma de rol; para exportar basta el nombre.
type RolConNombre = { id: string; nombre: string };

/**
 * Exporta la lista de usuarios del superadmin a un .xlsx de verdad.
 *
 * Se arma a mano (un zip sin comprimir con cuatro XML) para no meter una
 * librería de cientos de KB en el bundle por un botón que usa un admin de vez
 * en cuando. El .xls XML que usa la exportación de finanzas hace que Excel
 * avise de "formato y extensión no coinciden"; aquí no hay ese aviso.
 */

type Celda = { tipo: 'texto'; valor: string } | { tipo: 'fecha'; valor: number } | { tipo: 'vacia' };

const ENCABEZADOS = ['Correo', 'Nombre de usuario', 'Rol', 'Fecha de registro', 'Último acceso'];
const ANCHOS = [36, 24, 18, 20, 20];

// Colombia no tiene horario de verano: un desfase fijo da la misma hora que ve
// el admin en el panel, sin depender de la zona del navegador.
const DESFASE_COLOMBIA_MS = -5 * 60 * 60 * 1000;

/** Serial de fecha de Excel (días desde 1899-12-30) en hora de Colombia. */
export const fechaSerialExcel = (iso: string): number | null => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return (ms + DESFASE_COLOMBIA_MS) / 86_400_000 + 25_569;
};

const nombreRol = (perfil: Perfil, roles: RolConNombre[]): string => {
  if (perfil.rol === 'admin') return 'Admin';
  if (perfil.rol_personalizado_id) {
    return roles.find((r) => r.id === perfil.rol_personalizado_id)?.nombre ?? 'Rol desconocido';
  }
  return 'Usuario';
};

const celdaFecha = (iso: string | null): Celda => {
  const serial = iso ? fechaSerialExcel(iso) : null;
  return serial === null ? { tipo: 'vacia' } : { tipo: 'fecha', valor: serial };
};

export const filasUsuarios = (usuarios: Perfil[], roles: RolConNombre[]): Celda[][] =>
  usuarios.map((u) => [
    { tipo: 'texto', valor: u.email },
    { tipo: 'texto', valor: u.usuario ?? '' },
    { tipo: 'texto', valor: nombreRol(u, roles) },
    celdaFecha(u.created_at),
    celdaFecha(u.ultimo_acceso_at),
  ]);

// Excel rechaza el archivo entero si aparece un carácter de control suelto.
const escaparXml = (texto: string) =>
  texto
    .split('')
    .filter((c) => {
      const codigo = c.charCodeAt(0);
      return codigo >= 0x20 || codigo === 0x09 || codigo === 0x0a || codigo === 0x0d;
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const letraColumna = (indice: number) => String.fromCharCode(65 + indice);

const xmlCelda = (celda: Celda, ref: string, estiloTexto: number): string => {
  if (celda.tipo === 'vacia') return '';
  if (celda.tipo === 'fecha') return `<c r="${ref}" s="2"><v>${celda.valor}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${estiloTexto}"><is><t xml:space="preserve">${escaparXml(celda.valor)}</t></is></c>`;
};

const xmlHoja = (filas: Celda[][]): string => {
  const encabezado = ENCABEZADOS.map((t, i) => xmlCelda({ tipo: 'texto', valor: t }, `${letraColumna(i)}1`, 1)).join('');
  const cuerpo = filas
    .map((fila, f) => {
      const n = f + 2;
      return `<row r="${n}">${fila.map((c, i) => xmlCelda(c, `${letraColumna(i)}${n}`, 0)).join('')}</row>`;
    })
    .join('');
  const ultima = letraColumna(ENCABEZADOS.length - 1);
  const columnas = ANCHOS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // Encabezado congelado y con filtro: lo primero que se hace con una lista de correos es filtrarla.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${columnas}</cols>` +
    `<sheetData><row r="1">${encabezado}</row>${cuerpo}</sheetData>` +
    `<autoFilter ref="A1:${ultima}${filas.length + 1}"/>` +
    '</worksheet>'
  );
};

const ARCHIVOS_FIJOS: Record<string, string> = {
  '[Content_Types].xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>',
  '_rels/.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>',
  'xl/workbook.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Usuarios" sheetId="1" r:id="rId1"/></sheets>' +
    '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Usuarios!$A$1:$E$1</definedName></definedNames>' +
    '</workbook>',
  'xl/_rels/workbook.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>',
  // Estilos: 0 normal, 1 encabezado en negrita con fondo, 2 fecha y hora.
  'xl/styles.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF7C3AED"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '</styleSheet>',
};

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

const crc32 = (datos: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of datos) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** Zip "store" (sin comprimir): para unos cientos de filas el tamaño da igual. */
const armarZip = (archivos: Array<{ nombre: string; contenido: string }>): Uint8Array => {
  const codificador = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const { nombre, contenido } of archivos) {
    const nombreBytes = codificador.encode(nombre);
    const datos = codificador.encode(contenido);
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombreBytes.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true); // nombres en UTF-8
    vl.setUint32(14, crc, true);
    vl.setUint32(18, datos.length, true);
    vl.setUint32(22, datos.length, true);
    vl.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);

    const entrada = new Uint8Array(46 + nombreBytes.length);
    const vc = new DataView(entrada.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, datos.length, true);
    vc.setUint32(24, datos.length, true);
    vc.setUint16(28, nombreBytes.length, true);
    vc.setUint32(42, desplazamiento, true);
    entrada.set(nombreBytes, 46);

    partes.push(local, datos);
    central.push(entrada);
    desplazamiento += local.length + datos.length;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, fin];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};

export const generarXlsxUsuarios = (usuarios: Perfil[], roles: RolConNombre[]): Uint8Array =>
  armarZip([
    ...Object.entries(ARCHIVOS_FIJOS).map(([nombre, contenido]) => ({ nombre, contenido })),
    { nombre: 'xl/worksheets/sheet1.xml', contenido: xmlHoja(filasUsuarios(usuarios, roles)) },
  ]);

export const descargarUsuariosExcel = (usuarios: Perfil[], roles: RolConNombre[]) => {
  const bytes = generarXlsxUsuarios(usuarios, roles);
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `lukapp-usuarios-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Safari cancela la descarga si se revoca en el mismo tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
