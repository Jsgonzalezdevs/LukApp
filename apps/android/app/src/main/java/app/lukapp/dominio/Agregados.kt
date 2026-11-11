package app.lukapp.dominio

/** Origen: `lib/aggregate.ts` (`CategorySlice`). `pct` 0..100 con un decimal, sobre el total de esa dirección. */
data class CategorySlice(val category: String, val total: Long, val pct: Double)

/** Origen: `lib/aggregate.ts` (`MonthTotals`). `tasaAhorro` null sin ingresos: 0 % y «sin ingresos» no son lo mismo. */
data class MonthTotals(val ingresos: Long, val gastos: Long, val balance: Long, val tasaAhorro: Double?)

/** Origen: `lib/aggregate.ts` (`forMonth`). */
fun forMonth(transacciones: List<Transaccion>, mes: String): List<Transaccion> =
    transacciones.filter { monthKey(it.occurredOn) == mes }

/** Origen: `lib/aggregate.ts` (`forPeriod`). Con la config por defecto es idéntico a `forMonth`. */
fun forPeriod(transacciones: List<Transaccion>, clave: String, config: ConfigPeriodo): List<Transaccion> =
    transacciones.filter { enElPeriodo(it.occurredOn, clave, config) }

/** Origen: `lib/aggregate.ts` (`monthTotals`). Las transferencias no son ingreso ni gasto. */
fun monthTotals(transacciones: List<Transaccion>): MonthTotals {
    var ingresos = 0L
    var gastos = 0L
    for (tx in transacciones) {
        if (tx.kind == TipoTx.INGRESO) ingresos += tx.amountCop
        else if (tx.kind == TipoTx.GASTO) gastos += tx.amountCop
    }
    val tasa = if (ingresos > 0) Math.round((ingresos - gastos).toDouble() / ingresos * 1000) / 10.0 else null
    return MonthTotals(ingresos, gastos, ingresos - gastos, tasa)
}

/**
 * Origen: `lib/aggregate.ts` (`byCategory`). Mayor primero; empate por clave. El
 * porcentaje es de la dirección y no del balance, para que nada pase de 100 %.
 */
fun byCategory(transacciones: List<Transaccion>, kind: String): List<CategorySlice> {
    val totales = LinkedHashMap<String, Long>()
    for (tx in transacciones) {
        if (tx.kind != kind) continue
        totales[tx.category] = (totales[tx.category] ?: 0L) + tx.amountCop
    }
    val gran = totales.values.sum()
    if (gran == 0L) return emptyList()
    return totales.map { (c, t) -> CategorySlice(c, t, Math.round(t.toDouble() / gran * 1000) / 10.0) }
        .sortedWith(compareByDescending<CategorySlice> { it.total }.thenBy { it.category })
}

/** Origen: `lib/aggregate.ts` (`monthsPresent`). Del más reciente al más viejo. */
fun monthsPresent(transacciones: List<Transaccion>): List<String> =
    transacciones.map { monthKey(it.occurredOn) }.distinct().sortedDescending()
