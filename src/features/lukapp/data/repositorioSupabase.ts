import { nuevoId } from '../lib/id';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Transaction, TxKind } from '../types';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo, ClaseCuenta, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Presupuesto } from '../lib/presupuestos';
import type { Recurrente } from '../lib/recurrentes';
import type { CambiosFinancieros, Instantanea, Repositorio } from './repositorio';
import { ES_PASIVO } from './modelos';

/**
 * Reads the stored kind back, checked against the real set.
 *
 * This was `fila.tipo === 'cuenta' ? 'cuenta' : 'cajita'` — written when only
 * those two existed, and never revisited when debts and cards were added. The
 * row saved correctly as 'tarjeta' and came back as 'cajita', so a credit card
 * created under Deudas silently appeared under Ahorro instead. Widening a set
 * without revisiting the code that narrows it is exactly how that happens, so
 * this now derives from the set itself and cannot fall behind it again.
 */
const aTipo = (valor: string | null): CajitaTipo =>
  valor !== null && valor in ES_PASIVO ? (valor as CajitaTipo) : 'cajita';

/**
 * Postgres-backed storage, one account per user.
 *
 * `user_id` is stamped on every write here rather than left to a database
 * default, because RLS rejects a row whose user_id is not the caller's — the
 * policy's `with check` is what makes an omitted column a hard error instead of
 * a silently mis-owned row.
 */
export class RepositorioSupabase implements Repositorio {
  // Declared and assigned explicitly rather than as constructor parameter
  // properties: `erasableSyntaxOnly` is on in tsconfig.app.json, which rules out
  // any TypeScript syntax that emits runtime code — the same reason this project
  // has no enums.
  private readonly cliente: SupabaseClient;
  private readonly userId: string;

  constructor(cliente: SupabaseClient, userId: string) {
    this.cliente = cliente;
    this.userId = userId;
  }

  private fallar(contexto: string, error: { message: string } | null): void {
    if (!error) return;
    if (/failed to fetch|network|load failed/i.test(error.message)) throw new TypeError(error.message);

    // Constraint names are the schema's vocabulary, not the user's. Postgres
    // reports the rule that failed; this says what to do about it.
    if (error.message.includes('amount_cop_check')) {
      throw new Error('El monto debe ser mayor que cero.');
    }
    if (error.message.includes('objetivo_cop_check')) {
      throw new Error('El objetivo de la meta debe ser mayor que cero.');
    }
    if (error.message.includes('transacciones_kind_check')) {
      throw new Error(
        'La base de datos todavía no admite transferencias en el historial. Aplica la migración 20260830183300_permitir_transferencias_en_historial.sql y vuelve a intentar.',
      );
    }
    if (error.message.includes('_kind_check') || error.message.includes('_rol_check')) {
      throw new Error('Ese valor no es uno de los permitidos.');
    }
    if (error.message.includes('violates row-level security')) {
      throw new Error('Tu sesión no tiene permiso para este cambio. Vuelve a entrar.');
    }

    // Los fallos de token llegaban crudos y en inglés a un banner de una app
    // que solo habla español: «No se pudieron leer las categorías: JWT issued
    // at future». `crearFetchTolerante` ya reintenta el caso del reloj
    // desfasado y casi siempre lo absorbe sin que nadie lo vea; esto es lo que
    // se dice si el desfase es tan grande que ni esperando se arregla, y de
    // paso cubre al resto de la familia, que antes se escapaba igual.
    if (/issued at future|not yet valid/i.test(error.message)) {
      throw new Error(
        'La hora del servidor no coincide con la de tu sesión. Espera unos segundos e inténtalo de nuevo.',
      );
    }
    if (/jwt expired|token is expired/i.test(error.message)) {
      throw new Error('Tu sesión venció. Vuelve a entrar.');
    }
    if (/jwt|jws/i.test(error.message)) {
      throw new Error('Tu sesión ya no es válida. Vuelve a entrar.');
    }
    if (error.message.includes('duplicate key')) {
      throw new Error('Ese registro ya existe.');
    }

    if (/cuotas_total|cuota_cop/i.test(error.message)) {
      throw new Error(
        'Falta actualizar Supabase para guardar comprobantes a cuotas. Ejecuta la migración supabase/migrations/20260830190000_cuotas_tarjetas.sql y vuelve a intentar.',
      );
    }

    // PostgREST uses "schema cache" for both a completely new database and a
    // database that is missing a later table or column. Calling every one of
    // those cases "base vacía" sent people back to 0001 even when that
    // migration was already applied. The fix is the same operationally, but
    // the message must describe an incomplete/out-of-date schema.
    if (
      error.message.includes('schema cache') ||
      /relation .* does not exist|column .* does not exist/i.test(error.message)
    ) {
      throw new Error(
        'La base de datos de LukApp está incompleta o desactualizada. Ejecuta, en orden, las migraciones de la carpeta supabase/migrations/ en el SQL Editor de Supabase y vuelve a cargar la app.',
      );
    }

    throw new Error(`${contexto}: ${error.message}`);
  }

