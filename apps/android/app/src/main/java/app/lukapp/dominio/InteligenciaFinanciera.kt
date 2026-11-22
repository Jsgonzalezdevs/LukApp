package app.lukapp.dominio

/** Origen: `lib/inteligenciaFinanciera.ts` (`AnomaliaFinanciera`). */
data class AnomaliaFinanciera(val categoria: String, val monto: Long, val promedio: Double, val porcentajeSobrePromedio: Double)

/**
 * Origen: `lib/inteligenciaFinanciera.ts` (`detectarAnomalias`). El gasto más alto de cada categoría contra el
 * promedio de los demás de esa categoría; pide al menos dos y que lo supere por 75 % o más.
 * Si todos valen lo mismo no hay «demás» y el promedio sería 0/0: en la web eso da NaN, que cuenta como 0 %.
 */
fun detectarAnomalias(movimientos: List<Transaccion>): List<AnomaliaFinanciera> {
    val porCategoria = LinkedHashMap<String, MutableList<Long>>()
    for (m in movimientos) if (m.kind == TipoTx.GASTO) porCategoria.getOrPut(m.category) { mutableListOf() }.add(m.amountCop)
    return porCategoria.mapNotNull { (categoria, montos) ->
        if (montos.size < 2) return@mapNotNull null
        val monto = montos.max()
        val historico = montos.filter { it != monto }
        val promedio = if (historico.isEmpty()) Double.NaN else historico.sum().toDouble() / historico.size
        val pct = if (promedio.isNaN() || promedio == 0.0) 0.0 else (monto / promedio - 1) * 100
        AnomaliaFinanciera(categoria, monto, promedio, pct).takeIf { pct >= 75 }
    }
}
