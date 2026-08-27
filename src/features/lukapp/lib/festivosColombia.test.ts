import { describe, expect, it } from 'vitest';
import {
  calcularFechaPagoColombia,
  esDiaHabilColombia,
  obtenerFestivosColombia,
} from './festivosColombia';

describe('festivosColombia - festivos oficiales', () => {
  it('calcula correctamente los festivos fijos de Colombia', () => {
    const festivos2026 = obtenerFestivosColombia(2026);
    expect(festivos2026).toContain('2026-01-01'); // Año nuevo
    expect(festivos2026).toContain('2026-05-01'); // Día del trabajo
    expect(festivos2026).toContain('2026-07-20'); // Independencia
    expect(festivos2026).toContain('2026-08-07'); // Batalla de Boyacá
    expect(festivos2026).toContain('2026-12-25'); // Navidad
  });

  it('detecta fines de semana y festivos como no hábiles', () => {
    // 1 de Enero 2026 es festivo
    expect(esDiaHabilColombia('2026-01-01')).toBe(false);
    // Un domingo cualquiera
    expect(esDiaHabilColombia('2026-01-04')).toBe(false);
    // Un martes laboral ordinario
    expect(esDiaHabilColombia('2026-01-13')).toBe(true);
  });

  it('adelanta el pago de nómina al día hábil anterior si cae en fin de semana', () => {
    // Febrero 2026: el 15 de febrero es domingo. El pago de quincena debe ser el viernes 13.
    const pagoQ1 = calcularFechaPagoColombia(2026, 2, 'quincena_1', true);
    expect(pagoQ1).toBe('2026-02-13');
    expect(esDiaHabilColombia(pagoQ1)).toBe(true);
  });
});