  private async leerTabla<Fila>(tabla: string, clave = 'id'): Promise<{ data: Fila[]; error: { message: string } | null }> {
    const filas: Fila[] = [];
    while (true) {
      const { data, error, count } = await this.cliente.from(tabla)
        .select('*', { count: 'exact' }).eq('user_id', this.userId)
        .order(clave).range(filas.length, filas.length + 499);
      if (error) return { data: [], error };
      const pagina = (data ?? []) as Fila[];
      filas.push(...pagina);
      if (count !== null && count !== undefined) {
        if (filas.length >= count) break;
        if (pagina.length === 0) throw new Error('El historial llegó incompleto. Vuelve a sincronizar antes de hacer cambios.');
      } else if (pagina.length < 500) break;
    }
    return { data: filas, error: null };
  }

  async cargarTodo(): Promise<Instantanea> {
    const [
      transacciones,
      cajitas,
      movimientos,
      metas,
      categorias,
      contactos,
      presupuestos,
      recurrentes,
    ] = await Promise.all([
      this.leerTabla<FilaTransaccion>('transacciones'),
      this.leerTabla<FilaCajita>('cajitas'),
      this.leerTabla<FilaMovimiento>('cajita_movimientos'),
      this.leerTabla<FilaMeta>('metas'),
      this.leerTabla<FilaCategoria>('categorias'),
      this.leerTabla<FilaContacto>('contactos'),
      this.leerTabla<Parameters<typeof aPresupuesto>[0]>('presupuestos', 'categoria'),
      this.leerTabla<Parameters<typeof aRecurrente>[0]>('recurrentes'),
    ]);

    this.fallar('No se pudieron leer los movimientos', transacciones.error);
    this.fallar('No se pudieron leer las cajitas', cajitas.error);
    this.fallar('No se pudo leer el historial de cajitas', movimientos.error);
    this.fallar('No se pudieron leer las metas', metas.error);
    this.fallar('No se pudieron leer las categorías', categorias.error);
    this.fallar('No se pudieron leer los contactos', contactos.error);
    this.fallar('No se pudieron leer los presupuestos', presupuestos.error);
    this.fallar('No se pudieron leer los recurrentes', recurrentes.error);

    return {
      transacciones: (transacciones.data ?? []).map(aTransaccion),
      cajitas: (cajitas.data ?? []).map(aCajita),
      cajitaMovimientos: (movimientos.data ?? []).map(aMovimiento),
      metas: (metas.data ?? []).map(aMeta),
      categorias: (categorias.data ?? []).map(aCategoria),
      contactos: (contactos.data ?? []).map(aContacto),
      presupuestos: (presupuestos.data ?? []).map(aPresupuesto),
      recurrentes: (recurrentes.data ?? []).map(aRecurrente),
    };
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    if (transacciones.length === 0) return;
    const { error } = await this.cliente
      .from('transacciones')
      .upsert(transacciones.map((t) => desdeTransaccion(t, this.userId)));
    this.fallar('No se pudo guardar el movimiento', error);
  }

