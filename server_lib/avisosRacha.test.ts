import { describe, expect, it, vi } from 'vitest';
import { cargaAvisoRacha, cronAutorizado, enviarAvisosRacha, type DestinoAviso } from './avisosRacha';

const destino = (n: number): DestinoAviso => ({
  user_id: `u${n}`,
  racha_actual: 5,
  endpoint: `https://push.example/${n}`,
  suscripcion: {},
});

describe('cronAutorizado', () => {
  it('acepta solo el secreto exacto', () => {
    expect(cronAutorizado('abc', 'abc')).toBe(true);
    expect(cronAutorizado('abd', 'abc')).toBe(false);
    expect(cronAutorizado('abcd', 'abc')).toBe(false);
  });
  it('sin secreto configurado nunca autoriza', () => {
    expect(cronAutorizado('', '')).toBe(false);
    expect(cronAutorizado('x', undefined)).toBe(false);
    expect(cronAutorizado(undefined, 'abc')).toBe(false);
  });
});

describe('enviarAvisosRacha', () => {
  it('cuenta enviados y fallidos, y sigue con los demás tras un fallo', async () => {
    const enviar = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
      .mockResolvedValueOnce(undefined);
    const depurar = vi.fn();
    const r = await enviarAvisosRacha([destino(1), destino(2), destino(3)], enviar, depurar);
    expect(r).toEqual({ enviados: 2, fallidos: 1, depurados: 0 });
    expect(depurar).not.toHaveBeenCalled();
  });

  it('borra la suscripción cuando el aparato ya no existe (410)', async () => {
    const enviar = vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const depurar = vi.fn().mockResolvedValue(undefined);
    const r = await enviarAvisosRacha([destino(1)], enviar, depurar);
    expect(r).toEqual({ enviados: 0, fallidos: 0, depurados: 1 });
    expect(depurar).toHaveBeenCalledWith(destino(1));
  });

  it('el mensaje nombra los días de racha en juego', () => {
    expect(cargaAvisoRacha(12).titulo).toContain('12 días');
  });
});
