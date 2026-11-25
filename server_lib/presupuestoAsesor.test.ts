import { describe, expect, it } from 'vitest';
import {
  MAX_CARACTERES_CONTEXTO_ASESOR,
  MAX_CARACTERES_MENSAJE_HISTORIAL,
  MAX_TOKENS_RESPUESTA_ASESOR,
  PRESUPUESTO_TOKENS_ASESOR,
  caracteresContextoDisponibles,
  acotarHistorialAsesor,
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
    const fijos = 14_000;
    const contexto = caracteresContextoDisponibles(fijos);
    const tokensEstimados = (fijos + contexto) / 3.2 + MAX_TOKENS_RESPUESTA_ASESOR;
    expect(tokensEstimados).toBeLessThanOrEqual(PRESUPUESTO_TOKENS_ASESOR);
    expect(contexto).toBeLessThan(MAX_CARACTERES_CONTEXTO_ASESOR);
  });

  it('sin historial ni documentos conserva el expediente completo', () => {
    expect(caracteresContextoDisponibles(4_000)).toBe(MAX_CARACTERES_CONTEXTO_ASESOR);
  });

  it('nunca deja al modelo sin expediente', () => {
    expect(caracteresContextoDisponibles(100_000)).toBe(2_000);
  });
});
