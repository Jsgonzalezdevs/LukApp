import { describe, expect, it } from 'vitest';
import { esRutaConfirmacionPago, segmentosDe } from './useRuta';

describe('ruta de confirmación de pago', () => {
  it('reconoce la pantalla dedicada, con o sin el prefijo histórico', () => {
    expect(esRutaConfirmacionPago('/pago/confirmado', '')).toBe(true);
    expect(esRutaConfirmacionPago('/finanzas/pago/confirmado', '')).toBe(true);
  });

  it('solo convierte el regreso antiguo en confirmación cuando Wompi trae un id', () => {
    expect(esRutaConfirmacionPago('/finanzas/ajustes/cuenta', '?id=123')).toBe(true);
    expect(esRutaConfirmacionPago('/ajustes/cuenta', '')).toBe(false);
    expect(segmentosDe('/finanzas/ajustes/cuenta')).toEqual(['ajustes', 'cuenta']);
  });
});
