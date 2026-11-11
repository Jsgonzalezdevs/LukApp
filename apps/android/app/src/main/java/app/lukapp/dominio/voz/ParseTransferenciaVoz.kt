package app.lukapp.dominio.voz

import java.time.LocalDate

/*
 * Origen: src/features/lukapp/lib/parseTransferenciaVoz.ts
 */

data class TransferenciaPorVoz(
    val origenId: String,
    val destinoId: String,
    val montoCop: Long,
    val raw: String,
)

private val RE_NO_ALFANUM_TV = js("""[^a-z0-9\s]""", "g")
private val RE_ESPACIOS_TV = js("""\s+""", "g")

private fun textoPlano(texto: String): String =
    normalizeWord(texto).reemplazarTodos(RE_NO_ALFANUM_TV, " ").reemplazarTodos(RE_ESPACIOS_TV, " ").trimJs()

// Whisper a veces escribe los bancos por fonética. Son alias estrechos y solo
// se usan dentro de una frase con dos cuentas, nunca para clasificar un gasto
// normal por la palabra «Colombia» aislada.
private fun patronCuenta(cuenta: CuentaConocida): String {
    val nombre = RegexJs.escapar(textoPlano(cuenta.nombre))
    if (nombre == "nequi") return "(?:nequi|neki)"
    if (nombre == "bancolombia") return "(?:bancolombia|colombia)"
    return nombre
}

private fun cuentaTras(texto: String, preposiciones: String, cuentas: List<CuentaConocida>): CuentaConocida? {
    for (cuenta in cuentas.sortedByDescending { it.nombre.length }) {
        val nombre = patronCuenta(cuenta)
        if (js("""\b(?:$preposiciones)\s+(?:la\s+|el\s+)?$nombre\b""").containsMatchIn(texto)) return cuenta
    }
    return null
}

private val RE_DICE_TRANSFERIR = js("""\b(?:transfier(?:e|a|o)?|transfer(?:i|e|ir)|pasa(?:r|me)?|mueve|envia|consigna)\b""")
private val RE_ME_DE = js("""^me de\b""")

/** Reconoce «transfiere 50 mil de Nequi a Bancolombia» sin tocar saldos aún. */
fun parseTransferenciaVoz(
    raw: String,
    cuentas: List<CuentaConocida>,
    hoy: LocalDate = hoyEnBogota(),
): TransferenciaPorVoz? {
    val plano = textoPlano(raw)
    val diceTransferir = RE_DICE_TRANSFERIR.containsMatchIn(plano)
    val menciones = cuentas.filter { js("""\b${patronCuenta(it)}\b""").containsMatchIn(plano) }
    // «me de Neki o Colombia» es la degradación fonética observada de «me
    // transferí de Nequi a Bancolombia». Exigir dos cuentas evita convertir
    // una transcripción corta o un gasto ordinario en una transferencia.
    val transferenciaDegradada = RE_ME_DE.containsMatchIn(plano) && menciones.size >= 2
    if (!diceTransferir && !transferenciaDegradada) return null

    val origen = cuentaTras(plano, "de|desde", cuentas) ?: if (transferenciaDegradada) menciones[0] else null
    val destino = cuentaTras(plano, "a|hacia|para|o", cuentas) ?: if (transferenciaDegradada) menciones[1] else null
    val monto = parseTransaction(raw, cuentas, hoy = hoy).amount
    if (origen == null || destino == null || origen.id == destino.id || monto == null || monto <= 0) return null

    return TransferenciaPorVoz(origen.id, destino.id, monto, raw)
}
