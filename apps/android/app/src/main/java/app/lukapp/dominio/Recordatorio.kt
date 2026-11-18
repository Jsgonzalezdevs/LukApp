package app.lukapp.dominio

import java.time.ZonedDateTime

/** Hora por defecto del aviso, como `useRecordatorioRacha`. */
const val HORA_RECORDATORIO = "20:30"

/** `HH:mm` válido (00:00–23:59). El selector de la web solo produce esto; una clave pisada a mano no debe tumbar nada. */
fun horaDeRecordatorio(texto: String?): Pair<Int, Int> {
    val m = Regex("^([01]?\\d|2[0-3]):([0-5]\\d)$").matchEntire(texto?.trim().orEmpty())
        ?: return HORA_RECORDATORIO.split(":").let { it[0].toInt() to it[1].toInt() }
    return m.groupValues[1].toInt() to m.groupValues[2].toInt()
}

/** La próxima vez que toca avisar: hoy a esa hora si todavía no pasó, y si no, mañana. Siempre estrictamente después de `ahora`. */
fun proximoAviso(hora: String?, ahora: ZonedDateTime): ZonedDateTime {
    val (h, m) = horaDeRecordatorio(hora)
    val hoy = ahora.withHour(h).withMinute(m).withSecond(0).withNano(0)
    return if (hoy.isAfter(ahora)) hoy else hoy.plusDays(1)
}

/**
 * Se avisa solo si el recordatorio está activo y hoy todavía no se anotó nada: es justo lo que promete la
 * descripción («notificación si aún no has anotado gastos hoy»). `anotadoEn` es el último día en que se vio anotado.
 */
fun debeAvisar(activo: Boolean, anotadoEn: String?, hoy: String): Boolean = activo && anotadoEn != hoy
