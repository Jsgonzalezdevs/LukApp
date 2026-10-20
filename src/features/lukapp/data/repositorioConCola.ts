import { nuevoId } from '../lib/id';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Presupuesto } from '../lib/presupuestos';
import type { Recurrente } from '../lib/recurrentes';
import type { CambiosFinancieros, Instantanea, Repositorio } from './repositorio';
import { RepositorioMemoria } from './repositorio';
import { RepositorioIndexedDB } from './indexeddb';
import { ColaCambios } from './colaCambios';
import type { MetodoDeEscritura } from './colaCambios';

/**
 * Si esto es lo que falló, es que no hay señal — no que el dato esté mal.
 *
 * Un fallo de constraint o de permiso llega en el campo `error` de la
 * respuesta de Supabase y `RepositorioSupabase.fallar` ya lo convierte en un
 * mensaje claro (`Error('El monto debe ser mayor que cero.')`, etc.). Un
 * fallo de RED, en cambio, hace que la propia promesa del `fetch` se
 * rechace ANTES de que exista una respuesta que interpretar — eso es lo que
 * distingue las dos cosas.
 */
const esErrorDeRed = (e: unknown): boolean => {
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return m.includes('failed to fetch') || m.includes('network') || m.includes('load failed');
  }
  return false;
};

/**
 * Guarda sin conexión y sube solo cuando vuelve la señal.
 *
 * Cada escritura se hace primero en `local` (siempre funciona, no necesita
 * internet) y luego se intenta en `remoto`. Si `remoto` falla por falta de
 * señal, el cambio se anota en `cola` en vez de perderse, y queda ahí hasta
 * que algo vuelva a pedir sincronizar.
 *
 * Las lecturas (`cargarTodo`) prefieren `remoto` cuando hay señal y la cola
 * está vacía — así se ve siempre el dato más fresco, incluido lo que otro
 * aparato haya escrito. Con la cola pendiente, leer de `remoto` sería mostrar
 * una versión que todavía no conoce tus propios cambios, así que en ese caso
 * se lee de `local`, que sí los tiene.
 */
/**
 * Lo que `RepositorioConCola` ofrece de más, por encima de `Repositorio`.
 *
 * Ningún otro repositorio (memoria, IndexedDB a secas, Supabase a secas) lo
 * implementa — solo tiene sentido cuando hay dos capas y una cola entre ellas.
 * `useAlmacen` comprueba con `tieneSincronizacion` antes de usarlo, así que
 * sigue funcionando igual con cualquier otro repositorio.
 */
export interface RepositorioConSincronizacion {
  cambiosPendientes(): Promise<number>;
  sincronizar(): Promise<void>;
  readonly errorSincronizacion?: string | null;
}

export const tieneSincronizacion = (
  repo: Repositorio,
): repo is Repositorio & RepositorioConSincronizacion =>
  typeof (repo as Partial<RepositorioConSincronizacion>).cambiosPendientes === 'function';

const tieneDatos = (datos: Instantanea): boolean =>
  datos.transacciones.length > 0 ||
  datos.cajitas.length > 0 ||
  datos.cajitaMovimientos.length > 0 ||
  datos.metas.length > 0 ||
  datos.categorias.length > 0 ||
  datos.contactos.length > 0 ||
  datos.presupuestos.length > 0 ||
  datos.recurrentes.length > 0;

export class RepositorioConCola implements Repositorio {
  private readonly local: Repositorio;
  private readonly remoto: Repositorio;
  private readonly cola: ColaCambios;
  private operaciones: Promise<unknown> = Promise.resolve();
  errorSincronizacion: string | null = null;

  private enOrden<T>(trabajo: () => Promise<T>): Promise<T> {
    const ejecutar = () => this.local instanceof RepositorioIndexedDB
      ? this.local.conExclusion(trabajo)
      : trabajo();
    const resultado = this.operaciones.then(ejecutar, ejecutar);
    this.operaciones = resultado.catch(() => undefined);
    return resultado;
  }

  constructor(local: Repositorio, remoto: Repositorio, cola: ColaCambios) {
    this.local = local;
    this.remoto = remoto;
    this.cola = cola;
  }

