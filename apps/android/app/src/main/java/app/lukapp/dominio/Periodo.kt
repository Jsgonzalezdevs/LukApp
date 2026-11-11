package app.lukapp.dominio

/** Origen: `lib/periodo.ts` (`FrecuenciaPeriodo`). Strings y no enum para leer lo que guarde la web. */
object FrecuenciaPeriodo {
    const val SEMANAL = "semanal"
    const val QUINCENAL = "quincenal"
    const val QUINCENAS_MES = "quincenas-mes"
    const val MENSUAL = "mensual"
    const val PERSONALIZADO = "personalizado"
    const val TODO_EL_TIEMPO = "todo-el-tiempo"
}

/**
 * Origen: `lib/periodo.ts` (`ConfigPeriodo`).
 * `desfaseDiasMensual` solo aplica a mensual (0–27): con 4 el período va del 5 al 4.
 */
data class ConfigPeriodo(
    val frecuencia: String,
    val desfaseDiasMensual: Int = 0,
    val diasPersonalizados: Double? = null,
    val fechaAnclaPersonalizada: String? = null,
)

/** Origen: `lib/periodo.ts` (`PERIODO_POR_DEFECTO`). */
val PERIODO_POR_DEFECTO = ConfigPeriodo(FrecuenciaPeriodo.MENSUAL, 0)

/** Origen: `lib/periodo.ts` (`CLAVE_TODO_EL_TIEMPO`). */
const val CLAVE_TODO_EL_TIEMPO = "todo"

/** Origen: `lib/periodo.ts`. */
const val DIAS_PERSONALIZADOS_POR_DEFECTO = 14

/** Origen: `lib/periodo.ts`. */
const val FECHA_ANCLA_PERSONALIZADA_POR_DEFECTO = "2026-01-01"

// El mensual sin desfase es lo que existía antes del ajuste: debe dar la misma clave 'YYYY-MM'.
private fun esMensualPuro(c: ConfigPeriodo) = c.frecuencia == FrecuenciaPeriodo.MENSUAL && c.desfaseDiasMensual == 0

private fun diasPersonalizadosDe(c: ConfigPeriodo): Int =
    Math.round(c.diasPersonalizados ?: DIAS_PERSONALIZADOS_POR_DEFECTO.toDouble()).toInt().coerceIn(1, 90)

private fun fechaAnclaDe(c: ConfigPeriodo) = c.fechaAnclaPersonalizada ?: FECHA_ANCLA_PERSONALIZADA_POR_DEFECTO

private fun dos(n: Int) = n.toString().padStart(2, '0')

private fun diasEnMesDe(fecha: String): Int {
    val (y, m, _) = partesFecha(fecha)
    return fechaUtc(y, m + 1, 0).dayOfMonth
}

// Igual que la web, NO normaliza el día: puede armar '2026-02-31' y dejar que
// shiftDays lo desborde después. Normalizar aquí cambiaría el resultado.
private fun shiftMonthDate(fecha: String, deltaMeses: Int): String {
    val (y, m, d) = partesFecha(fecha)
    val absoluto = y * 12 + (m - 1) + deltaMeses
    val anio = Math.floorDiv(absoluto, 12)
    val indice = absoluto - anio * 12
    return "$anio-${dos(indice + 1)}-${dos(d)}"
}

private fun inicioSemanaDe(fecha: String): String {
    // getUTCDay: 0=domingo; ISO de java: 1=lunes..7=domingo.
    val diaSemana = deIso(fecha).dayOfWeek.value % 7
    val desdeElLunes = (diaSemana + 6) % 7
    return shiftDays(fecha, -desdeElLunes)
}

// Un lunes fijo cualquiera: sin ancla no se sabe si una semana es la primera o la segunda del par.
private const val EPOCA_QUINCENAL = "2024-01-01"

private fun inicioQuincenaFijaDe(fecha: String): String {
    val inicioSemana = inicioSemanaDe(fecha)
    val semanas = Math.floorDiv(daysBetween(EPOCA_QUINCENAL, inicioSemana), 7)
    // `%` de JS conserva el signo, como el de Kotlin: -1 % 2 = -1 ≠ 0.
    return if (semanas % 2 == 0) inicioSemana else shiftDays(inicioSemana, -7)
}

private fun inicioQuincenaCalendarioDe(fecha: String): String {
    val (y, m, d) = partesFecha(fecha)
    return "$y-${dos(m)}-${dos(if (d <= 15) 1 else 16)}"
}

private fun inicioMesConDesfaseDe(fecha: String, desfase: Int): String {
    val (y, m, d) = partesFecha(fecha)
    val diaCorte = 1 + desfase
    val inicioEsteMes = "$y-${dos(m)}-${dos(diaCorte)}"
    return if (d >= diaCorte) inicioEsteMes else shiftMonthDate(inicioEsteMes, -1)
}

