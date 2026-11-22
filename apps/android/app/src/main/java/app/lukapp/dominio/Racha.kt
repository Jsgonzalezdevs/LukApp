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
 * Días que el equipo le sumó a una racha desde el superadmin (`BonoRacha` de la web).
 * Van pegados al día en que empezó esa racha: si se corta, el bono se va con ella.
 */
data class BonoRacha(val inicioRacha: String, val dias: Int)

/** El día en que empezó la racha viva contando solo lo anotado; sin racha viva, `hoy`. */
fun inicioDeRachaActual(fechasAnotadas: Collection<String>, hoy: String): String {
    val fechas = fechasAnotadas.toHashSet()
    val ayer = shiftDays(hoy, -1)
    if (hoy !in fechas && ayer !in fechas) return hoy
    var cursor = if (hoy in fechas) hoy else ayer
    while (shiftDays(cursor, -1) in fechas) cursor = shiftDays(cursor, -1)
    return cursor
}

/**
 * Origen: `lib/racha.ts` (`calcularRacha`). Si hoy aún no anotó pero ayer sí, la racha
 * sigue viva: no se penaliza antes de medianoche. Los bonos se suman a la racha que
 * empezó en su `inicioRacha`, sin contar como "anotado hoy" ni en los días del mes.
 */
fun calcularRacha(transacciones: List<Transaccion>, hoy: String, bonos: List<BonoRacha> = emptyList()): InfoRacha {
    fun bonoDe(inicio: String) = bonos.filter { it.inicioRacha == inicio }.sumOf { it.dias }

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
    rachaActual += bonoDe(inicioDeRachaActual(fechasUnicas, hoy))

    var rachaMaxima = rachaActual
    val asc = fechasUnicas.reversed()
    var inicioTramo = asc.firstOrNull() ?: hoy
    for (i in asc.indices) {
        if (i > 0 && daysBetween(asc[i - 1], asc[i]) != 1) inicioTramo = asc[i]
        val largo = daysBetween(inicioTramo, asc[i]) + 1 + bonoDe(inicioTramo)
        if (largo > rachaMaxima) rachaMaxima = largo
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
