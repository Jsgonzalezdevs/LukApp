import { describe, expect, it } from 'vitest';
import {
  centavosWompi,
  checksumEsperadoWompi,
  coincideChecksum,
  configuracionWompi,
  firmaIntegridadWompi,
} from './wompi';

const entornoSandbox: NodeJS.ProcessEnv = {
  WOMPI_AMBIENTE: 'sandbox',
  WOMPI_PUBLIC_KEY: 'pub_test_publica',
  WOMPI_INTEGRITY_SECRET: 'test_integrity_secreto',
  WOMPI_EVENTS_SECRET: 'test_events_secreto',
  WOMPI_REDIRECT_URL: 'https://lukapp.example/pago/confirmado',
};

describe('Wompi', () => {
  it('solo permite llaves y secretos del ambiente seleccionado', () => {
    expect(configuracionWompi(entornoSandbox)).toMatchObject({ ambiente: 'test' });
    expect(() => configuracionWompi({ ...entornoSandbox, WOMPI_EVENTS_SECRET: 'prod_events_cruzado' }))
      .toThrow('no corresponden');
  });

  it('convierte los precios COP al formato de centavos de Wompi', () => {
    expect(centavosWompi(9900)).toBe(990000);
    expect(() => centavosWompi(9900.5)).toThrow('entero seguro');
  });

  it('firma la intención incluyendo el vencimiento del checkout', () => {
    expect(firmaIntegridadWompi(
      'LUKM-123',
      990000,
      '2030-01-01T00:30:00.000Z',
      'test_integrity_secreto',
    )).toHaveLength(64);
  });

  it('calcula la firma del webhook usando properties dinámicas y su orden', () => {
    const evento = {
      event: 'transaction.updated',
      data: { transaction: { id: 'abc-1', status: 'APPROVED', amount_in_cents: 990000 } },
      environment: 'test',
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
      timestamp: 1530291411,
    };
    const checksum = checksumEsperadoWompi(evento, 'test_events_secreto');
    expect(checksum).toMatch(/^[a-f\d]{64}$/);
    expect(coincideChecksum(checksum!, checksum!.toUpperCase())).toBe(true);
  });

  it('rechaza propiedades inseguras o valores que no se pueden firmar', () => {
    expect(checksumEsperadoWompi({
      data: { transaction: { id: 'abc' } },
      signature: { properties: ['transaction.__proto__.polluted'] },
      timestamp: 1,
    }, 'secreto')).toBeNull();
  });
});
