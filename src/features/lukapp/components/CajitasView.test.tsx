import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';
import { CajitasView } from './CajitasView';

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'c1',
  nombre: 'Nequi',
  icon: 'PiggyBank',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'c1',
  kind: 'deposito',
  deltaCop: 500_000,
  categoria: null,
  occurredOn: '2026-08-01',
  nota: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const AMBOS: Cajita[] = [
  caj({ id: 'banco', nombre: 'Bancolombia', tipo: 'cuenta' }),
  caj({ id: 'pote', nombre: 'Vacaciones', tipo: 'cajita' }),
];

const montar = (
  tipo: CajitaTipo,
  cajitas: Cajita[] = AMBOS,
  movimientos: CajitaMovimiento[] = [],
) => {
  const onCrear = vi.fn();
  const onMovimiento = vi.fn();
  render(
    <CajitasView
      tipo={tipo}
      cajitas={cajitas}
      movimientos={movimientos}
      transacciones={[]}
      onCrear={onCrear}
      onFijarSaldo={vi.fn()}
      onMovimiento={onMovimiento}
      onEliminar={vi.fn()}
    />,
  );
  return { onCrear, onMovimiento };
};

describe('CajitasView — cuentas y cajitas son módulos separados', () => {
  it('muestra el color reconocido mientras se escribe y propone el tipo de cuenta', () => {
    montar('cuenta', []);
    fireEvent.click(screen.getByRole('button', { name: /Agregar.*cuenta/i }));
    const nombre = screen.getByLabelText('Nombre');
    fireEvent.change(nombre, { target: { value: 'Neqii personal' } });
    expect(screen.getByText('Nequi · Color reconocido automáticamente')).toHaveStyle({ backgroundColor: '#200020' });
    expect(screen.getByLabelText('Tipo de cuenta')).toHaveValue('billetera');
    expect(nombre).toHaveValue('Neqii personal');
    fireEvent.change(nombre, { target: { value: 'Vacaciones' } });
    expect(screen.queryByText(/Color reconocido automáticamente/)).not.toBeInTheDocument();
  });

  it('la pantalla de cuentas no muestra cajitas', () => {
    montar('cuenta');

    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
    expect(screen.queryByText('Vacaciones')).not.toBeInTheDocument();
  });

  it('la pantalla de cajitas no muestra cuentas', () => {
    montar('cajita');

    expect(screen.getByText('Vacaciones')).toBeInTheDocument();
    expect(screen.queryByText('Bancolombia')).not.toBeInTheDocument();
  });

  it('el total de cada pantalla cuenta solo lo suyo', () => {
    montar('cuenta', AMBOS, [
      mov({ id: 'a', cajitaId: 'banco', deltaCop: 600_000 }),
      mov({ id: 'b', cajitaId: 'pote', deltaCop: 400_000 }),
    ]);

    // 600.000 de la cuenta; los 400.000 de la cajita no se suman aquí. La cifra
    // se repite (total y tarjeta), así que lo que se afirma es la ausencia de
    // la suma combinada, que es la regresión que importa.
    expect(screen.getAllByText('$600.000').length).toBeGreaterThan(0);
    expect(screen.queryByText('$1.000.000')).not.toBeInTheDocument();
    expect(screen.queryByText('$400.000')).not.toBeInTheDocument();
  });

  it.each([['', null], ['0', 0], ['15.000', 15000]])('al crear una cuenta distingue el saldo %s del saldo desconocido', async (texto, esperado) => {
    const { onCrear } = montar('cuenta', []);
    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi banco' } });
    fireEvent.change(screen.getByLabelText('¿Cuánto tienes en esta cuenta?'), { target: { value: texto } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(onCrear).toHaveBeenCalledWith(expect.objectContaining({ saldoInicialCop: esperado })));
  });

  it('ya no pregunta "¿Qué es?" — la pantalla en la que estás lo responde', () => {
    montar('cuenta', []);

    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/ }));

    expect(screen.queryByText('¿Qué es?')).not.toBeInTheDocument();
  });

  it('crea con el tipo de su pantalla, sin que el usuario lo elija', () => {
    const { onCrear } = montar('cuenta', []);

    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Davivienda' } });
    fireEvent.change(screen.getByLabelText('¿Cuánto tienes en esta cuenta?'), {
      target: { value: '250000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onCrear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Davivienda', tipo: 'cuenta', claseCuenta: 'banco', saldoInicialCop: 250000 }),
    );
  });

  it('permite crear efectivo sin disfrazarlo de cuenta bancaria', () => {
    const { onCrear } = montar('cuenta', []);

    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Caja menor' } });
    fireEvent.change(screen.getByLabelText('Tipo de cuenta'), { target: { value: 'efectivo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onCrear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Caja menor', tipo: 'cuenta', claseCuenta: 'efectivo',
    }));
  });

  it('no ofrece meta ni rendimiento en una cuenta bancaria', () => {
    montar('cuenta', []);
    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/ }));

    // Una cuenta corriente no tiene meta de ahorro ni una tasa que el usuario
    // deba escribir; ofrecerlas solo alarga el formulario.
    expect(screen.queryByText(/Meta a la que quieres llegar/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rendimiento (opcional)')).not.toBeInTheDocument();
  });

  it('sí las ofrece en una cajita, donde sí significan algo', () => {
    montar('cajita', []);
    fireEvent.click(screen.getByRole('button', { name: /Crear ahorro/ }));

    expect(screen.getByText('✨ Personalizar ahorro').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('✨ Personalizar ahorro'));
    expect(screen.getByLabelText(/Meta a la que quieres llegar/)).toBeInTheDocument();
    expect(screen.getByText('Rendimiento (opcional)')).toBeInTheDocument();
  });

  it('clasifica una inversión aparte y permite definir su moneda con emojis de identidad', async () => {
    const { onCrear } = montar('cajita', []);
    fireEvent.click(screen.getByRole('button', { name: /Crear ahorro/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'ETF global' } });
    fireEvent.click(screen.getByRole('button', { name: /Inversión/ }));
    await waitFor(() => expect(screen.getByLabelText(/Moneda/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Moneda/), { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear ahorro/ }));

    await waitFor(() => expect(onCrear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'ETF global', esInversion: true, moneda: 'USD', tipo: 'cajita',
    })));
  });

  it('convierte un aporte a COP y conserva el valor, moneda, tasa y fecha originales', async () => {
    const inversor = caj({ id: 'etf', nombre: 'ETF global', tipo: 'cajita', esInversion: true, moneda: 'USD' });
    const { onMovimiento } = montar('cajita', [inversor]);
    fireEvent.click(screen.getByRole('button', { name: 'Depositar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Depositar' }), { target: { value: '10.5' } });
    fireEvent.change(screen.getByLabelText('Tasa de hoy · COP por USD'), { target: { value: '4000' } });
    fireEvent.change(screen.getByLabelText('Fecha del movimiento'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onMovimiento).toHaveBeenCalledWith('etf', 'deposito', 42000, {
      montoOriginal: 10.5, monedaOriginal: 'USD', tasaCambioCop: 4000, occurredOn: '2026-10-20',
    }));
  });

  it('cada pantalla tiene su propio vacío, no uno compartido', () => {
    const { unmount } = render(
      <CajitasView
        tipo="cuenta"
        cajitas={[]}
        movimientos={[]}
        transacciones={[]}
        onCrear={vi.fn()}
        onFijarSaldo={vi.fn()}
        onMovimiento={vi.fn()}
        onEliminar={vi.fn()}
      />,
    );
    expect(screen.getByText('Aún no tienes cuentas.')).toBeInTheDocument();
    unmount();

    montar('cajita', []);
    expect(screen.getByText('Aún no tienes cajitas.')).toBeInTheDocument();
  });

  it('permite crear un ahorro desde la acción principal con solo nombre y monto', async () => {
    const { onCrear } = montar('cajita', []);
    fireEvent.click(screen.getByRole('button', { name: /Crear ahorro/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Viaje a la costa' } });
    fireEvent.change(screen.getByLabelText('¿Con cuánto empiezas? (opcional)'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear ahorro/ }));

    await waitFor(() => expect(onCrear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Viaje a la costa', tipo: 'cajita', saldoInicialCop: 50000, esInversion: false,
    })));
  });
});