  /** Cuántos cambios están esperando subir. Lo usa la app para avisarlo. */
  async cambiosPendientes(): Promise<number> {
    return this.cola.contar();
  }

  /**
   * Intenta subir todo lo que está en la cola, en el orden en que se guardó.
   *
   * Se detiene en el primer fallo y deja el resto tal como estaba: nunca
   * salta un cambio para intentar el siguiente. Editar y luego borrar el
   * mismo movimiento tiene que subir en ese orden — si el borrado llegara
   * primero, la edición de algo que ya no existe fallaría también, y en el
   * orden equivocado.
   *
   * Un fallo que NO es de red (por ejemplo la sesión venció) también detiene
   * la cola en vez de descartar el cambio: en una app de plata, perder en
   * silencio algo que la persona sí guardó es peor que dejarlo pendiente un
   * rato más largo de lo normal.
   */
  async sincronizar(): Promise<void> {
    return this.enOrden(() => this.sincronizarPendientes());
  }

  private async sincronizarPendientes(): Promise<void> {
    this.errorSincronizacion = null;
    if (!navigator.onLine) return;
    for (const cambio of await this.cola.listar()) {
      try {
        await this.llamarRemoto(cambio.metodo, cambio.args);
        await this.cola.quitar(cambio.clave);
      } catch (error) {
        this.errorSincronizacion = error instanceof Error ? error.message : 'No se pudo sincronizar. Inténtalo de nuevo.';
        return;
      }
    }
  }

  async cargarTodo(): Promise<Instantanea> {
    return this.enOrden(() => this.leerTodo());
  }

  private async leerTodo(): Promise<Instantanea> {
    if (navigator.onLine) {
      await this.sincronizarPendientes();
      if ((await this.cola.contar()) === 0) {
        try {
          const fresco = await this.remoto.cargarTodo();
          const local = await this.local.cargarTodo();
          // Una respuesta completamente vacía no debe destruir una copia local
          // válida. Esto ocurre cuando la sesión/RLS todavía no está lista o
          // cuando el cliente apunta al proyecto equivocado; para una app de
          // dinero es preferible conservar los datos y dejar visible el estado
          // conocido que reemplazarlo silenciosamente por ceros.
          if (tieneDatos(local) && !tieneDatos(fresco)) {
            this.errorSincronizacion = 'El servidor devolvió un historial vacío. Conservamos la copia de este dispositivo; revisa tu sesión antes de reemplazarla.';
            return local;
          }
          await this.espejarEnLocal(fresco);
          return fresco;
        } catch (e) {
          if (!esErrorDeRed(e)) throw e;
          // Fallo de red pese a que `navigator.onLine` decía que sí había:
          // pasa con redes capturas de portal cautivo o inestables. Se sigue
          // con el caché de abajo en vez de dejar la pantalla en blanco.
        }
      }
    }
    return this.local.cargarTodo();
  }

  /** Copia todo lo del servidor al caché local, para que quede si se cae la señal. */
  private async espejarEnLocal(datos: Instantanea): Promise<void> {
    await this.local.aplicarCambios({ reemplazar: datos });
  }

  private async llamarRemoto(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    const fn = this.remoto[metodo] as (...a: unknown[]) => Promise<void>;
    await fn.apply(this.remoto, args);
  }

  private async escribir(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    return this.enOrden(async () => {
      const anterior = await this.local.cargarTodo();
      const simulacion = new RepositorioMemoria(anterior);
      const fn = simulacion[metodo] as (...a: unknown[]) => Promise<void>;
      await fn.apply(simulacion, args);
      const siguiente = await simulacion.cargarTodo();
      const habiaPendientes = (await this.cola.contar()) > 0;
      let clave: IDBValidKey;
      if (this.local instanceof RepositorioIndexedDB) {
        clave = await this.local.confirmarPendiente(siguiente, metodo, args);
      } else {
        clave = await this.cola.encolar(metodo, args);
        try { await this.local.aplicarCambios({ reemplazar: siguiente }); }
        catch (error) { await this.cola.quitar(clave); throw error; }
      }
      if (habiaPendientes || !navigator.onLine) return;
      try {
        await this.llamarRemoto(metodo, args);
      } catch (error) {
        if (esErrorDeRed(error)) return;
        if (this.local instanceof RepositorioIndexedDB) {
          await this.local.descartarPendiente(anterior, clave);
        } else {
          await this.local.aplicarCambios({ reemplazar: anterior });
          await this.cola.quitar(clave);
        }
        throw error;
      }
      // Si falla la confirmación local, el envío sigue pendiente e idempotente.
      try { await this.cola.quitar(clave); }
      catch { this.errorSincronizacion = 'El cambio llegó al servidor; falta confirmar la sincronización en este dispositivo.'; }
    });
  }

