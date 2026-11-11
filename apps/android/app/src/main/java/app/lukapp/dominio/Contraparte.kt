package app.lukapp.dominio

import java.util.Locale

/** Clase de espacios equivalente a `\s` de JS (el `\s` de Java solo cubre ASCII). */
internal const val ESPACIO_JS = "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]"

private val IGNORA = setOf(RegexOption.IGNORE_CASE)

// Formas en que billeteras y bancos colombianos nombran a la contraparte.
private val PATRONES = listOf(
    Regex("^envio con bre-?b a:$ESPACIO_JS*(.+)$", IGNORA),
    Regex("^recibi por bre-?b de:$ESPACIO_JS*(.+)$", IGNORA),
    Regex("^pago en qr bre-?b:$ESPACIO_JS*(.+)$", IGNORA),
    Regex("^transferencia (?:a|de)$ESPACIO_JS+(.+)$", IGNORA),
    Regex("^pago recibido de$ESPACIO_JS+(.+)$", IGNORA),
    Regex("^(?:de|para)$ESPACIO_JS+(.+)$", IGNORA),
)

// Ruido que el banco agrega al final: documentos, códigos de oficina, apps.
private val COLA = Regex("$ESPACIO_JS+(?:\\d[\\d.,-]*|app$ESPACIO_JS+[A-Za-z0-9_]+|s\\.?a\\.?s?\\.?|ltda\\.?)$ESPACIO_JS*$", IGNORA)

// BRE-B a veces ocupa el lugar del nombre: es el riel, no una persona.
private val ETIQUETAS_SIN_PERSONA = Regex("^(?:llave )?otra entidad(?: redeban)?(?: bre-?b)?$", IGNORA)

private val ESPACIOS = Regex("$ESPACIO_JS+")

private fun titulo(texto: String): String =
    texto.lowercase(Locale.ROOT).split(ESPACIOS)
        .joinToString(" ") { p -> if (p.length > 2) p.substring(0, 1).uppercase(Locale.ROOT) + p.substring(1) else p }

private fun recortarJs(texto: String): String = texto.trim { Regex(ESPACIO_JS).matches(it.toString()) }

/**
 * Origen: `lib/contraparte.ts` (`extraerContraparte`). null cuando la descripción no
 * nombra a nadie: agrupar todo eso bajo un solo «anónimo» recrearía el «Otros» inútil.
 */
fun extraerContraparte(descripcion: String): String? {
    val limpia = recortarJs(descripcion)
    if (limpia.isEmpty()) return null
    for (patron in PATRONES) {
        val m = patron.find(limpia) ?: continue
        val bruto = recortarJs(COLA.replaceFirst(m.groupValues[1], ""))
        if (bruto.length < 3) return null
        if (ETIQUETAS_SIN_PERSONA.containsMatchIn(bruto)) return null
        return titulo(bruto)
    }
    return null
}
