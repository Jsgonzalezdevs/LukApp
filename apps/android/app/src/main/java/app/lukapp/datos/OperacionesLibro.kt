package app.lukapp.datos

import app.lukapp.dominio.CATEGORIES
import app.lukapp.dominio.Libro
import app.lukapp.dominio.TipoTx
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.emparejarComprasTarjeta
import app.lukapp.dominio.idsPasivos
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Las operaciones compuestas de `useAlmacen.ts` como funciones puras: reciben el
 * libro y devuelven el cambio atómico que se manda a la RPC. Separadas del
 * repositorio para poder probarlas sin red.
 */
object OperacionesLibro {

    /**
     * Origen: `actualizarTransaccion`. Una compra en tarjeta o deuda vive en dos
     * sitios (el movimiento del libro y la `compra` de la tarjeta): editarla
     * actualiza los dos, y si deja de ser compra de un pasivo se borra la `compra`.
     */
    fun actualizarTransaccion(libro: Libro, tx: Transaccion): Cambios {
        val pasivos = idsPasivos(libro.cajitas)
        val movimientoId = emparejarComprasTarjeta(libro.movimientos, libro.transacciones, pasivos)[tx.id]
        val anterior = movimientoId?.let { id -> libro.movimientos.firstOrNull { it.id == id } }
        val sigueSiendoCompra = tx.kind == TipoTx.GASTO && tx.cuentaId != null && tx.cuentaId in pasivos
        if (anterior != null && sigueSiendoCompra) {
            val actualizado = anterior.copy(
                cajitaId = tx.cuentaId!!,
                deltaCop = abs(tx.amountCop),
                categoria = tx.category.takeIf { it in CATEGORIES },
                occurredOn = tx.occurredOn,
                nota = tx.description,
                cuotasTotal = tx.cuotasTotal,
                cuotaCop = tx.cuotaCop,
            )
            return Cambios(guardar = Libro(transacciones = listOf(tx), movimientos = listOf(actualizado)))
        }
        return Cambios(
            guardar = Libro(transacciones = listOf(tx)),
            borrar = if (anterior != null) mapOf("cajitaMovimientos" to listOf(anterior.id)) else emptyMap(),
        )
    }

    /** Origen: `borrarTransaccion`. Borra también la `compra` emparejada de la tarjeta, si la hay. */
    fun borrarTransaccion(libro: Libro, id: String): Cambios {
        val movimientoId = emparejarComprasTarjeta(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))[id]
        return Cambios(
            borrar = buildMap {
                put("transacciones", listOf(id))
                if (movimientoId != null) put("cajitaMovimientos", listOf(movimientoId))
            },
        )
    }
}

/** Origen: `lib/senalesAvanzadas.ts` (`AnálisisAnomalia`). */
data class AnalisisAnomalia(val esAnomalia: Boolean, val percentil: Long, val promedio: Double, val desv: Double)

/** Origen: `lib/senalesAvanzadas.ts` (`analizarAnomalias`). Raro = fuera de ±2σ de lo gastado en esa categoría. */
fun analizarAnomalias(transacciones: List<Transaccion>, categoria: String, montoActual: Long): AnalisisAnomalia {
    val montos = transacciones.filter { it.category == categoria }.map { it.amountCop }.sorted()
    if (montos.isEmpty()) return AnalisisAnomalia(false, 50, 0.0, 0.0)
    val promedio = montos.sum().toDouble() / montos.size
    val desv = sqrt(montos.sumOf { (it - promedio) * (it - promedio) } / montos.size)
    val percentil = Math.round(montos.count { it <= montoActual }.toDouble() / montos.size * 100)
    return AnalisisAnomalia(abs(montoActual - promedio) > 2 * desv && desv > 0, percentil, promedio, desv)
}
