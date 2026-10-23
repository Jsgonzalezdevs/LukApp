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
  const onAnotar = vi.fn();
  render(<InicioView etiquetaPeriodo="octubre de 2026" onCambiarMes={vi.fn()} onBuscar={vi.fn()} onAjustes={vi.fn()} patrimonioCop={0} gastosCop={0} ingresosCop={0} onVerMes={vi.fn()} movimientos={[]} onAbrirMovimiento={vi.fn()} liquidez={construirContextoFinanciero(datos).liquidez} entrada={datos} onAnotar={onAnotar} />);
  return { onAnotar };
};

describe('Inicio — saldo e historial', () => {
  it('mantiene el saldo desconocido como guion y explica cómo mostrar el saldo', () => {
    montar();
    expect(screen.getByText('Dinero disponible')).toBeInTheDocument();
    expect(screen.getByLabelText('Saldo todavía sin confirmar')).toBeInTheDocument();
    expect(screen.getByText('Confirma tus saldos para calcular cuánto tienes disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completar saldos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pon tu dinero al día')).not.toBeInTheDocument();
    expect(screen.queryByText('Comida')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Decisiones financieras' })).not.toBeInTheDocument();
  });

  it('acepta cero confirmado sin mostrar una tarjeta de pasos en Inicio', () => {
    montar(true);
    expect(screen.getByText('Dinero disponible')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Primeros pasos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ver saldos y resultado del período')).not.toBeInTheDocument();
    expect(screen.getByTitle('Ver desglose del periodo')).toBeInTheDocument();
  });
  it('oculta próximos pagos cuando la preferencia está desactivada', () => {
    const datos = entrada(true);
    render(<InicioView etiquetaPeriodo="octubre de 2026" onCambiarMes={vi.fn()} onBuscar={vi.fn()} onAjustes={vi.fn()} patrimonioCop={0} gastosCop={0} ingresosCop={0} onVerMes={vi.fn()} movimientos={[]} onAbrirMovimiento={vi.fn()} liquidez={construirContextoFinanciero(datos).liquidez} entrada={datos} mostrarProximosPagos={false} />);
    expect(screen.queryByRole('region', { name: 'Próximos pagos' })).not.toBeInTheDocument();
  });
  it('muestra el historial completo sin cambiar el resumen del período', () => {
    const datos = entrada(true);
    const movimientos: Transaction[] = [2, 6, 1, 4, 3, 5].map((n) => ({ id: `tx-${n}`, description: `Registro ${n}`, kind: 'ingreso', category: 'ingreso', amountCop: n * 100, occurredOn: `2026-10-0${n}`, cuentaId: 'efectivo', rawTranscript: '', createdAt: `2026-10-0${n}T12:00:00Z` }));
    const completos = { ...datos, transacciones: movimientos };
    const buscar = vi.fn();
    render(<InicioView etiquetaPeriodo="octubre de 2026" onCambiarMes={vi.fn()} onBuscar={buscar} onAjustes={vi.fn()} patrimonioCop={0} gastosCop={0} ingresosCop={0} onVerMes={vi.fn()} movimientos={movimientos} onAbrirMovimiento={vi.fn()} liquidez={construirContextoFinanciero(completos).liquidez} entrada={completos} />);
    const recientes = screen.getByRole('region', { name: 'Historial de movimientos' });
    expect(within(recientes).getAllByText(/Registro [1-6]/).map((e) => e.textContent)).toEqual(['Registro 6', 'Registro 5', 'Registro 4', 'Registro 3', 'Registro 2', 'Registro 1']);
    expect(screen.getByText('Análisis y categorías del período').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el historial' }));
    expect(buscar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region', { name: 'Primeros pasos' })).not.toBeInTheDocument();
  });

});
