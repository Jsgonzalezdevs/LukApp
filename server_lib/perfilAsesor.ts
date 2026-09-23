import { createHash } from 'node:crypto';

export type FilaFinanciera = Record<string, unknown>;

export interface DatosPerfilFinanciero {
  transacciones: readonly FilaFinanciera[];
  cajitas: readonly FilaFinanciera[];
  movimientosCajitas: readonly FilaFinanciera[];
  metas: readonly FilaFinanciera[];
  categorias: readonly FilaFinanciera[];
  presupuestos: readonly FilaFinanciera[];
  recurrentes: readonly FilaFinanciera[];
}

const MAX_TRANSACCIONES_DETALLADAS = 180;
const MAX_MOVIMIENTOS_CUENTA_DETALLADOS = 120;

const texto = (valor: unknown, maximo = 180): string =>
  typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, maximo) : '';

const numero = (valor: unknown): number => {
  const resultado = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(resultado) ? Math.round(resultado) : 0;
};

const fecha = (valor: unknown): string =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : '';

const ordenarPorFechaDesc = (a: { fecha: string }, b: { fecha: string }): number =>
  b.fecha.localeCompare(a.fecha);

const sumaPorClave = (filas: readonly { clave: string; montoCop: number }[]): readonly { clave: string; montoCop: number }[] => {
  const acumulado = new Map<string, number>();
  for (const fila of filas) {
    if (!fila.clave) continue;
    acumulado.set(fila.clave, (acumulado.get(fila.clave) ?? 0) + fila.montoCop);
  }
  return [...acumulado.entries()]
    .map(([clave, montoCop]) => ({ clave, montoCop }))
    .sort((a, b) => Math.abs(b.montoCop) - Math.abs(a.montoCop) || a.clave.localeCompare(b.clave));
};

/**
 * Construye un expediente rico desde TODO el historial financiero disponible
 * de una persona. La IA recibe el detalle reciente y los agregados de todo el
 * histórico: así conserva señales de años sin mandar transcripciones crudas,
 * ids internos, credenciales ni datos ajenos.
 */
