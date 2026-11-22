package app.lukapp.dominio

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Origen: `lib/festivosColombia.ts` (`calcularDomingoPascua`). Algoritmo anónimo
 * de Meeus/Jones/Butcher.
 */
fun calcularDomingoPascua(anio: Int): LocalDate {
    val a = anio % 19
    val b = Math.floorDiv(anio, 100)
    val c = anio % 100
    val d = Math.floorDiv(b, 4)
    val e = b % 4
    val f = Math.floorDiv(b + 8, 25)
    val g = Math.floorDiv(b - f + 1, 3)
    val h = (19 * a + b - d - g + 15) % 30
    val i = Math.floorDiv(c, 4)
    val k = c % 4
    val l = (32 + 2 * e + 2 * i - h - k) % 7
    val m = Math.floorDiv(a + 11 * h + 22 * l, 451)
    val mes = Math.floorDiv(h + l - 7 * m + 114, 31)
    val dia = ((h + l - 7 * m + 114) % 31) + 1
    return fechaUtc(anio, mes, dia)
}

// Ley Emiliani: cualquier día distinto de lunes se corre al lunes siguiente.
private fun trasladarAlLunes(fecha: LocalDate): LocalDate {
    if (fecha.dayOfWeek == DayOfWeek.MONDAY) return fecha
    val diaSemana = fecha.dayOfWeek.value % 7 // 0 = domingo, como getUTCDay
    val hastaLunes = if (diaSemana == 0) 1 else 8 - diaSemana
    return fecha.plusDays(hastaLunes.toLong())
}

/** Origen: `lib/festivosColombia.ts` (`obtenerFestivosColombia`). Festivos oficiales 'YYYY-MM-DD' ordenados. */
fun obtenerFestivosColombia(anio: Int): List<String> {
    val fijos = listOf(
        fechaUtc(anio, 1, 1), fechaUtc(anio, 5, 1), fechaUtc(anio, 7, 20),
        fechaUtc(anio, 8, 7), fechaUtc(anio, 12, 8), fechaUtc(anio, 12, 25),
    )
    val emiliani = listOf(
        fechaUtc(anio, 1, 6), fechaUtc(anio, 3, 19), fechaUtc(anio, 6, 29), fechaUtc(anio, 8, 15),
        fechaUtc(anio, 10, 12), fechaUtc(anio, 11, 1), fechaUtc(anio, 11, 11),
    ).map(::trasladarAlLunes)
    val pascua = calcularDomingoPascua(anio)
    val dePascua = listOf(
        pascua.minusDays(3), // Jueves Santo
        pascua.minusDays(2), // Viernes Santo
        trasladarAlLunes(pascua.plusDays(43)), // Ascensión
        trasladarAlLunes(pascua.plusDays(64)), // Corpus Christi
        trasladarAlLunes(pascua.plusDays(71)), // Sagrado Corazón
    )
    return (fijos + emiliani + dePascua).map { it.toString() }.sorted()
}

/** Origen: `lib/festivosColombia.ts` (`esDiaHabilColombia`). Ni sábado, ni domingo, ni festivo. */
fun esDiaHabilColombia(fechaIso: String): Boolean {
    val (a, _, _) = partesFecha(fechaIso)
    val fecha = deIso(fechaIso)
    if (fecha.dayOfWeek == DayOfWeek.SATURDAY || fecha.dayOfWeek == DayOfWeek.SUNDAY) return false
    return fechaIso !in obtenerFestivosColombia(a)
}

/** Origen: `lib/festivosColombia.ts` (`calcularFechaPagoColombia`). */
object CortePago {
    const val QUINCENA_1 = "quincena_1"
    const val QUINCENA_2 = "quincena_2"
    const val FIN_MES = "fin_mes"
}

/**
 * Origen: `lib/festivosColombia.ts` (`calcularFechaPagoColombia`). Si el corte cae en
 * fin de semana o festivo se retrocede al hábil anterior, como hacen las nóminas.
 */
fun calcularFechaPagoColombia(anio: Int, mes: Int, corte: String, ajustarAHabil: Boolean = true): String {
    val diaObjetivo = if (corte == CortePago.QUINCENA_1) 15 else fechaUtc(anio, mes + 1, 0).dayOfMonth
    var fecha = fechaUtc(anio, mes, diaObjetivo)
    if (ajustarAHabil) {
        while (!esDiaHabilColombia(fecha.toString())) fecha = fecha.minusDays(1)
    }
    return fecha.toString()
}
