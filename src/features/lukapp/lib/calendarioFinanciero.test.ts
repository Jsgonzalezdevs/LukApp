import { describe, expect, it } from 'vitest';
import { eventosDelContexto } from './calendarioFinanciero';
import type { ContextoFinanciero } from './motorFinanciero';

const contexto = (overrides: Partial<ContextoFinanciero> = {}): ContextoFinanciero => ({
  saldo: { totalActivosCop: 0, totalPasivosCop: 0, patrimonioCop: 0, saldoCuentasCop: 0, saldoAhorrosCop: 0, saldoTarjetasCop: 0, saldoDeudasCop: 0 },
  compromisos: { reservasCop: 0, ahorroComprometidoCop: 0, obligacionesCop: 0, cuotasCop: 0, pagosTarjetaCop: 0, totalCop: 0, datosIncompletos: false },
  liquidez: { dineroLibreCop: 0, dineroLibreBrutoCop: 0, saldoLiquidoCop: 0, obligacionesPendientesCop: 0, cuotasPendientesCop: 0, compromisosMetasCop: 0, diasRestantesPeriodo: 1, disponibleDiarioCop: 0, disponibleDiarioBrutoCop: 0, liquidezMinimaCop: null, nivel: 'bien', confianza: 'alta', factores: [] },
  proyeccion: { supuestos: [], limitada: false, saldoFinalEstimadoCop: null, serie: [] }, proyeccionCompleta: [], metas: [], presupuestos: [], obligaciones: [], anomalias: [], tarjetas: [], entradasFuturas: [], ...overrides,
});

describe('calendario financiero', () => {
  it('adapta obligaciones e ingresos sin recalcularlos', () => {
    const eventos = eventosDelContexto(contexto({ obligaciones: [{ id: 'o', origen: 'deuda', concepto: 'Deuda', fecha: null, periodo: '2026-09', montoCop: 300, cuentaId: 'd', estado: 'desconocida', certeza: 'desconocida' }], entradasFuturas: [{ id: 'i', fecha: '2026-09-10', periodo: '2026-09', montoCop: 500, certeza: 'programada', concepto: 'Salario' }] }), '2026-09-05');
    expect(eventos).toMatchObject([{ id: 'i', tipo: 'ingreso', estado: 'proximo' }, { id: 'o', tipo: 'deuda', estado: 'desconocido', precision: 'periodo' }]);
  });
  it('clasifica hoy y vencidos de forma determinista', () => {
    const eventos = eventosDelContexto(contexto({ obligaciones: [
      { id: 'h', origen: 'manual', concepto: 'Hoy', fecha: '2026-09-05', periodo: '2026-09', montoCop: 1, cuentaId: null, estado: 'programada', certeza: 'real' },
      { id: 'v', origen: 'recurrente', concepto: 'Vencido', fecha: '2026-09-01', periodo: '2026-09', montoCop: 1, cuentaId: null, estado: 'vencida', certeza: 'programada' },
    ] }), '2026-09-05');
    expect(eventos.map((e) => e.estado)).toEqual(['vencido', 'hoy']);
  });
});
