package app.lukapp.dominio

import kotlin.math.abs

/**
 * Origen: `lib/obligacionesFuturas.ts` (`ObligacionFutura`).
 * `origen`: recurrente, cuota, tarjeta, deuda, manual. `estado`: programada, vencida,
 * confirmada, desconocida. `certeza`: real, programada, estimada, desconocida.
 */
data class ObligacionFutura(
    val id: String,
    val origen: String,
    val concepto: String,
    val fecha: String?,
    val periodo: String?,
    val montoCop: Long?,
    val cuentaId: String?,
    val estado: String,
    val certeza: String,
)

/**
 * Origen: `lib/obligacionesFuturas.ts` (`construirObligacionesFuturas`). Las cuotas se
 * trazan, pero la salida es el pago mensual de la tarjeta, para no contarlas dos veces.
 * Las deudas sin fecha entran con certeza «desconocida».
 */
fun construirObligacionesFuturas(libro: Libro, hoy: String, horizonteDias: Int = 90): List<ObligacionFutura> {
    val hasta = shiftDays(hoy, maxOf(0, horizonteDias))
    val mesActual = hoy.take(7)
    val meses = LinkedHashSet<String>()
    var cursor = hoy
    while (cursor <= hasta) {
        meses.add(cursor.take(7))
        cursor = shiftDays(cursor, 1)
    }
    val salida = mutableListOf<ObligacionFutura>()
    val recurrentesGasto = libro.recurrentes.filter { it.archivedAt == null && it.kind == TipoTx.GASTO }
    for (mes in meses) {
        for (r in recurrentesGasto) {
            if (mes == mesActual && yaRegistrado(r, libro.transacciones, mes)) continue
            val fecha = fechaEnMes(r, mes)
            if (fecha >= hoy && fecha <= hasta) {
                salida.add(ObligacionFutura("recurrente-${r.id}-$fecha", "recurrente", r.nombre, fecha, mes, r.amountCop, r.cuentaId, "programada", "programada"))
            }
        }
    }
    for (tarjeta in libro.cajitas.filter { it.tipo == TipoCajita.TARJETA && it.archivedAt == null }) {
        val saldo = abs(totalPorTipo(listOf(tarjeta), libro.movimientos, TipoCajita.TARJETA, libro.transacciones))
        for (mes in meses) {
            val pago = if (mes == mesActual) {
                resumenTarjeta(tarjeta, saldo, libro.transacciones, libro.movimientos, mes, hoy).pagoSiguienteCop
            } else {
                pagoMensualTarjeta(libro.transacciones, tarjeta.id, mes)
            }
            val fecha = fechaPagoDePeriodo(tarjeta, mes)
            if (pago <= 0) continue
            val id = "pago-tarjeta-${tarjeta.id}-$mes"
            val concepto = "Pago de ${tarjeta.nombre}"
            if (fecha != null && fecha >= hoy && fecha <= hasta) {
                salida.add(ObligacionFutura(id, "tarjeta", concepto, fecha, mes, pago, null, "programada", "estimada"))
            } else if (fecha == null) {
                // En la web la condición extra (`mes actual || hasta >= hoy`) siempre se cumple.
                salida.add(ObligacionFutura(id, "tarjeta", concepto, null, mes, pago, null, "desconocida", "desconocida"))
            }
        }
    }
    for (deuda in libro.cajitas.filter { it.tipo == TipoCajita.DEUDA && it.archivedAt == null }) {
        val importe = abs(totalPorTipo(listOf(deuda), libro.movimientos, TipoCajita.DEUDA, libro.transacciones))
        if (importe > 0) {
            salida.add(ObligacionFutura("deuda-${deuda.id}", "deuda", "Saldo pendiente de ${deuda.nombre}", null, mesActual, importe, deuda.id, "desconocida", "desconocida"))
        }
    }
    return salida.sortedWith(compareBy<ObligacionFutura> { it.fecha ?: "9999-99-99" }.thenBy { it.id })
}

/** Origen: `lib/entradasFuturas.ts` (`EntradaFutura`). `certeza`: programada, estimada, desconocida. */
data class EntradaFutura(
    val id: String,
    val fecha: String?,
    val periodo: String?,
    val montoCop: Long,
    val certeza: String,
    val concepto: String,
)

/**
 * Origen: `lib/entradasFuturas.ts` (`construirEntradasFuturas`). Única lectura de los
 * ingresos futuros: solo recurrentes de ingreso aún no registrados en su mes.
 */
fun construirEntradasFuturas(libro: Libro, hoy: String, horizonteDias: Int = 90): List<EntradaFutura> {
    // La web compara contra `hasta.toISOString()` de una medianoche local: en Bogotá
    // (UTC-5) eso es el mismo día, que es lo que se replica aquí.
    val hasta = shiftDays(hoy, maxOf(0, horizonteDias))
    val meses = mutableListOf<String>()
    var cursor = "${hoy.take(7)}-01"
    while (cursor <= hasta) {
        meses.add(cursor.take(7))
        cursor = "${shiftMonth(cursor.take(7), 1)}-01"
    }
    val salida = mutableListOf<EntradaFutura>()
    for (r in libro.recurrentes.filter { it.archivedAt == null && it.kind == TipoTx.INGRESO }) {
        for (periodo in meses) {
            if (yaRegistrado(r, libro.transacciones, periodo)) continue
            val fecha = if (r.diaDelMes in 1..31) fechaEnMes(r, periodo) else null
            if (fecha == null || (fecha >= hoy && fecha <= hasta)) {
                salida.add(EntradaFutura("ingreso-${r.id}-$periodo", fecha, periodo, r.amountCop, if (fecha != null) "programada" else "desconocida", r.nombre))
            }
        }
    }
    return salida.sortedWith(compareBy<EntradaFutura> { it.fecha ?: "" }.thenBy { it.id })
}
