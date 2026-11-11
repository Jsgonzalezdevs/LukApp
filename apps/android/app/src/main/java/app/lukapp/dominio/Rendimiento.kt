package app.lukapp.dominio

private const val DIAS_ANIO = 365.0

/**
 * Origen: `lib/rendimiento.ts` (`tasaDiaria`). La E.A. ya incluye capitalización: la tasa
 * diaria es la raíz 365, nunca `EA / 365` (que sobra ~6 % a 13 % E.A.).
 */
fun tasaDiaria(tasaEaPct: Double): Double = Math.pow(1 + tasaEaPct / 100, 1 / DIAS_ANIO) - 1

/** Origen: `lib/rendimiento.ts` (`rendimientoDiario`). Sin redondear, como la web. */
fun rendimientoDiario(saldoCop: Double, tasaEaPct: Double): Double = saldoCop * tasaDiaria(tasaEaPct)

private fun factor(tasaEaPct: Double, dias: Int): Double = Math.pow(1 + tasaEaPct / 100, dias / DIAS_ANIO)

/** Origen: `lib/rendimiento.ts` (`RendimientoEstimado`). */
data class RendimientoEstimado(val acumuladoCop: Long, val diarioCop: Long, val anualCop: Long, val dias: Int)

/**
 * Origen: `lib/rendimiento.ts` (`rendimientoEstimado`). Recorre el historial real y hace
 * crecer el saldo que de verdad hubo en cada tramo. Es derivado: nunca se escribe como
 * movimiento, para que el saldo siga siendo la suma de sus movimientos.
 */
fun rendimientoEstimado(movimientos: List<CajitaMovimiento>, cajitaId: String, tasaEaPct: Double?, hoy: String): RendimientoEstimado? {
    if (tasaEaPct == null || tasaEaPct <= 0) return null
    val propios = movimientos.filter { it.cajitaId == cajitaId }
        .sortedWith(compareBy<CajitaMovimiento> { it.occurredOn }.thenBy { it.createdAt })
    if (propios.isEmpty()) return null
    var saldo = 0L
    var conIntereses = 0.0
    var fecha = propios[0].occurredOn
    for (mov in propios) {
        val dias = daysBetween(fecha, mov.occurredOn)
        if (dias > 0 && saldo > 0) conIntereses += saldo * (factor(tasaEaPct, dias) - 1)
        saldo += mov.deltaCop
        fecha = mov.occurredOn
    }
    // Un movimiento con fecha futura restaría intereses: se acota en cero.
    val diasFinales = maxOf(0, daysBetween(fecha, hoy))
    if (diasFinales > 0 && saldo > 0) conIntereses += saldo * (factor(tasaEaPct, diasFinales) - 1)
    val positivo = maxOf(0L, saldo).toDouble()
    return RendimientoEstimado(
        acumuladoCop = Math.round(conIntereses),
        diarioCop = Math.round(rendimientoDiario(positivo, tasaEaPct)),
        anualCop = Math.round(positivo * (tasaEaPct / 100)),
        dias = maxOf(0, daysBetween(propios[0].occurredOn, hoy)),
    )
}
