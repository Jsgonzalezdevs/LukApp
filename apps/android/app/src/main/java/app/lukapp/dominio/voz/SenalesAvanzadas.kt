package app.lukapp.dominio.voz

/*
 * Solo la detección de recurrencia, que es lo que usa el intérprete.
 * Origen: src/features/lukapp/lib/senalesAvanzadas.ts
 */

data class SenalRecurrencia(
    /** 'diario' | 'semanal' | 'mensual' | 'anual' | 'ninguno' */
    val patron: String,
    val confianza: Double,
)

private val RE_DIARIO = js("""diario|todos los d[ií]as|cada d[ií]a|d[ií]a a d[ií]a""")
private val RE_SEMANAL = js("""semanal|cada semana|todos los.*d[ií]as?|por semana""")
private val RE_MENSUAL = js("""mensual|cada mes|todos los meses|por mes""")
private val RE_ANUAL = js("""anual|cada a[ñn]o|todos los a[ñn]os|por a[ñn]o""")

fun detectarRecurrencia(texto: String): SenalRecurrencia {
    val norm = texto.lowercase()
    return when {
        RE_DIARIO.containsMatchIn(norm) -> SenalRecurrencia("diario", 0.8)
        RE_SEMANAL.containsMatchIn(norm) -> SenalRecurrencia("semanal", 0.75)
        RE_MENSUAL.containsMatchIn(norm) -> SenalRecurrencia("mensual", 0.9)
        RE_ANUAL.containsMatchIn(norm) -> SenalRecurrencia("anual", 0.85)
        else -> SenalRecurrencia("ninguno", 0.0)
    }
}
