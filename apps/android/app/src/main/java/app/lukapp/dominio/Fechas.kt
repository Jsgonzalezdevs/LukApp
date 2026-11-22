package app.lukapp.dominio

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

// Todas las fechas son días de Bogotá y no instantes UTC: la lista agrupa por día
// y con UTC todo lo dictado después de las 7 p. m. caería en el día siguiente.
val ZONA_BOGOTA: ZoneId = ZoneId.of("America/Bogota")

private val MESES_CORTOS = listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
private val MESES_LARGOS = listOf(
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)

/** Origen: `lib/localDate.ts` (`MONTHS_SHORT`). Mes 1..12 → "ene". */
fun mesCorto(mes: Int): String = MESES_CORTOS[mes - 1]

/** Origen: `lib/localDate.ts` (`MONTHS_LONG`). Mes 1..12 → "enero". */
fun mesLargo(mes: Int): String = MESES_LARGOS[mes - 1]

/**
 * Equivale a `new Date(Date.UTC(y, m - 1, d))` de JS: mes y día fuera de rango se
 * desbordan en vez de fallar (`2026-02-31` → `2026-03-03`, día 0 → último del mes
 * anterior). Varias reglas de la web dependen de esa normalización.
 */
fun fechaUtc(anio: Int, mes: Int, dia: Int): LocalDate =
    LocalDate.of(anio, 1, 1).plusMonths((mes - 1).toLong()).plusDays((dia - 1).toLong())

/** Partes numéricas de un 'YYYY-MM-DD', como `split('-').map(Number)`. */
internal fun partesFecha(iso: String): Triple<Int, Int, Int> {
    val p = iso.split("-")
    return Triple(p[0].toInt(), p.getOrNull(1)?.toInt() ?: 0, p.getOrNull(2)?.toInt() ?: 0)
}

/** Interpreta un 'YYYY-MM-DD' con la misma normalización de `Date.UTC`. */
fun deIso(iso: String): LocalDate {
    val (y, m, d) = partesFecha(iso)
    return fechaUtc(y, m, d)
}

/** Origen: `lib/localDate.ts` (`bogotaDate`). Día calendario de Bogotá 'YYYY-MM-DD'. */
fun bogotaDate(ahora: Instant = Instant.now()): String = ahora.atZone(ZONA_BOGOTA).toLocalDate().toString()

/** Origen: `lib/localDate.ts` (`bogotaHora`). Hora 0..23 en Bogotá. */
fun bogotaHora(ahora: Instant = Instant.now()): Int = ahora.atZone(ZONA_BOGOTA).hour % 24

/** Origen: `lib/localDate.ts` (`ASESOR_DESDE`). */
const val ASESOR_DESDE = 7

/** Origen: `lib/localDate.ts` (`ASESOR_HASTA`). */
const val ASESOR_HASTA = 21

/**
 * Origen: `lib/localDate.ts` (`asesorEnHorario`). El servidor duerme de noche para
 * no gastar la cuota gratuita; el límite superior es inclusivo.
 */
fun asesorEnHorario(ahora: Instant = Instant.now()): Boolean = bogotaHora(ahora) in ASESOR_DESDE..ASESOR_HASTA

/** Origen: `lib/localDate.ts` (`etiquetaConexion`). Estados: "despertando", "en-linea", "local". */
fun etiquetaConexion(estado: String, ahora: Instant = Instant.now()): String {
    if (estado == "en-linea") return "En línea"
    val enHorario = asesorEnHorario(ahora)
    if (estado == "despertando") return if (enHorario) "Conectando…" else "Despertando… puede tardar un momento"
    return "IA no disponible"
}

/** Origen: `lib/localDate.ts` (`shiftDays`). */
fun shiftDays(isoDate: String, dias: Int): String = deIso(isoDate).plusDays(dias.toLong()).toString()

/** Origen: `lib/localDate.ts` (`daysBetween`). Negativo cuando `hasta` es anterior. */
fun daysBetween(desde: String, hasta: String): Int =
    (deIso(hasta).toEpochDay() - deIso(desde).toEpochDay()).toInt()

/** Origen: `lib/localDate.ts` (`dayLabel`). "Hoy" / "Ayer" / "28 jul". */
fun dayLabel(isoDate: String, hoy: String = bogotaDate()): String {
    if (isoDate == hoy) return "Hoy"
    if (isoDate == shiftDays(hoy, -1)) return "Ayer"
    val (_, m, d) = partesFecha(isoDate)
    return "$d ${mesCorto(m)}"
}

/** Origen: `lib/localDate.ts` (`monthLabel`). "julio 2026". */
fun monthLabel(isoDate: String): String {
    val (y, m, _) = partesFecha(isoDate)
    return "${mesLargo(m)} $y"
}

/** Origen: `lib/localDate.ts` (`monthKey`). */
fun monthKey(isoDate: String): String = isoDate.take(7)

/** Origen: `lib/localDate.ts` (`shiftMonth`). Mueve una clave 'YYYY-MM'. */
fun shiftMonth(mes: String, delta: Int): String {
    val (y, m, _) = partesFecha(mes)
    val absoluto = y * 12 + (m - 1) + delta
    val anio = Math.floorDiv(absoluto, 12)
    val indice = absoluto - anio * 12
    return "$anio-${(indice + 1).toString().padStart(2, '0')}"
}

/** Origen: `lib/localDate.ts` (`monthKeyLabel`). */
fun monthKeyLabel(mes: String): String = monthLabel(mes)

/** Origen: `lib/localDate.ts` (`monthKeyShort`). */
fun monthKeyShort(mes: String): String = mesCorto(mes.split("-")[1].toInt())

/** «17 nov 2026»: el día completo, para campos de fecha. */
fun fechaLarga(isoDate: String): String = partesFecha(isoDate).let { (y, m, d) -> "$d ${mesCorto(m)} $y" }
