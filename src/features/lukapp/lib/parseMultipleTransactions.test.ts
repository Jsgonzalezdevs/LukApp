import { describe, expect, it } from 'vitest';
import { parseMultipleTransactions } from './parseMultipleTransactions';

describe('parseMultipleTransactions', () => {
  it('separa 2 gastos unidos por "y"', () => {
    const res = parseMultipleTransactions('15 mil de taxi y 30 mil de almuerzo');
    expect(res).toHaveLength(2);
    expect(res[0].amount).toBe(15000);
    expect(res[0].category).toBe('transporte');
    expect(res[1].amount).toBe(30000);
    expect(res[1].category).toBe('comida');
  });

  it('separa 3 gastos con comas y conectores', () => {
    const res = parseMultipleTransactions('Gasté 50 mil en mercado, 20 mil en farmacia y 10 mil de recarga');
    expect(res.length).toBeGreaterThanOrEqual(2);
    expect(res[0].amount).toBe(50000);
  });

  it('mantiene una sola transaccion si no hay conectores multiples', () => {
    const res = parseMultipleTransactions('Almuerzo 18 mil en El Corral');
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(18000);
    expect(res[0].category).toBe('comida');
  });

  it('separa por saltos de linea', () => {
    const res = parseMultipleTransactions('20 mil de gasolina\n50 mil de mercado\n100 mil de arriendo');
    expect(res).toHaveLength(3);
    expect(res[0].amount).toBe(20000);
    expect(res[1].amount).toBe(50000);
    expect(res[2].amount).toBe(100000);
  });

  it('no confunde nombres de comidas con conectores falsos', () => {
    const res = parseMultipleTransactions('15 mil de arroz con pollo y papa');
    // Solo hay 1 monto (15 mil)
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(15000);
  });

  it('no divide frases subordinadas de precio con "un café ... que me valió 10000"', () => {
    const res = parseMultipleTransactions('Me compré un café en el Oxxo que me valió 10000');
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(10000);
    expect(res[0].kind).toBe('gasto');
  });

  it('no divide frases con comas antes de "me valió"', () => {
    const res = parseMultipleTransactions('Me compré un café en el Oxxo, me valió 10000');
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(10000);
  });

  it('conserva una compra con cantidad y una cláusula de precio como un solo gasto', () => {
    const res = parseMultipleTransactions('Me gasté 3 cafés con leche que me costó 7500');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      kind: 'gasto',
      amount: 7500,
      category: 'comida',
      description: '3 cafés con leche',
    });
  });

  it('no separa productos ni confunde sus cantidades cuando dicen un único total', () => {
    for (const texto of [
      'Me gasté tres cafés con leche y dos panes que me costaron siete mil quinientos',
      'Compré 2 pizzas y una gaseosa por 45 mil',
    ]) {
      const res = parseMultipleTransactions(texto);
      expect(res).toHaveLength(1);
    }

    expect(parseMultipleTransactions('Compré 2 pizzas y una gaseosa por 45 mil')[0]).toMatchObject({
      kind: 'gasto', amount: 45_000, category: 'comida',
    });
  });

  it('sí conserva separados los montos que expresan dos movimientos distintos', () => {
    const res = parseMultipleTransactions('Pagué 20 mil de taxi y 30 mil de almuerzo');
    expect(res).toHaveLength(2);
    expect(res.map((movimiento) => movimiento.amount)).toEqual([20_000, 30_000]);
  });
});
