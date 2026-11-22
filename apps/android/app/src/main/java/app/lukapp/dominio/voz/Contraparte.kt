package app.lukapp.dominio.voz

/*
 * Con quién fue un movimiento, sacado de la descripción del banco.
 * Origen: src/features/lukapp/lib/contraparte.ts
 *
 * En una cuenta de billetera «transferencia» se traga casi todo el extracto, y
 * un desglose que dice «Transferencia: $2.000.000» no sirve más que el «Otros»
 * que reemplazó. La pregunta que vale la pena responder es *quién*.
 */

/** Formas en que billeteras y bancos colombianos nombran a la contraparte. */
private val PATRONES: List<Regex> = listOf(
    js("""^envio con bre-?b a:\s*(.+)$""", "i"),
    js("""^recibi por bre-?b de:\s*(.+)$""", "i"),
    js("""^pago en qr bre-?b:\s*(.+)$""", "i"),
    js("""^transferencia (?:a|de)\s+(.+)$""", "i"),
    js("""^pago recibido de\s+(.+)$""", "i"),
    js("""^(?:de|para)\s+(.+)$""", "i"),
)

/** Ruido que los bancos pegan al final: documentos, oficinas, nombres de app. */
private val COLA = js("""\s+(?:\d[\d.,-]*|app\s+\w+|s\.?a\.?s?\.?|ltda\.?)\s*$""", "i")

private val RE_ESPACIOS_CP = js("""\s+""")

private fun titulo(texto: String): String =
    texto.lowercase()
        .split(RE_ESPACIOS_CP)
        .joinToString(" ") { p -> if (p.length > 2) p.substring(0, 1).uppercase() + p.substring(1) else p }

/* BRE-B puede ocupar el lugar del nombre cuando el banco no informa al
   destinatario. Esa etiqueta describe el riel, no una persona. */
private val ETIQUETAS_SIN_PERSONA = js("""^(?:llave )?otra entidad(?: redeban)?(?: bre-?b)?$""", "i")

/**
 * La contraparte como nombre para mostrar, o null si la descripción no nombra
 * a nadie. Null y no la descripción cruda: agrupar «Compra paquete» con
 * «Rendimientos financieros» recrearía el montón sin sentido que esto evita.
 */
fun extraerContraparte(descripcion: String): String? {
    val limpia = descripcion.trimJs()
    if (limpia.isEmpty()) return null

    for (patron in PATRONES) {
        val m = patron.find(limpia) ?: continue
        val bruto = m.groupValues[1].reemplazarPrimero(COLA, "").trimJs()
        // Una palabra suelta que no es nombre (un banco, un producto) no dice nada.
        if (bruto.length < 3) return null
        if (ETIQUETAS_SIN_PERSONA.containsMatchIn(bruto)) return null
        return titulo(bruto)
    }
    return null
}
