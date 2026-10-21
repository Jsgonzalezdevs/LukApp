import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analizarFilas, analizarTextoOCR, fechaImportada, leerArchivoTabular, montoImportado } from './leerImportacion';

describe('normalización de valores importados', () => {
  it('interpreta fechas colombianas y números de Excel', () => {
    expect(fechaImportada('20/10/2026')).toBe('2026-10-20');
    expect(fechaImportada('20/10/2026 18:45:00')).toBe('2026-10-20');
    expect(fechaImportada(46_315)).toBe('2026-10-20');
    expect(fechaImportada('31/02/2026')).toBeNull();
  });

  it('lee montos con separador colombiano, internacional y signo', () => {
    expect(montoImportado('$ 1.250.000')).toBe(1_250_000);
    expect(montoImportado('1,250.00')).toBe(1_250);
    expect(montoImportado('-25.000')).toBe(25_000);
  });
});

describe('analizarFilas', () => {
  it('reconoce CSV con débito y crédito separados y conserva filas dudosas fuera', () => {
    const resultado = analizarFilas([
      ['Fecha', 'Descripción', 'Débito', 'Crédito'],
      ['15/10/2026', 'Mercado con; coma', '75.000', ''],
      ['16/10/2026', 'Pago nómina', '', '2.500.000'],
      ['No es fecha', 'Fila resumen', '', '4.000'],
    ]);
    expect(resultado.movimientos).toHaveLength(2);
    expect(resultado.movimientos[0]).toMatchObject({ fecha: '2026-10-15', descripcion: 'Mercado con; coma', montoCop: 75_000, tipo: 'gasto' });
    expect(resultado.movimientos[1]).toMatchObject({ montoCop: 2_500_000, tipo: 'ingreso' });
  });

  it('rechaza archivos sin encabezados seguros en vez de adivinar columnas', () => {
    expect(() => analizarFilas([['x', 'y'], ['a', 'b']])).toThrow(/columnas de fecha/);
  });

  it('conserva la marca de saldo de un CSV exportado desde LukApp', () => {
    const resultado = analizarFilas([
      ['Fecha', 'Tipo', 'Monto', 'Categoría', 'Descripción', 'Cuenta', 'Afecta saldo'],
      ['2025-01-01', 'gasto', '25000', 'comida', 'Café', 'Efectivo', 'No'],
    ]);
    expect(resultado.movimientos[0]).toMatchObject({ categoria: 'comida', afectaSaldo: false });
  });

  it('lee CSV local con delimitador punto y coma y campos entre comillas', async () => {
    const archivo = new File(['Fecha;Descripción;Débito;Crédito\n15/10/2026;"Café; centro";8.500;'], 'movimientos.csv', { type: 'text/csv' });
    const resultado = await leerArchivoTabular(archivo);
    expect(resultado.movimientos[0]).toMatchObject({ descripcion: 'Café; centro', montoCop: 8_500, tipo: 'gasto' });
  });

  it('ignora comas dentro de una celda al detectar el delimitador del CSV', async () => {
    const archivo = new File(['Fecha,Descripción,Valor,Tipo\n20/10/2026,"Café, centro",4500,Gasto'], 'movimientos.csv', { type: 'text/csv' });
    const resultado = await leerArchivoTabular(archivo);
    expect(resultado.movimientos[0]).toMatchObject({ descripcion: 'Café, centro', montoCop: 4_500, tipo: 'gasto' });
  });

  it('lee una hoja .xlsx con fechas de Excel y celdas compartidas', async () => {
    const bytes = await readFile(resolve(process.cwd(), 'src/features/lukapp/analista/__fixtures__/extracto-prueba.xlsx'));
    const archivo = new File([bytes], 'extracto.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const resultado = await leerArchivoTabular(archivo);
    expect(resultado.movimientos).toMatchObject([
      { fecha: '2026-10-20', descripcion: 'Mercado', montoCop: 45_000, tipo: 'gasto' },
      { fecha: '2026-10-21', descripcion: 'Nómina', montoCop: 2_500_000, tipo: 'ingreso' },
    ]);
  });
});

describe('analizarTextoOCR', () => {
  it('extrae líneas de una imagen sin asegurar el tipo cuando el OCR no lo identifica', () => {
    const resultado = analizarTextoOCR('20/10/2026 COMPRA PANADERIA 15.500\n21/10/2026 ABONO NOMINA 1.200.000');
    expect(resultado.movimientos).toMatchObject([
      { fecha: '2026-10-20', montoCop: 15_500, tipo: 'gasto' },
      { fecha: '2026-10-21', montoCop: 1_200_000, tipo: 'ingreso' },
    ]);
  });
});
