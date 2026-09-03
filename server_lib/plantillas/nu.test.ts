import { describe, expect, it } from 'vitest';
import { pareceNu, parsearNu, periodoNu } from './nu';

const EXTRACTO = `Hola, Juana
Llegó tu extracto de Junio
Juana Perez Ejemplo
Nu Financiera
Periodo
01 - 30 JUN 2026
Resumen de tus movimientos
Tu dinero al inicio del mes $200.145,48
Nu Colombia Compañía de Financiamiento S.A.
Movimientos
04 jun Recibiste de Maria Ejemplo +$61.000,00
04 jun Pagaste tu tarjeta -$60.890,00
Impuesto del 4x1000 -$243,56
08 jun Enviaste a Solmar Ejemplo -$200.000,00
Nu Financiera
`;

describe('plantilla Nu', () => {
  it('reconoce un extracto de Nu', () => {
    expect(pareceNu(EXTRACTO)).toBe(true);
    expect(pareceNu('cualquier otro texto')).toBe(false);
  });

  it('extrae el período', () => {
    expect(periodoNu(EXTRACTO)).toEqual({
      desde: '2026-06-01',
      hasta: '2026-06-30',
      etiqueta: '01-30 JUN 2026',
    });
  });

  it('extrae el período de corte que Nu imprime entre dos meses', () => {
    expect(periodoNu('Llegó tu extracto de Agosto\n29 JUL 2026 - 28 AGO\nMovimientos')).toEqual({
      desde: '2026-07-29',
      hasta: '2026-08-28',
      etiqueta: '29 JUL 2026 - 28 AGO',
    });
  });

  it('parsea movimientos con fecha corta y monto en formato latino', () => {
    const movimientos = parsearNu(EXTRACTO);
    expect(movimientos).toHaveLength(4);

    expect(movimientos[0]).toMatchObject({
      fecha: '2026-06-04',
      montoCop: 61000,
      tipo: 'ingreso',
      categoria: 'transferencia',
    });
    expect(movimientos[1]).toMatchObject({
      fecha: '2026-06-04',
      montoCop: 60890,
      tipo: 'gasto',
      exclusion: 'pago-tarjeta',
    });
  });

  it('asocia el impuesto del 4x1000 a la fecha del movimiento anterior', () => {
    const impuesto = parsearNu(EXTRACTO)[2];
    expect(impuesto).toMatchObject({ fecha: '2026-06-04', montoCop: 244, tipo: 'gasto' });
  });

  it('sin sección "Movimientos" no produce nada', () => {
    expect(parsearNu('Nu Financiera\n01 - 30 JUN 2026')).toEqual([]);
  });
});
