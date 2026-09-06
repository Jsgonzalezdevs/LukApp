import { describe, expect, it } from 'vitest';
import type { ContextoFinanciero } from './motorFinanciero';
import { construirCentroInteligencia, construirContextoParaAsesor } from './centroInteligenciaFinanciera';

const contexto = (over: Partial<ContextoFinanciero> = {}): ContextoFinanciero => ({
  saldo: { patrimonioCop: 900000 } as ContextoFinanciero['saldo'],
  compromisos: { datosIncompletos: false } as ContextoFinanciero['compromisos'],
  liquidez: { nivel: 'riesgo', disponibleDiarioCop: 0, disponibleDiarioBrutoCop: -500000, factores: [] } as unknown as ContextoFinanciero['liquidez'],
  obligaciones: [], anomalias: [], metasInteligentes: [], proyeccionCompleta: [],
  ...over,
} as ContextoFinanciero);

describe('CentroInteligenciaFinanciera', () => {
  it('solo expone valores del contexto y conserva el bruto negativo', () => {
    const resultado = construirCentroInteligencia(contexto());
    expect(resultado.disponibleDiarioCop).toBe(0);
    expect(resultado.disponibleDiarioBrutoCop).toBe(-500000);
    expect(resultado.patrimonioCop).toBe(900000);
    expect(resultado.situacion).toBe('riesgo');
  });

  it('prioriza señales sin mutar el contexto', () => {
    const señales = [{ id: 'b', confianza: 0.5, impactoCop: 100, tipo: 'x', titulo: '', razon: '', evidencia: [] }, { id: 'a', confianza: 0.9, impactoCop: 1, tipo: 'x', titulo: '', razon: '', evidencia: [] }];
    const original = [...señales];
    const resultado = construirCentroInteligencia(contexto({ anomalias: señales }));
    expect(resultado.señales.map((s) => s.id)).toEqual(['a', 'b']);
    expect(señales).toEqual(original);
  });

  it('prepara IA sin exponer movimientos ni recalcular métricas', () => {
    const base = contexto();
    const asesor = construirContextoParaAsesor(base);
    expect(asesor.patrimonioCop).toBe(base.saldo.patrimonioCop);
    expect(asesor.liquidez).toBe(base.liquidez);
    expect(asesor.obligaciones).toBe(base.obligaciones);
    expect('transacciones' in asesor).toBe(false);
  });
});
