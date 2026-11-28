import { describe, expect, it } from 'vitest';
import {
  MAX_CARACTERES_CONTEXTO_ASESOR,
  MAX_CARACTERES_MENSAJE_HISTORIAL,
  MAX_TOKENS_RESPUESTA_ASESOR,
  PRESUPUESTO_TOKENS_ASESOR,
  caracteresContextoDisponibles,
  acotarHistorialAsesor,
  compactarParaIA,
  insightsSiguenVigentes,
  recortarConMuestras,
} from './presupuestoAsesor';

describe('presupuesto del Asesor', () => {
  it('conserva el inicio y el final de un contexto que supera el presupuesto', () => {
    const texto = `inicio-${'a'.repeat(130)}-final`;
    const resultado = recortarConMuestras(texto, 100);

    expect(resultado).toHaveLength(100);
    expect(resultado).toContain('inicio-');
    expect(resultado).toContain('-final');
    expect(resultado).toContain('detalle omitido');
  });

  it('solo deja los últimos mensajes y acota cada uno', () => {
    const resultado = acotarHistorialAsesor(Array.from({ length: 6 }, (_, indice) => ({
      role: indice % 2 === 0 ? 'user' : 'assistant',
      text: `${indice}-${'x'.repeat(MAX_CARACTERES_MENSAJE_HISTORIAL + 100)}`,
    })));

    expect(resultado).toHaveLength(4);
    expect(resultado[0].content.startsWith('2-')).toBe(true);
    expect(resultado[3].content.startsWith('5-')).toBe(true);
    expect(resultado.every((mensaje) => mensaje.content.length <= MAX_CARACTERES_MENSAJE_HISTORIAL)).toBe(true);
  });
});

describe('caracteresContextoDisponibles', () => {
  it('le da al expediente solo lo que sobra dentro de la cuota de Groq', () => {
    const fijos = 10_000;
    const contexto = caracteresContextoDisponibles(fijos);
    const tokensEstimados = (fijos + contexto) / 3.2 + MAX_TOKENS_RESPUESTA_ASESOR;
    expect(tokensEstimados).toBeLessThanOrEqual(PRESUPUESTO_TOKENS_ASESOR);
    expect(contexto).toBeLessThan(MAX_CARACTERES_CONTEXTO_ASESOR);
  });

  it('sin historial ni documentos conserva el expediente completo', () => {
    expect(caracteresContextoDisponibles(2_000)).toBe(MAX_CARACTERES_CONTEXTO_ASESOR);
  });

  it('nunca deja al modelo sin expediente', () => {
    expect(caracteresContextoDisponibles(100_000)).toBe(2_000);
  });
});

describe('una consulta deja aire en la cuota por minuto', () => {
  it('el presupuesto del Asesor no pasa del 70 % de los 8.000 tokens de Groq gratis', () => {
    expect(PRESUPUESTO_TOKENS_ASESOR).toBeLessThanOrEqual(8_000 * 0.7);
  });
});

describe('compactarParaIA', () => {
  it('conserva los extremos de una serie larga', () => {
    const serie = Array.from({ length: 40 }, (_, i) => i);
    expect(compactarParaIA(serie)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 32, 33, 34, 35, 36, 37, 38, 39]);
  });
});

describe('insightsSiguenVigentes', () => {
  const ahora = Date.parse('2026-11-27T12:00:00Z');
  it('reutiliza un análisis de hace un par de horas', () => {
    expect(insightsSiguenVigentes('2026-11-27T10:00:00Z', ahora)).toBe(true);
  });
  it('pide uno nuevo cuando ya pasó la vigencia', () => {
    expect(insightsSiguenVigentes('2026-11-27T05:00:00Z', ahora)).toBe(false);
  });
  it('no confía en fechas vacías, inválidas o futuras', () => {
    expect(insightsSiguenVigentes(null, ahora)).toBe(false);
    expect(insightsSiguenVigentes('ayer', ahora)).toBe(false);
    expect(insightsSiguenVigentes('2026-11-28T00:00:00Z', ahora)).toBe(false);
  });
});