export const construirPerfilFinancieroCompleto = (datos: DatosPerfilFinanciero): Record<string, unknown> => {
  const nombresCategorias = new Map(
    datos.categorias.map((fila) => [texto(fila.id, 80), texto(fila.nombre, 100)] as const),
  );
  const cuentas = datos.cajitas
    .map((fila) => ({
      id: texto(fila.id, 80),
      nombre: texto(fila.nombre, 100),
      tipo: texto(fila.tipo, 30),
      claseCuenta: texto(fila.clase_cuenta, 30) || null,
      metaCop: fila.meta_cop === null ? null : numero(fila.meta_cop),
      tasaEaPct: fila.tasa_ea_pct === null ? null : Number(fila.tasa_ea_pct),
      limiteCreditoCop: fila.limite_credito_cop === null ? null : numero(fila.limite_credito_cop),
      diaCorte: fila.dia_corte === null ? null : numero(fila.dia_corte),
      diaPago: fila.dia_pago === null ? null : numero(fila.dia_pago),
      pagoMinimoCop: fila.pago_minimo_cop === null ? null : numero(fila.pago_minimo_cop),
      archivada: Boolean(fila.archived_at),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const nombreCuenta = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta.nombre] as const));

  const transacciones = datos.transacciones
    .map((fila) => {
      const categoria = texto(fila.category, 80);
      return {
        fecha: fecha(fila.occurred_on),
        tipo: texto(fila.kind, 30),
        montoCop: numero(fila.amount_cop),
        categoria: nombresCategorias.get(categoria) || categoria,
        descripcion: texto(fila.description),
        cuenta: nombreCuenta.get(texto(fila.cuenta_id, 80)) || null,
        cuotasTotal: fila.cuotas_total === null ? null : numero(fila.cuotas_total),
        cuotaCop: fila.cuota_cop === null ? null : numero(fila.cuota_cop),
      };
    })
    .filter((fila) => fila.fecha && fila.tipo && fila.montoCop > 0)
    .sort(ordenarPorFechaDesc);

  const movimientosCajitas = datos.movimientosCajitas
    .map((fila) => ({
      fecha: fecha(fila.occurred_on),
      cuenta: nombreCuenta.get(texto(fila.cajita_id, 80)) || 'Cuenta eliminada',
      tipo: texto(fila.kind, 30),
      deltaCop: numero(fila.delta_cop),
      categoria: nombresCategorias.get(texto(fila.categoria, 80)) || texto(fila.categoria, 80) || null,
      nota: texto(fila.nota),
    }))
    .filter((fila) => fila.fecha && fila.tipo)
    .sort(ordenarPorFechaDesc);

  const meses = new Map<string, { ingresosCop: number; gastosCop: number; transferenciasCop: number; movimientos: number }>();
  for (const tx of transacciones) {
    const mes = tx.fecha.slice(0, 7);
    const actual = meses.get(mes) ?? { ingresosCop: 0, gastosCop: 0, transferenciasCop: 0, movimientos: 0 };
    if (tx.tipo === 'ingreso') actual.ingresosCop += tx.montoCop;
    else if (tx.tipo === 'gasto') actual.gastosCop += tx.montoCop;
    else actual.transferenciasCop += tx.montoCop;
    actual.movimientos += 1;
    meses.set(mes, actual);
  }

  const gastosPorCategoria = sumaPorClave(
    transacciones
      .filter((tx) => tx.tipo === 'gasto')
      .map((tx) => ({ clave: tx.categoria || 'Sin categoría', montoCop: tx.montoCop })),
  );

  const gastosPorCuenta = sumaPorClave(
    transacciones
      .filter((tx) => tx.tipo === 'gasto')
      .map((tx) => ({ clave: tx.cuenta || 'Sin cuenta', montoCop: tx.montoCop })),
  );

  const ingresosCop = transacciones
    .filter((tx) => tx.tipo === 'ingreso')
    .reduce((total, tx) => total + tx.montoCop, 0);
  const gastosCop = transacciones
    .filter((tx) => tx.tipo === 'gasto')
    .reduce((total, tx) => total + tx.montoCop, 0);

  const metas = datos.metas
    .map((fila) => ({
      nombre: texto(fila.nombre, 100),
      objetivoCop: numero(fila.objetivo_cop),
      ahorradoCop: numero(fila.ahorrado_cop),
      fechaObjetivo: fecha(fila.fecha_objetivo) || null,
      completada: Boolean(fila.completed_at),
      cuenta: nombreCuenta.get(texto(fila.cajita_id, 80)) || null,
    }))
    .filter((meta) => meta.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const presupuestos = datos.presupuestos
    .map((fila) => {
      const categoria = texto(fila.categoria, 80);
      return { categoria: nombresCategorias.get(categoria) || categoria, montoCop: numero(fila.monto_cop) };
    })
    .filter((fila) => fila.categoria && fila.montoCop > 0)
    .sort((a, b) => a.categoria.localeCompare(b.categoria));

  const recurrentes = datos.recurrentes
    .map((fila) => ({
      nombre: texto(fila.nombre, 100),
      tipo: texto(fila.kind, 30),
      montoCop: numero(fila.amount_cop),
      categoria: nombresCategorias.get(texto(fila.categoria, 80)) || texto(fila.categoria, 80),
      cuenta: nombreCuenta.get(texto(fila.cuenta_id, 80)) || null,
      diaDelMes: numero(fila.dia_del_mes),
      archivado: Boolean(fila.archived_at),
    }))
    .filter((fila) => fila.nombre && !fila.archivado)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    cobertura: {
      transacciones: transacciones.length,
      movimientosDeCuentas: movimientosCajitas.length,
      cuentas: cuentas.length,
      metas: metas.length,
      presupuestos: presupuestos.length,
      recurrentes: recurrentes.length,
      primeraTransaccion: transacciones.at(-1)?.fecha || null,
      ultimaTransaccion: transacciones[0]?.fecha || null,
    },
    panoramaHistorico: { ingresosCop, gastosCop, balanceCop: ingresosCop - gastosCop },
    cuentas,
    metas,
    presupuestos,
    recurrentes,
    historialCompleto: {
      porMes: [...meses.entries()]
        .map(([mes, totales]) => ({ mes, ...totales, balanceCop: totales.ingresosCop - totales.gastosCop }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
      gastosPorCategoria,
      gastosPorCuenta,
    },
    actividadDetalladaReciente: transacciones.slice(0, MAX_TRANSACCIONES_DETALLADAS),
    movimientosDeCuentasRecientes: movimientosCajitas.slice(0, MAX_MOVIMIENTOS_CUENTA_DETALLADOS),
  };
};

export const huellaPerfilFinanciero = (perfil: Record<string, unknown>): string =>
  createHash('sha256').update(JSON.stringify(perfil)).digest('hex');
