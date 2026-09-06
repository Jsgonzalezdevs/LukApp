import { describe, expect, it } from 'vitest';
import { instantaneaVacia } from '../data/repositorio';
import type { Cajita } from '../data/modelos';
import { PERIODO_POR_DEFECTO } from './periodo';
import { construirContextoFinanciero } from './motorFinanciero';
import { construirContextoParaAsesor } from './centroInteligenciaFinanciera';

const cajita = (id: string, tipo: Cajita['tipo']): Cajita => ({ id, nombre: id, icon: 'wallet', tipo, metaCop: null, tasaEaPct: null, createdAt: '2026-01-01', archivedAt: null, claseCuenta: 'banco' });
const movimiento = (id: string, cajitaId: string, deltaCop: number, kind: 'ajuste' | 'retiro' | 'deposito' = 'ajuste') => ({ id, cajitaId, kind, deltaCop, categoria: null, occurredOn: '2026-09-01', nota: '', createdAt: '2026-09-01' });
const entrada = () => ({ ...instantaneaVacia(), hoy: '2026-09-05', periodo: PERIODO_POR_DEFECTO });

describe('integridad financiera transversal', () => {
  it('conserva patrimonio al mover dinero entre cuentas propias y no crea obligación', () => {
    const e = entrada();
    e.cajitas = [cajita('a', 'cuenta'), cajita('b', 'cuenta')];
    e.cajitaMovimientos = [movimiento('saldo', 'a', 1_000_000), movimiento('sale', 'a', -300_000, 'retiro'), movimiento('entra', 'b', 300_000, 'deposito')];
    const r = construirContextoFinanciero(e);
    expect(r.saldo.patrimonioCop).toBe(1_000_000);
    expect(r.obligaciones).toHaveLength(0);
  });

  it('mantiene determinismo, mínimo proyectado e inmutabilidad', () => {
    const e = entrada(); e.cajitas = [cajita('a', 'cuenta')]; e.cajitaMovimientos = [movimiento('saldo', 'a', 500_000)];
    const antes = JSON.stringify(e); const uno = construirContextoFinanciero(e); const dos = construirContextoFinanciero(e);
    expect(dos).toEqual(uno);
    expect(uno.liquidez.liquidezMinimaCop).toBe(500_000);
    expect(JSON.stringify(e)).toBe(antes);
  });

  it('entrega al asesor las mismas referencias centrales sin movimientos crudos', () => {
    const contexto = construirContextoFinanciero(entrada());
    const asesor = construirContextoParaAsesor(contexto);
    expect(asesor.patrimonioCop).toBe(contexto.saldo.patrimonioCop);
    expect(asesor.forecast).toBe(contexto.forecast);
    expect('transacciones' in asesor).toBe(false);
  });
});
