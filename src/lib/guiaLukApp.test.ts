import { describe, expect, it } from 'vitest';
import { guiaLukAppPara, TEMAS_GUIA_LUKAPP, temasGuiaPara } from './guiaLukApp.ts';

const ids = (pregunta: string) => temasGuiaPara(pregunta).map((t) => t.id);

describe('guía de LukApp para el Asesor', () => {
  it('trae el paso a paso del saldo aunque la pregunta venga con errores', () => {
    expect(ids('ayudame a actualizazr mis saldos')).toContain('saldo');
    expect(guiaLukAppPara('ayudame a actualizar mis saldos')).toContain('Saldo actual');
  });

  it('elige el tema por la pregunta y no por pedazos de otra palabra', () => {
    expect(ids('¿cómo pago la tarjeta de crédito?')).toContain('tarjetas');
    expect(ids('quiero revisar algo')).not.toContain('tarjetas');
    expect(ids('¿Cómo armo una vaca para el paseo?')).toContain('compartir');
  });

  it('no adjunta nada cuando la pregunta no toca la app', () => {
    expect(guiaLukAppPara('hola, ¿cómo estás?')).toBe('');
  });

  it('no le cuenta al Asesor cómo está construida la app por dentro', () => {
    for (const tema of TEMAS_GUIA_LUKAPP) {
      expect(tema.texto).not.toMatch(/supabase|server\.ts|react|typescript|base de datos|\bapi\b/i);
    }
  });

  it('cabe en la cuota del proveedor: ningún tema se pasa de 1.200 caracteres', () => {
    for (const tema of TEMAS_GUIA_LUKAPP) expect(tema.texto.length).toBeLessThan(1200);
  });
});
