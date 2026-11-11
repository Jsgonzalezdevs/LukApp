package app.lukapp.dominio

/** Origen: `lib/racha.ts` (`HitoRacha`). */
data class HitoRacha(val dias: Int, val titulo: String, val emoji: String, val descripcion: String)

/** Origen: `lib/racha.ts` (`HITOS_RACHA`). */
val HITOS_RACHA: List<HitoRacha> = listOf(
    HitoRacha(3, "Primer impulso", "🌱", "3 días seguidos anotando tus gastos"),
    HitoRacha(7, "Hábito semanal", "🔥", "Una semana completa de control financiero"),
    HitoRacha(14, "Quincena bajo control", "⚡", "2 semanas conociendo cada peso"),
    HitoRacha(21, "Hábito consolidado", "💎", "21 días: tu cerebro ya automatizó el control"),
    HitoRacha(30, "Mes perfecto", "🏆", "Un mes completo sin fugas de dinero"),
    HitoRacha(60, "Doble mes maestro", "👑", "2 meses de consistencia total"),
    HitoRacha(100, "Centurión financiero", "🚀", "100 días de maestría en tus números"),
    HitoRacha(365, "Leyenda LukApp", "🌟", "Un año entero dominando tus finanzas"),
)

/** Origen: `lib/racha.ts` (`InfoRacha`). */
data class InfoRacha(
    val rachaActual: Int,
    val rachaMaxima: Int,
    val anotadoHoy: Boolean,
    val diasAnotadosMes: Int,
    val ultimoDiaAnotado: String?,
    val hitosAlcanzados: List<HitoRacha>,
    val proximoHito: HitoRacha?,
    val diasParaProximoHito: Int?,
)

/**
 * Origen: `lib/racha.ts` (`calcularRacha`). Si hoy aún no anotó pero ayer sí, la racha
 * sigue viva: no se penaliza antes de medianoche.
 */
fun calcularRacha(transacciones: List<Transaccion>, hoy: String): InfoRacha {
    if (transacciones.isEmpty()) {
        return InfoRacha(0, 0, false, 0, null, emptyList(), HITOS_RACHA[0], HITOS_RACHA[0].dias)
    }
    val fechasUnicas = transacciones.map { it.occurredOn }.filter { it.isNotEmpty() }.distinct().sortedDescending()
    val fechas = fechasUnicas.toHashSet()
    val anotadoHoy = hoy in fechas
    val ayer = shiftDays(hoy, -1)
    var rachaActual = 0
    if (anotadoHoy || ayer in fechas) {
        var cursor = if (anotadoHoy) hoy else ayer
        while (cursor in fechas) {
            rachaActual += 1
            cursor = shiftDays(cursor, -1)
        }
    }
    var rachaMaxima = 0
    if (fechasUnicas.isNotEmpty()) {
        val asc = fechasUnicas.sorted()
        var temp = 1
        rachaMaxima = 1
        for (i in 1 until asc.size) {
            val diff = daysBetween(asc[i - 1], asc[i])
            if (diff == 1) {
                temp += 1
                if (temp > rachaMaxima) rachaMaxima = temp
            } else if (diff > 1) {
                temp = 1
            }
        }
        if (rachaActual > rachaMaxima) rachaMaxima = rachaActual
    }
    val mesActual = hoy.take(7)
    val mayor = maxOf(rachaActual, rachaMaxima)
    val proximo = HITOS_RACHA.firstOrNull { rachaActual < it.dias }
    return InfoRacha(
        rachaActual = rachaActual,
        rachaMaxima = rachaMaxima,
        anotadoHoy = anotadoHoy,
        diasAnotadosMes = fechasUnicas.count { it.startsWith(mesActual) },
        ultimoDiaAnotado = fechasUnicas.firstOrNull(),
        hitosAlcanzados = HITOS_RACHA.filter { mayor >= it.dias },
        proximoHito = proximo,
        diasParaProximoHito = proximo?.let { it.dias - rachaActual },
    )
}
