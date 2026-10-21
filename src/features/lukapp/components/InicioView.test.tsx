import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Transaction } from '../types';
import { InicioView } from './InicioView';
import { instantaneaVacia } from '../data/repositorio';
import { construirContextoFinanciero } from '../lib/motorFinanciero';
import { PERIODO_POR_DEFECTO } from '../lib/periodo';

const entrada = (confirmado = false) => ({
  ...instantaneaVacia(), hoy: '2026-10-20', periodo: PERIODO_POR_DEFECTO,
  cajitas: [{ id: 'efectivo', nombre: 'Efectivo', tipo: 'cuenta' as const, icon: 'wallet', metaCop: null, tasaEaPct: null, createdAt: '2026-10-20', archivedAt: null }],
  cajitaMovimientos: confirmado ? [{ id: 'saldo', cajitaId: 'efectivo', kind: 'ajuste' as const, deltaCop: 0, categoria: null, occurredOn: '2026-10-20', createdAt: '2026-10-20', nota: 'Saldo actualizado' }] : [],
});

const montar = (confirmado = false) => {
  const datos = entrada(confirmado);
  const onCuenta = vi.fn();
  const onAnotar = vi.fn();
  render(<InicioView etiquetaPeriodo="octubre de 2026" onCambiarMes={vi.fn()} onBuscar={vi.fn()} onAjustes={vi.fn()} patrimonioCop={0} gastosCop={0} ingresosCop={0} onVerMes={vi.fn()} movimientos={[]} onAbrirMovimiento={vi.fn()} liquidez={construirContextoFinanciero(datos).liquidez} entrada={datos} onConfigurarCuenta={onCuenta} onAnotar={onAnotar} />);
  return { onCuenta, onAnotar };
};

describe('Inicio — primera configuración', () => {
  it('no presenta un saldo desconocido como cero ni recomienda cuánto gastar', () => {
    const { onCuenta, onAnotar } = montar();
    expect(screen.getByText('Saldo por completar')).toBeInTheDocument();
    expect(screen.queryByText('Comida')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Decisiones financieras' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar saldo de Efectivo' }));
    expect(onCuenta).toHaveBeenCalledWith('efectivo');
    fireEvent.click(screen.getByRole('button', { name: 'Anotar mi primer movimiento' }));
    expect(onAnotar).toHaveBeenCalledOnce();
  });

  it('acepta cero confirmado y mantiene pendiente únicamente el primer registro', () => {
    montar(true);
    expect(screen.getByText('Dinero disponible')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 pasos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar saldo de Efectivo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anotar mi primer movimiento' })).toBeInTheDocument();
  });
  it('prioriza cinco movimientos recientes y mantiene el análisis cerrado con acceso al historial', () => {
    const datos = entrada(true);
    const movimientos: Transaction[] = [2, 6, 1, 4, 3, 5].map((n) => ({ id: `tx-${n}`, description: `Registro ${n}`, kind: 'ingreso', category: 'ingreso', amountCop: n * 100, occurredOn: `2026-10-0${n}`, cuentaId: 'efectivo', rawTranscript: '', createdAt: `2026-10-0${n}T12:00:00Z` }));
    const completos = { ...datos, transacciones: movimientos };
    const buscar = vi.fn();
    render(<InicioView etiquetaPeriodo="octubre de 2026" onCambiarMes={vi.fn()} onBuscar={buscar} onAjustes={vi.fn()} patrimonioCop={0} gastosCop={0} ingresosCop={0} onVerMes={vi.fn()} movimientos={movimientos} onAbrirMovimiento={vi.fn()} liquidez={construirContextoFinanciero(completos).liquidez} entrada={completos} />);
    const recientes = screen.getByRole('region', { name: 'Movimientos recientes' });
    expect(within(recientes).queryByText('Registro 1')).not.toBeInTheDocument();
    expect(within(recientes).getAllByText(/Registro [2-6]/).map((e) => e.textContent)).toEqual(['Registro 6', 'Registro 5', 'Registro 4', 'Registro 3', 'Registro 2']);
    expect(screen.getByText('Análisis y categorías del período').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial completo' }));
    expect(buscar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region', { name: 'Primeros pasos' })).not.toBeInTheDocument();
  });

});
