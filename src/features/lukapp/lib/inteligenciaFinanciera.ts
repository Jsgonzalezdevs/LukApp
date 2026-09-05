import type { Transaction } from '../types';

export interface AnomaliaFinanciera {
  categoria: string;
  monto: number;
  promedio: number;
  porcentajeSobrePromedio: number;
}

export const detectarAnomalias = (movimientos: readonly Transaction[]): AnomaliaFinanciera[] => {
  const porCategoria = new Map<string, number[]>();
  for (const movimiento of movimientos) {
    if (movimiento.kind !== 'gasto') continue;
    const montos = porCategoria.get(movimiento.category) ?? [];
    montos.push(movimiento.amountCop);
    porCategoria.set(movimiento.category, montos);
  }
  return Array.from(porCategoria, ([categoria, montos]) => {
    if (montos.length < 2) return null;
    const monto = Math.max(...montos);
    const historico = montos.filter((valor) => valor !== monto);
    const promedio = historico.reduce((suma, valor) => suma + valor, 0) / historico.length;
    return { categoria, monto, promedio, porcentajeSobrePromedio: promedio ? (monto / promedio - 1) * 100 : 0 };
  }).filter((anomalia): anomalia is AnomaliaFinanciera => anomalia !== null && anomalia.porcentajeSobrePromedio >= 75);
};
