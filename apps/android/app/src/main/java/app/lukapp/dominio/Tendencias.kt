package app.lukapp.dominio

/** Origen: `lib/tendencias.ts` (`PuntoMensual`). */
data class PuntoMensual(val month: String, val ingresos: Long, val gastos: Long, val balance: Long)

/** Origen: `lib/tendencias.ts` (`ultimosMeses`). La ventana de `cuantos` meses, del más viejo al `hasta`. */
fun ultimosMeses(hasta: String, cuantos: Int): List<String> = (0 until cuantos).map { shiftMonth(hasta, it - (cuantos - 1)) }

/** Origen: `lib/tendencias.ts` (`serieMensual`). Los meses sin actividad quedan como ceros explícitos. */
fun serieMensual(transacciones: List<Transaccion>, meses: List<String>): List<PuntoMensual> =
    meses.map { mes -> monthTotals(forMonth(transacciones, mes)).let { PuntoMensual(mes, it.ingresos, it.gastos, it.balance) } }

/** Origen: `lib/tendencias.ts` (`CambioCategoria`). */
data class CambioCategoria(val category: String, val actualCop: Long, val anteriorCop: Long, val deltaCop: Long, val deltaPct: Double?)

private fun totalPorCategoria(txs: List<Transaccion>, kind: String): Map<String, Long> {
    val totales = LinkedHashMap<String, Long>()
    for (tx in txs) if (tx.kind == kind) totales[tx.category] = (totales[tx.category] ?: 0) + tx.amountCop
    return totales
}

/** `Math.round(x * 1000) / 10`: un decimal, como la web. */
private fun pct1(ahora: Long, antes: Long): Double? =
    if (antes > 0) Math.round((ahora - antes).toDouble() / antes * 1000) / 10.0 else null

/** Origen: `lib/tendencias.ts` (`compararCategorias`). De la que más subió a la que más bajó. */
fun compararCategorias(transacciones: List<Transaccion>, mesActual: String, mesAnterior: String, kind: String = "gasto"): List<CambioCategoria> {
    val actual = totalPorCategoria(forMonth(transacciones, mesActual), kind)
    val anterior = totalPorCategoria(forMonth(transacciones, mesAnterior), kind)
    return (actual.keys + anterior.keys).distinct().map { c ->
        val a = actual[c] ?: 0; val b = anterior[c] ?: 0
        CambioCategoria(c, a, b, a - b, pct1(a, b))
    }.sortedByDescending { it.deltaCop }
}

/** Origen: `lib/tendencias.ts` (`RANGOS`). */
enum class RangoTendencia(val meses: Int, val corto: String, val largo: String) {
    TRIMESTRE(3, "3M", "trimestre"), SEMESTRE(6, "6M", "semestre"), ANIO(12, "12M", "año")
}

/** Origen: `lib/tendencias.ts` (`TotalRango`). */
data class TotalRango(val ingresos: Long, val gastos: Long, val balance: Long, val mesesConDatos: Int)

private fun sumarSerie(serie: List<PuntoMensual>) = TotalRango(
    serie.sumOf { it.ingresos }, serie.sumOf { it.gastos }, serie.sumOf { it.balance },
    serie.count { it.ingresos > 0 || it.gastos > 0 },
)

/** Origen: `lib/tendencias.ts` (`ComparacionRango`). */
data class ComparacionRango(
    val actual: TotalRango, val anterior: TotalRango,
    val gastoMensualActual: Long, val gastoMensualAnterior: Long, val deltaGastos: Long, val deltaGastosPct: Double?,
    val ingresoMensualActual: Long, val ingresoMensualAnterior: Long, val deltaIngresos: Long, val deltaIngresosPct: Double?,
    val hayComparacion: Boolean,
)

private fun porMes(total: Long, mesesConDatos: Int): Long = if (mesesConDatos > 0) Math.round(total.toDouble() / mesesConDatos) else 0

/** Origen: `lib/tendencias.ts` (`compararRangos`). Compara por mes con datos, para que más historia no parezca más gasto. */
fun compararRangos(transacciones: List<Transaccion>, hasta: String, meses: Int): ComparacionRango {
    val actual = sumarSerie(serieMensual(transacciones, ultimosMeses(hasta, meses)))
    val anterior = sumarSerie(serieMensual(transacciones, ultimosMeses(shiftMonth(hasta, -meses), meses)))
    val gA = porMes(actual.gastos, actual.mesesConDatos); val gB = porMes(anterior.gastos, anterior.mesesConDatos)
    val iA = porMes(actual.ingresos, actual.mesesConDatos); val iB = porMes(anterior.ingresos, anterior.mesesConDatos)
    return ComparacionRango(actual, anterior, gA, gB, gA - gB, pct1(gA, gB), iA, iB, iA - iB, pct1(iA, iB), anterior.mesesConDatos > 0)
}

/** Origen: `lib/tendencias.ts` (`PromedioMensual`). */
data class PromedioMensual(val ingresos: Long, val gastos: Long, val balance: Long, val meses: Int)

/** Origen: `lib/tendencias.ts` (`promedioMensual`). Solo cuenta los meses con movimientos. */
fun promedioMensual(serie: List<PuntoMensual>): PromedioMensual {
    val c = serie.filter { it.ingresos > 0 || it.gastos > 0 }
    if (c.isEmpty()) return PromedioMensual(0, 0, 0, 0)
    fun prom(f: (PuntoMensual) -> Long) = Math.round(c.sumOf(f).toDouble() / c.size)
    return PromedioMensual(prom { it.ingresos }, prom { it.gastos }, prom { it.balance }, c.size)
}
