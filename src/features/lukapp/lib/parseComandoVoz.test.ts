import { describe, expect, it } from 'vitest';
import type { Cajita } from '../data/modelos';
import { parseComandoVoz } from './parseComandoVoz';

const entidad = (id: string, nombre: string, tipo: Cajita['tipo']): Cajita => ({
  id,
  nombre,
  tipo,
  icon: 'Wallet',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  archivedAt: null,
});

const ENTIDADES = [
  entidad('nequi', 'Nequi', 'cuenta'),
  entidad('banco', 'Bancolombia', 'cuenta'),
  entidad('viaje', 'Viaje', 'cajita'),
  entidad('nu', 'Tarjeta Nu', 'tarjeta'),
  entidad('moto', 'Crédito de la moto', 'deuda'),
];

describe('parseComandoVoz', () => {
  it('entiende un abono completo a tarjeta y conserva la cuenta de origen', () => {
    expect(parseComandoVoz('Abona 200 mil a la tarjeta Nu desde Bancolombia', ENTIDADES)).toEqual({
      tipo: 'abono',
      deudaId: 'nu',
      cuentaId: 'banco',
      montoCop: 200_000,
      raw: 'Abona 200 mil a la tarjeta Nu desde Bancolombia',
    });
  });

  it('conserva la fecha relativa de abonos y transferencias', () => {
    const abono = parseComandoVoz('Ayer aboné 20 mil a la Nu desde Nequi', ENTIDADES);
    expect(abono).toMatchObject({ tipo: 'abono', occurredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('reconoce el nombre corto de una tarjeta o deuda', () => {
    expect(parseComandoVoz('Aboné 100 mil a la Nu desde Nequi', ENTIDADES)).toMatchObject({
      tipo: 'abono', deudaId: 'nu', cuentaId: 'nequi', montoCop: 100_000,
    });
    expect(parseComandoVoz('Paga 50 mil al crédito de la moto desde Bancolombia', ENTIDADES)).toMatchObject({
      tipo: 'abono', deudaId: 'moto', cuentaId: 'banco', montoCop: 50_000,
    });
  });

  it('deja visibles los campos que no se dijeron en un abono', () => {
    expect(parseComandoVoz('Paga 80 mil a la tarjeta', ENTIDADES)).toMatchObject({
      tipo: 'abono', deudaId: null, cuentaId: null, montoCop: 80_000,
    });
  });

  it('no confunde una compra con tarjeta con un abono', () => {
    expect(parseComandoVoz('Pagué 80 mil de mercado con la tarjeta Nu', ENTIDADES)).toBeNull();
  });

  it('actualiza el saldo de cuentas, cajitas, tarjetas o deudas', () => {
    expect(parseComandoVoz('Actualiza el saldo de Nequi a 450 mil', ENTIDADES)).toMatchObject({
      tipo: 'saldo', cajitaId: 'nequi', saldoCop: 450_000,
    });
    expect(parseComandoVoz('La deuda actual de la tarjeta Nu es cero', ENTIDADES)).toMatchObject({
      tipo: 'saldo', cajitaId: 'nu', saldoCop: 0,
    });
    expect(parseComandoVoz('En Nequi tengo cuatrocientos mil', ENTIDADES)).toMatchObject({
      tipo: 'saldo', cajitaId: 'nequi', saldoCop: 400_000,
    });
    const cuentaNumerada = entidad('cuenta-2', 'Cuenta 2', 'cuenta');
    expect(parseComandoVoz('Actualiza el saldo de Cuenta 2 a 100 mil', [...ENTIDADES, cuentaNumerada])).toMatchObject({
      tipo: 'saldo', cajitaId: 'cuenta-2', saldoCop: 100_000,
    });
  });

  it('mueve dinero entre una cuenta y una cajita', () => {
    expect(parseComandoVoz('Pasa 150 mil de Nequi a Viaje', ENTIDADES)).toMatchObject({
      tipo: 'transferencia', origenId: 'nequi', destinoId: 'viaje', montoCop: 150_000,
    });
  });

  it('conserva una transferencia interna incompleta para preguntarla', () => {
    expect(parseComandoVoz('Aparta 50 mil en Viaje', ENTIDADES)).toMatchObject({
      tipo: 'transferencia', origenId: null, destinoId: 'viaje', montoCop: 50_000,
    });
    expect(parseComandoVoz('Saca 20 mil de Viaje', ENTIDADES)).toMatchObject({
      tipo: 'transferencia', origenId: 'viaje', destinoId: null, montoCop: 20_000,
    });
  });

  it('no secuestra una transferencia externa ordinaria', () => {
    expect(parseComandoVoz('Transferí 50 mil de Nequi a Juan', ENTIDADES)).toBeNull();
  });

  it('registra rendimientos solo como orden explícita sobre una cajita', () => {
    expect(parseComandoVoz('Registra 2 mil de rendimiento en Viaje', ENTIDADES)).toMatchObject({
      tipo: 'rendimiento', cajitaId: 'viaje', montoCop: 2_000,
    });
  });

  it('ignora entidades archivadas', () => {
    const archivada = { ...entidad('vieja', 'Cuenta vieja', 'cuenta'), archivedAt: '2026-09-10' };
    expect(parseComandoVoz('Actualiza el saldo de Cuenta vieja a 10 mil', [...ENTIDADES, archivada])).toMatchObject({
      tipo: 'saldo', cajitaId: null, saldoCop: 10_000,
    });
  });
});