describe('CajitasView — una cuenta no se comporta como una cajita', () => {
  const conSaldo = [mov({ cajitaId: 'banco', deltaCop: 500_000 })];

  it('una cuenta ofrece solo actualizar el saldo', () => {
    montar('cuenta', AMBOS, conSaldo);

    expect(screen.getByRole('button', { name: 'Actualizar saldo' })).toBeInTheDocument();
    // Lo que entra y sale de un banco ya son ingresos y gastos en Movimientos;
    // repetirlo aquí sería un segundo historial del mismo dinero.
    expect(screen.queryByRole('button', { name: 'Depositar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rendimiento' })).not.toBeInTheDocument();
  });

  it('una cajita sí ofrece las cuatro', () => {
    montar('cajita', AMBOS, [mov({ cajitaId: 'pote', deltaCop: 500_000 })]);

    for (const accion of ['Actualizar saldo', 'Depositar', 'Retirar', 'Rendimiento']) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
    }
  });

  it('una cuenta no se llama "cajita" en ningún texto', () => {
    montar('cuenta', AMBOS, conSaldo);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar saldo' }));

    expect(screen.getByText('¿Cuánto tienes ahora en esta cuenta?')).toBeInTheDocument();
    expect(screen.queryByText(/en esta cajita/)).not.toBeInTheDocument();
  });

  it('borrar una cuenta avisa que los movimientos no se tocan', () => {
    montar('cuenta', AMBOS, conSaldo);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar cuenta: Bancolombia/ }));

    expect(screen.getByText(/Tus movimientos registrados no se tocan/)).toBeInTheDocument();
  });

  it('una cuenta no muestra rendimiento estimado, aunque tenga tasa', () => {
    montar(
      'cuenta',
      [caj({ id: 'banco', nombre: 'Bancolombia', tipo: 'cuenta', tasaEaPct: 13 })],
      conSaldo,
    );

    expect(screen.queryByText('Rendimiento estimado')).not.toBeInTheDocument();
  });
});

