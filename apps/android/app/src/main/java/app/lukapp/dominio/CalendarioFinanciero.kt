package app.lukapp.dominio

/** Origen: `lib/calendarioFinanciero.ts` (`EventoFinanciero`). `impacto`: entrada o salida. */
data class EventoFinanciero(
    val id: String,
    val fecha: String?,
    val periodo: String?,
    val montoCop: Long?,
    val impacto: String,
    val concepto: String,
    val estado: String,
    val precision: String,
)

/**
 * Origen: `lib/calendarioFinanciero.ts` (`eventosDelContexto`). Solo presenta: no recalcula
 * importes ni descubre obligaciones. Orden por fecha (sin fecha al final) y luego por id,
 * igual que `localeCompare` en la web para ids ASCII.
 */
fun eventosDelContexto(contexto: ContextoFinanciero, hoy: String): List<EventoFinanciero> {
    fun estado(fecha: String?) = when {
        fecha == null -> "desconocido"
        fecha < hoy -> "vencido"
        fecha == hoy -> "hoy"
        else -> "proximo"
    }
    val salidas = contexto.obligaciones.map { o ->
        EventoFinanciero(
            id = o.id, fecha = o.fecha, periodo = o.periodo, montoCop = o.montoCop, impacto = "salida",
            concepto = o.concepto, estado = estado(o.fecha),
            precision = if (o.fecha == null) "periodo" else if (o.certeza == "estimada") "estimada" else "exacta",
        )
    }
    val entradas = contexto.entradasFuturas.map { e ->
        EventoFinanciero(
            id = e.id, fecha = e.fecha, periodo = e.periodo, montoCop = e.montoCop, impacto = "entrada",
            concepto = e.concepto, estado = estado(e.fecha),
            precision = if (e.fecha == null) "desconocida" else if (e.certeza == "estimada") "estimada" else "exacta",
        )
    }
    return (salidas + entradas).sortedWith(compareBy<EventoFinanciero> { it.fecha ?: "9999-99-99" }.thenBy { it.id })
}