/** Origen: `lib/periodo.ts` (`inicioDePeriodo`). Fecha en que empieza el período que contiene `fecha`. */
fun inicioDePeriodo(fecha: String, config: ConfigPeriodo): String = when (config.frecuencia) {
    FrecuenciaPeriodo.SEMANAL -> inicioSemanaDe(fecha)
    FrecuenciaPeriodo.QUINCENAL -> inicioQuincenaFijaDe(fecha)
    FrecuenciaPeriodo.QUINCENAS_MES -> inicioQuincenaCalendarioDe(fecha)
    FrecuenciaPeriodo.MENSUAL -> inicioMesConDesfaseDe(fecha, config.desfaseDiasMensual)
    FrecuenciaPeriodo.PERSONALIZADO -> {
        val ancla = fechaAnclaDe(config)
        val dias = diasPersonalizadosDe(config)
        shiftDays(ancla, Math.floorDiv(daysBetween(ancla, fecha), dias) * dias)
    }
    else -> CLAVE_TODO_EL_TIEMPO
}

/** Origen: `lib/periodo.ts` (`finDePeriodo`). `null` en «todo el tiempo». */
fun finDePeriodo(inicio: String, config: ConfigPeriodo): String? = when (config.frecuencia) {
    FrecuenciaPeriodo.SEMANAL -> shiftDays(inicio, 6)
    FrecuenciaPeriodo.QUINCENAL -> shiftDays(inicio, 13)
    FrecuenciaPeriodo.QUINCENAS_MES -> {
        val (y, m, d) = partesFecha(inicio)
        if (d == 1) "$y-${dos(m)}-15" else "$y-${dos(m)}-${dos(diasEnMesDe(inicio))}"
    }
    FrecuenciaPeriodo.MENSUAL -> shiftDays(shiftMonthDate(inicio, 1), -1)
    FrecuenciaPeriodo.PERSONALIZADO -> shiftDays(inicio, diasPersonalizadosDe(config) - 1)
    else -> null
}

/**
 * Origen: `lib/periodo.ts` (`claveDePeriodo`). Mensual puro → 'YYYY-MM' de siempre;
 * el resto → fecha de inicio, que ordena como string igual que cronológicamente.
 */
fun claveDePeriodo(fecha: String, config: ConfigPeriodo): String {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return CLAVE_TODO_EL_TIEMPO
    if (esMensualPuro(config)) return monthKey(fecha)
    return inicioDePeriodo(fecha, config)
}

/** Origen: `lib/periodo.ts` (`enElPeriodo`). */
fun enElPeriodo(fecha: String, clave: String, config: ConfigPeriodo): Boolean {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return true
    return claveDePeriodo(fecha, config) == clave
}

/** Origen: `lib/periodo.ts` (`diasDelPeriodo`). */
fun diasDelPeriodo(clave: String, config: ConfigPeriodo): Int? {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return null
    val inicio = if (esMensualPuro(config)) "$clave-01" else clave
    val fin = finDePeriodo(inicio, config) ?: return null
    return daysBetween(inicio, fin) + 1
}

/** Origen: `lib/periodo.ts` (`diasTranscurridosEnPeriodo`). Contando hoy; tope en el total del período. */
fun diasTranscurridosEnPeriodo(clave: String, hoy: String, config: ConfigPeriodo): Int? {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return null
    val inicio = if (esMensualPuro(config)) "$clave-01" else clave
    val total = diasDelPeriodo(clave, config) ?: return null
    if (hoy < inicio) return 0
    return (daysBetween(inicio, hoy) + 1).coerceAtLeast(0).coerceAtMost(total)
}

/** Origen: `lib/periodo.ts` (`etiquetaDePeriodo`). "julio 2026" o un rango de fechas. */
fun etiquetaDePeriodo(clave: String, config: ConfigPeriodo): String {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return "Todo el tiempo"
    if (esMensualPuro(config)) return monthKeyLabel(clave)
    val fin = finDePeriodo(clave, config) ?: return "Todo el tiempo"
    val (yIni, mIni, dIni) = partesFecha(clave)
    val (yFin, mFin, dFin) = partesFecha(fin)
    // Un mes con desfase no tiene un solo nombre de mes honesto: se muestra el rango.
    if (config.frecuencia == FrecuenciaPeriodo.MENSUAL) return "$dIni ${mesCorto(mIni)} – $dFin ${mesCorto(mFin)}"
    if (yIni == yFin && mIni == mFin) return "$dIni–$dFin ${mesCorto(mIni)}"
    return "$dIni ${mesCorto(mIni)} – $dFin ${mesCorto(mFin)}"
}

/** Origen: `lib/periodo.ts` (`periodoAdyacente`). */
fun periodoAdyacente(clave: String, delta: Int, config: ConfigPeriodo): String {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return clave
    if (esMensualPuro(config)) return shiftMonth(clave, delta)
    var cursor = clave
    repeat(Math.abs(delta)) {
        cursor = if (delta > 0) {
            inicioDePeriodo(shiftDays(finDePeriodo(cursor, config)!!, 1), config)
        } else {
            inicioDePeriodo(shiftDays(cursor, -1), config)
        }
    }
    return cursor
}
