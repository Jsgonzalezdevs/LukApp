import { describe, expect, it } from 'vitest';
import type { Meta } from '../data/modelos';
import type { ContextoFinanciero } from './motorFinanciero';
import { metasConProgreso } from './metas';
import { evaluarMetas } from './metasInteligentes';

const base: Meta = {
  id: 'm1', nombre: 'Viaje', icon: '✈️', objetivoCop: 1000000,
  fechaObjetivo: '2026-12-31', cajitaId: null, ahorradoCop: 0,
  createdAt: '2026-01-01', completedAt: null,
};

const contexto = (meta: Meta, dineroLibreCop: number): ContextoFinanciero => ({
  metas: metasConProgreso([meta], new Map(), '2026-09-05'),
  liquidez: { dineroLibreCop } as ContextoFinanciero['liquidez'],
} as unknown as ContextoFinanciero);

describe('metas inteligentes', () => {
  it('reutiliza progreso y ritmo requerido sin inventar ritmo actual ni fecha estimada', () => {
    const [resultado] = evaluarMetas(contexto(base, 500000));
    expect(resultado.restanteCop).toBe(1000000);
    expect(resultado.ritmoNecesarioCop).toBeGreaterThan(0);
    expect(resultado.ritmoActualCop).toBeNull();
    expect(resultado.fechaEstimada).toBeNull();
    expect(resultado.confianza).toBe('baja');
  });

  it('no usa disponible diario como ahorro y marca riesgo si el ritmo requerido supera liquidez', () => {
    const [resultado] = evaluarMetas(contexto(base, 1));
    expect(resultado.viabilidad).toBe('en_riesgo');
  });

  it('marca una meta completada como viable sin crear obligación', () => {
    const [resultado] = evaluarMetas(contexto({ ...base, ahorradoCop: 1000000 }, 0));
    expect(resultado.viabilidad).toBe('viable');
    expect(resultado.restanteCop).toBe(0);
  });

  it('representa objetivo ausente como sin datos', () => {
    const [resultado] = evaluarMetas(contexto({ ...base, objetivoCop: null as unknown as number }, 500000));
    expect(resultado.viabilidad).toBe('sin_datos');
    expect(resultado.restanteCop).toBeNull();
  });
});
