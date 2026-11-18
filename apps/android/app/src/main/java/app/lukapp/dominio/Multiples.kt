package app.lukapp.dominio

import app.lukapp.dominio.voz.ParsedTransaction

/** Un movimiento de un dictado múltiple listo para guardar (el `ConfirmDraft` que arma `MultiCapturaModal.tsx`). */
data class MovimientoMultiple(
    val kind: String, val amountCop: Long, val category: String, val description: String,
    val cuentaId: String?, val occurredOn: String?, val rawTranscript: String,
)

/**
 * Origen: `MultiCapturaModal.tsx` (`guardarTodos`). Sin descripción se guarda el texto dicho; sin cuenta, la favorita;
 * sin monto, $0 (lo detectó el intérprete pero no se pudo leer la cifra, y así se ve en la lista).
 */
fun movimientosDeMultiples(items: List<ParsedTransaction>, cuentaPorDefecto: String?): List<MovimientoMultiple> =
    items.map {
        MovimientoMultiple(
            it.kind, it.amount ?: 0L, it.category, it.description.ifEmpty { it.raw },
            it.cuentaId ?: cuentaPorDefecto, it.dateOverride?.ifEmpty { null }, it.raw,
        )
    }

/** Origen: `MultiCapturaModal.tsx`. «Total a registrar»: lo que sale y lo que entra, cada uno aparte. */
fun totalesMultiples(items: List<ParsedTransaction>): Pair<Long, Long> =
    items.filter { it.kind == "gasto" }.sumOf { it.amount ?: 0L } to items.filter { it.kind == "ingreso" }.sumOf { it.amount ?: 0L }