  async borrarTransaccion(id: string): Promise<void> {
    const { error } = await this.cliente.from('transacciones').delete().eq('id', id);
    this.fallar('No se pudo eliminar el movimiento', error);
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    const { error } = await this.cliente.from('cajitas').upsert(desdeCajita(cajita, this.userId));
    this.fallar('No se pudo guardar la cajita', error);
  }

  async borrarCajita(id: string): Promise<void> {
    // No manual cascade: the schema declares `on delete cascade` for movements
    // and `on delete set null` for goals, so one statement leaves the database
    // in exactly the state the local implementation produces.
    const { error } = await this.cliente.from('cajitas').delete().eq('id', id);
    this.fallar('No se pudo eliminar la cajita', error);
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    if (movimientos.length === 0) return;
    const { error } = await this.cliente
      .from('cajita_movimientos')
      .upsert(movimientos.map((m) => desdeMovimiento(m, this.userId)));
    this.fallar('No se pudo guardar el movimiento de la cajita', error);
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    const { error } = await this.cliente.from('cajita_movimientos').delete().eq('id', id);
    this.fallar('No se pudo eliminar el movimiento de la cajita', error);
  }

  async aplicarCambios(cambios: CambiosFinancieros): Promise<void> {
    const guardar = cambios.reemplazar ?? cambios.guardar ?? {};
    const filas = {
      transacciones: guardar.transacciones?.map((fila) => desdeTransaccion(fila, this.userId)),
      cajitas: guardar.cajitas?.map((fila) => desdeCajita(fila, this.userId)),
      cajita_movimientos: guardar.cajitaMovimientos?.map((fila) => desdeMovimiento(fila, this.userId)),
      metas: guardar.metas?.map((fila) => desdeMeta(fila, this.userId)),
      categorias: guardar.categorias?.map((fila) => desdeCategoria(fila, this.userId)),
      contactos: guardar.contactos?.map((fila) => desdeContacto(fila, this.userId)),
      presupuestos: guardar.presupuestos?.map((p) => ({ user_id: this.userId, categoria: p.categoria, monto_cop: p.montoCop, created_at: p.createdAt })),
      recurrentes: guardar.recurrentes?.map((r) => ({ id: r.id, user_id: this.userId, nombre: r.nombre, kind: r.kind, amount_cop: r.amountCop, categoria: r.categoria, cuenta_id: r.cuentaId, dia_del_mes: r.diaDelMes, created_at: r.createdAt, archived_at: r.archivedAt })),
    };
    const borrar = Object.fromEntries(Object.entries(cambios.borrar ?? {}).map(([clave, ids]) => [clave === 'cajitaMovimientos' ? 'cajita_movimientos' : clave, ids]));
    const { error } = await this.cliente.rpc('aplicar_cambios_financieros', {
      cambios: { guardar: filas, borrar, reemplazar: Boolean(cambios.reemplazar) },
      id_operacion: cambios.idOperacion ?? nuevoId('operacion'),
    });
    this.fallar('No se pudo completar la operación financiera', error);
  }

  async guardarMovimientosConTransaccion(
    movimientos: readonly CajitaMovimiento[],
    transaccion?: Transaction | null,
  ): Promise<void> {
    await this.aplicarCambios({ guardar: { cajitaMovimientos: [...movimientos], transacciones: transaccion ? [transaccion] : [] } });
  }

  async borrarMovimientoConTransaccion(movimientoId: string, transaccionId: string): Promise<void> {
    await this.aplicarCambios({ borrar: { cajitaMovimientos: [movimientoId], transacciones: [transaccionId] } });
  }

  async guardarMeta(meta: Meta): Promise<void> {
    const { error } = await this.cliente.from('metas').upsert(desdeMeta(meta, this.userId));
    this.fallar('No se pudo guardar la meta', error);
  }