  async aplicarCambios(cambios: CambiosFinancieros): Promise<void> {
    await this.escribir('aplicarCambios', [{ ...cambios, idOperacion: cambios.idOperacion ?? nuevoId('operacion') }]);
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    await this.escribir('guardarTransacciones', [transacciones]);
  }

  async borrarTransaccion(id: string): Promise<void> {
    await this.escribir('borrarTransaccion', [id]);
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    await this.escribir('guardarCajita', [cajita]);
  }

  async borrarCajita(id: string): Promise<void> {
    await this.escribir('borrarCajita', [id]);
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    await this.escribir('guardarCajitaMovimientos', [movimientos]);
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    await this.escribir('borrarCajitaMovimiento', [id]);
  }

  async guardarMovimientosConTransaccion(
    movimientos: readonly CajitaMovimiento[],
    transaccion?: Transaction | null,
  ): Promise<void> {
    await this.aplicarCambios({ guardar: { cajitaMovimientos: [...movimientos], transacciones: transaccion ? [transaccion] : [] } });
  }

  async borrarMovimientoConTransaccion(
    movimientoId: string,
    transaccionId: string,
  ): Promise<void> {
    await this.aplicarCambios({ borrar: { cajitaMovimientos: [movimientoId], transacciones: [transaccionId] } });
  }

  async guardarMeta(meta: Meta): Promise<void> {
    await this.escribir('guardarMeta', [meta]);
  }

  async borrarMeta(id: string): Promise<void> {
    await this.escribir('borrarMeta', [id]);
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    await this.escribir('guardarCategoria', [categoria]);
  }

  async borrarCategoria(id: string): Promise<void> {
    await this.escribir('borrarCategoria', [id]);
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    await this.escribir('guardarContacto', [contacto]);
  }

  async borrarContacto(id: string): Promise<void> {
    await this.escribir('borrarContacto', [id]);
  }

  async guardarPresupuesto(presupuesto: Presupuesto): Promise<void> {
    await this.escribir('guardarPresupuesto', [presupuesto]);
  }

  async borrarPresupuesto(categoria: string): Promise<void> {
    await this.escribir('borrarPresupuesto', [categoria]);
  }

  async guardarRecurrente(recurrente: Recurrente): Promise<void> {
    await this.escribir('guardarRecurrente', [recurrente]);
  }

  async borrarRecurrente(id: string): Promise<void> {
    await this.escribir('borrarRecurrente', [id]);
  }

  /**
   * Igual que cualquier otra escritura: local primero, remoto si hay señal,
   * a la cola si no.
   *
   * La primera versión de esto lo enviaba siempre de inmediato, sin pasar por
   * `escribir()`. Se veía más seguro para algo tan destructivo, pero era un
   * error real: `useAlmacen.restaurar` llama `vaciar()` y LUEGO reescribe todo
   * con una tanda de `guardar*` que sí quedan en cola sin señal. Si `vaciar()`
   * hubiera fallado ahí en medio por falta de conexión, el local ya habría
   * quedado vacío — la restauración parecería haber borrado el libro entero
   * en vez de reemplazarlo. Pasando por la cola igual que el resto, un
   * restaurar offline simplemente encola el vaciado y las escrituras que le
   * siguen, en orden, y sube todo junto cuando vuelva la señal.
   */
  async vaciar(): Promise<void> {
    await this.aplicarCambios({ reemplazar: { transacciones: [], cajitas: [], cajitaMovimientos: [], metas: [], categorias: [], contactos: [], presupuestos: [], recurrentes: [] } });
  }
}