describe('CajitasView — contar las cajitas en el resumen', () => {
  const conInterruptor = (tipo: CajitaTipo, mostrarEnResumen = true) => {
    const onMostrarEnResumen = vi.fn();
    render(
      <CajitasView
        tipo={tipo}
        cajitas={AMBOS}
        movimientos={[]}
        transacciones={[]}
        onCrear={vi.fn()}
        onFijarSaldo={vi.fn()}
        onMovimiento={vi.fn()}
        onEliminar={vi.fn()}
        mostrarEnResumen={mostrarEnResumen}
        onMostrarEnResumen={onMostrarEnResumen}
      />,
    );
    return { onMostrarEnResumen };
  };

  const interruptor = () => screen.getByLabelText('Contar las cajitas en el resumen');

  it('vive en Ahorro', () => {
    conInterruptor('cajita');

    expect(interruptor()).toBeInTheDocument();
  });

  it('no aparece en Cuentas: el resumen es justamente para eso', () => {
    conInterruptor('cuenta');

    expect(screen.queryByLabelText('Contar las cajitas en el resumen')).toBeNull();
  });

  it('tampoco en deudas ni tarjetas, que comparten este componente', () => {
    // El guardia decía "no es cuenta", que incluye deuda y tarjeta: habría
    // colgado un interruptor sobre ahorros debajo de lo que debes.
    conInterruptor('deuda');
    expect(screen.queryByLabelText('Contar las cajitas en el resumen')).toBeNull();

    cleanup();
    conInterruptor('tarjeta');
    expect(screen.queryByLabelText('Contar las cajitas en el resumen')).toBeNull();
  });

  it('refleja el estado que recibe', () => {
    conInterruptor('cajita', false);

    expect(interruptor()).not.toBeChecked();
  });

  it('avisa hacia arriba con el valor nuevo, no con el viejo', () => {
    // Invertir esto es el error fácil, y ningún otro test lo notaría.
    const { onMostrarEnResumen } = conInterruptor('cajita', true);

    fireEvent.click(interruptor());

    expect(onMostrarEnResumen).toHaveBeenCalledWith(false);
  });

  it('vuelve a encenderlo cuando estaba apagado', () => {
    const { onMostrarEnResumen } = conInterruptor('cajita', false);

    fireEvent.click(interruptor());

    expect(onMostrarEnResumen).toHaveBeenCalledWith(true);
  });

  it('la nota explica qué está pasando en cada estado', () => {
    conInterruptor('cajita', false);
    expect(screen.getByText(/solo lo que hay en cuentas/i)).toBeInTheDocument();

    cleanup();
    conInterruptor('cajita', true);
    expect(screen.getByText(/se suman a lo que tienes ahora/i)).toBeInTheDocument();
  });

  it('la nota describe al control sin robarle el nombre', () => {
    // Metida dentro del label, el nombre accesible pasaba a ser el párrafo
    // entero y CAMBIABA de texto en cada toque.
    conInterruptor('cajita', true);

    expect(interruptor().getAttribute('aria-describedby')).toBe('ahorro-en-resumen-nota');
  });

  it('sin manejador no se dibuja, en vez de fingir que hace algo', () => {
    render(
      <CajitasView
        tipo="cajita"
        cajitas={AMBOS}
        movimientos={[]}
        transacciones={[]}
        onCrear={vi.fn()}
        onFijarSaldo={vi.fn()}
        onMovimiento={vi.fn()}
        onEliminar={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Contar las cajitas en el resumen')).toBeNull();
  });
  it('conserva el nombre y el formulario cuando crear la cuenta falla', async () => {
    const onCrear = vi.fn().mockResolvedValue(false);
    render(<CajitasView tipo="cuenta" cajitas={[]} movimientos={[]} transacciones={[]} onCrear={onCrear} onFijarSaldo={vi.fn()} onMovimiento={vi.fn()} onEliminar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta/i }));
    const nombre = screen.getByPlaceholderText(/Nequi|Bancolombia/i);
    fireEvent.change(nombre, { target: { value: 'Cuenta que debo conservar' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta|Guardar/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(nombre).toHaveValue('Cuenta que debo conservar');
    expect(onCrear).toHaveBeenCalledTimes(1);
  });

});