  async borrarMeta(id: string): Promise<void> {
    const { error } = await this.cliente.from('metas').delete().eq('id', id);
    this.fallar('No se pudo eliminar la meta', error);
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    const { error } = await this.cliente
      .from('categorias')
      .upsert(desdeCategoria(categoria, this.userId));
    this.fallar('No se pudo guardar la categoría', error);
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    const { error } = await this.cliente
      .from('contactos')
      .upsert(desdeContacto(contacto, this.userId));
    this.fallar('No se pudo guardar el contacto', error);
  }

  async guardarRecurrente(recurrente: Recurrente): Promise<void> {
    const { error } = await this.cliente.from('recurrentes').upsert({
      id: recurrente.id,
      user_id: this.userId,
      nombre: recurrente.nombre,
      kind: recurrente.kind,
      amount_cop: recurrente.amountCop,
      categoria: recurrente.categoria,
      cuenta_id: recurrente.cuentaId,
      dia_del_mes: recurrente.diaDelMes,
      created_at: recurrente.createdAt,
      archived_at: recurrente.archivedAt,
    });
    this.fallar('No se pudo guardar el recurrente', error);
  }

  async borrarRecurrente(id: string): Promise<void> {
    const { error } = await this.cliente.from('recurrentes').delete().eq('id', id);
    this.fallar('No se pudo eliminar el recurrente', error);
  }

  async guardarPresupuesto(presupuesto: Presupuesto): Promise<void> {
    const { error } = await this.cliente.from('presupuestos').upsert({
      user_id: this.userId,
      categoria: presupuesto.categoria,
      monto_cop: presupuesto.montoCop,
      created_at: presupuesto.createdAt,
    });
    this.fallar('No se pudo guardar el presupuesto', error);
  }

  async borrarPresupuesto(categoria: string): Promise<void> {
    const { error } = await this.cliente
      .from('presupuestos')
      .delete()
      .eq('user_id', this.userId)
      .eq('categoria', categoria);
    this.fallar('No se pudo eliminar el presupuesto', error);
  }

  async borrarContacto(id: string): Promise<void> {
    const { error } = await this.cliente.from('contactos').delete().eq('id', id);
    this.fallar('No se pudo eliminar el contacto', error);
  }

  async borrarCategoria(id: string): Promise<void> {
    // Movements keep their category key — see RepositorioMemoria.
    const { error } = await this.cliente.from('categorias').delete().eq('id', id);
    this.fallar('No se pudo eliminar la categoría', error);
  }

  async vaciar(): Promise<void> {
    await this.aplicarCambios({ reemplazar: { transacciones: [], cajitas: [], cajitaMovimientos: [], metas: [], categorias: [], contactos: [], presupuestos: [], recurrentes: [] } });
  }
}

// ------------------------------------------------------------------ mapeadores
// snake_case in Postgres, camelCase in TypeScript. Kept as plain functions so
// the shape of every column crossing the boundary is visible in one place.

interface FilaTransaccion {
  id: string;
  kind: string;
  amount_cop: number;
  category: string;
  description: string;
  occurred_on: string;
  cuenta_id: string | null;
  raw_transcript: string;
  cuotas_total: number | null;
  cuota_cop: number | null;
  created_at: string;
}

const aTransaccion = (fila: FilaTransaccion): Transaction => {
  const esFinanciado = typeof fila.cuotas_total === 'number' && fila.cuotas_total >= 2;
  return {
    id: fila.id,
    kind: fila.kind as TxKind,
    amountCop: Number(fila.amount_cop),
    category: fila.category as Category,
    description: fila.description,
    occurredOn: fila.occurred_on,
    cuentaId: fila.cuenta_id,
    rawTranscript: fila.raw_transcript,
    cuotasTotal: esFinanciado ? fila.cuotas_total : null,
    cuotaCop: esFinanciado && fila.cuota_cop !== null ? Number(fila.cuota_cop) : null,
    createdAt: fila.created_at,
  };
};

const desdeTransaccion = (tx: Transaction, userId: string) => {
  const esFinanciado = typeof tx.cuotasTotal === 'number' && tx.cuotasTotal >= 2;
  return {
    id: tx.id,
    user_id: userId,
    kind: tx.kind,
    amount_cop: tx.amountCop,
    category: tx.category,
    description: tx.description,
    occurred_on: tx.occurredOn,
    cuenta_id: tx.cuentaId,
    raw_transcript: tx.rawTranscript,
    cuotas_total: esFinanciado ? tx.cuotasTotal : null,
    cuota_cop: esFinanciado && typeof tx.cuotaCop === 'number' && tx.cuotaCop > 0 ? tx.cuotaCop : null,
    created_at: tx.createdAt,
  };
};

interface FilaCajita {
  es_bajo_monto?: boolean;
  id: string;
  nombre: string;
  emoji: string;
  tipo: string | null;
  clase_cuenta?: string | null;
  meta_cop: number | null;
  tasa_ea_pct: number | null;
  created_at: string;
  archived_at: string | null;
  limite_credito_cop?: number | null;
  dia_corte?: number | null;
  dia_pago?: number | null;
  pago_minimo_cop?: number | null;
}

const aCajita = (fila: FilaCajita): Cajita => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.emoji,
  tipo: aTipo(fila.tipo),
  esBajoMonto: fila.es_bajo_monto ?? false,
  claseCuenta:
    fila.clase_cuenta === 'efectivo' ||
    fila.clase_cuenta === 'banco' ||
    fila.clase_cuenta === 'billetera'
      ? (fila.clase_cuenta as ClaseCuenta)
      : null,
  metaCop: fila.meta_cop === null ? null : Number(fila.meta_cop),
  tasaEaPct: fila.tasa_ea_pct === null ? null : Number(fila.tasa_ea_pct),
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
  limiteCreditoCop: fila.limite_credito_cop === null || fila.limite_credito_cop === undefined ? null : Number(fila.limite_credito_cop),
  diaCorte: fila.dia_corte ?? null,
  diaPago: fila.dia_pago ?? null,
  pagoMinimoCop: fila.pago_minimo_cop === null || fila.pago_minimo_cop === undefined ? null : Number(fila.pago_minimo_cop),
});

const desdeCajita = (c: Cajita, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  emoji: c.icon,
  tipo: c.tipo,
  es_bajo_monto: c.esBajoMonto ?? false,
  clase_cuenta: c.tipo === 'cuenta' ? (c.claseCuenta ?? null) : null,
  meta_cop: c.metaCop,
  tasa_ea_pct: c.tasaEaPct,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
  limite_credito_cop: c.tipo === 'tarjeta' ? (c.limiteCreditoCop ?? null) : null,
  dia_corte: c.tipo === 'tarjeta' ? (c.diaCorte ?? null) : null,
  dia_pago: c.tipo === 'tarjeta' ? (c.diaPago ?? null) : null,
  pago_minimo_cop: c.tipo === 'tarjeta' ? (c.pagoMinimoCop ?? null) : null,
});

interface FilaMovimiento {
  cuotas_total?: number | null;
  cuota_cop?: number | null;
  interes_pct?: number | null;
  cuota_manejo_cop?: number | null;
  id: string;
  cajita_id: string;
  kind: string;
  delta_cop: number;
  categoria: string | null;
  occurred_on: string;
  nota: string;
  created_at: string;
}

const aMovimiento = (fila: FilaMovimiento): CajitaMovimiento => ({
  id: fila.id,
  cajitaId: fila.cajita_id,
  kind: fila.kind as CajitaMovKind,
  cuotasTotal: fila.cuotas_total ?? null,
  cuotaCop: fila.cuota_cop == null ? null : Number(fila.cuota_cop),
  interesPct: fila.interes_pct == null ? null : Number(fila.interes_pct),
  cuotaManejoCop: fila.cuota_manejo_cop == null ? null : Number(fila.cuota_manejo_cop),
  deltaCop: Number(fila.delta_cop),
  categoria: (fila.categoria as Category | null) ?? null,
  occurredOn: fila.occurred_on,
  nota: fila.nota,
  createdAt: fila.created_at,
});

const desdeMovimiento = (m: CajitaMovimiento, userId: string) => ({
  id: m.id,
  user_id: userId,
  cajita_id: m.cajitaId,
  cuotas_total: m.cuotasTotal ?? null,
  cuota_cop: m.cuotaCop ?? null,
  interes_pct: m.interesPct ?? null,
  cuota_manejo_cop: m.cuotaManejoCop ?? null,
  kind: m.kind,
  delta_cop: m.deltaCop,
  categoria: m.categoria,
  occurred_on: m.occurredOn,
  nota: m.nota,
  created_at: m.createdAt,
});

interface FilaMeta {
  id: string;
  nombre: string;
  emoji: string;
  objetivo_cop: number;
  fecha_objetivo: string | null;
  cajita_id: string | null;
  ahorrado_cop: number;
  created_at: string;
  completed_at: string | null;
}

const aMeta = (fila: FilaMeta): Meta => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.emoji,
  objetivoCop: Number(fila.objetivo_cop),
  fechaObjetivo: fila.fecha_objetivo,
  cajitaId: fila.cajita_id,
  ahorradoCop: Number(fila.ahorrado_cop),
  createdAt: fila.created_at,
  completedAt: fila.completed_at,
});

const aRecurrente = (fila: {
  id: string;
  nombre: string;
  kind: string;
  amount_cop: number | string;
  categoria: string;
  cuenta_id: string | null;
  dia_del_mes: number;
  created_at: string;
  archived_at: string | null;
}): Recurrente => ({
  id: fila.id,
  nombre: fila.nombre,
  kind: fila.kind === 'ingreso' ? 'ingreso' : 'gasto',
  amountCop: Number(fila.amount_cop),
  categoria: fila.categoria,
  cuentaId: fila.cuenta_id,
  diaDelMes: fila.dia_del_mes,
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const aPresupuesto = (fila: {
  categoria: string;
  monto_cop: number | string;
  created_at: string;
}): Presupuesto => ({
  categoria: fila.categoria,
  montoCop: Number(fila.monto_cop),
  createdAt: fila.created_at,
});

interface FilaContacto {
  id: string;
  nombre: string;
  alias: string[] | null;
  separado_de: string[] | null;
  apodos: string[] | null;
  created_at: string;
  archived_at: string | null;
}

const aContacto = (fila: FilaContacto): Contacto => ({
  id: fila.id,
  nombre: fila.nombre,
  alias: fila.alias ?? [],
  separadoDe: fila.separado_de ?? [],
  apodos: fila.apodos ?? [],
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const desdeContacto = (c: Contacto, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  alias: c.alias,
  separado_de: c.separadoDe,
  apodos: c.apodos,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
});

interface FilaCategoria {
  id: string;
  nombre: string;
  icon: string | null;
  color: string | null;
  created_at: string;
  archived_at: string | null;
}

const aCategoria = (fila: FilaCategoria): CategoriaPersonal => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.icon ?? 'Package',
  color: fila.color ?? '#A8A29E',
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const desdeCategoria = (c: CategoriaPersonal, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  icon: c.icon,
  color: c.color,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
});

const desdeMeta = (m: Meta, userId: string) => ({
  id: m.id,
  user_id: userId,
  nombre: m.nombre,
  emoji: m.icon,
  objetivo_cop: m.objetivoCop,
  fecha_objetivo: m.fechaObjetivo,
  cajita_id: m.cajitaId,
  ahorrado_cop: m.ahorradoCop,
  created_at: m.createdAt,
  completed_at: m.completedAt,
});
