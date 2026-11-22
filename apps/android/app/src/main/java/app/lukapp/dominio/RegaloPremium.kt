package app.lukapp.dominio

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * El Premium de cortesía que el equipo le dio a alguien y que esa persona todavía
 * no ha visto celebrado (lib/regaloPremium.ts). Lo calcula el servidor; la app solo lo pinta.
 */
data class RegaloPremium(val id: Long, val dias: Int, val venceEn: String)

private val FECHA_LARGA: DateTimeFormatter = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale.forLanguageTag("es-CO"))

private fun instante(texto: String): OffsetDateTime? = try { OffsetDateTime.parse(texto) } catch (_: DateTimeParseException) { null }

/** Un entero exacto y positivo: `7.5` o `"7"` no cuentan, como en `Number.isSafeInteger` de la web. */
private fun enteroPositivo(valor: JsonPrimitive?): Long? {
    if (valor == null || valor.isString) return null
    val numero = valor.doubleOrNull ?: return null
    if (numero <= 0 || numero != Math.floor(numero) || numero > 9_007_199_254_740_991.0) return null
    return numero.toLong()
}

/**
 * Lo que llega de `GET /api/mi-plan/regalo-premium`, validado: un cuerpo raro no debe
 * abrir un pop-up vacío ni con "0 días", así que cualquier duda devuelve null.
 */
fun leerRegaloPremium(texto: String): RegaloPremium? {
    val cuerpo = runCatching { Json.parseToJsonElement(texto) as? JsonObject }.getOrNull() ?: return null
    val regalo = cuerpo["regalo"] as? JsonObject ?: return null
    val id = enteroPositivo(regalo["id"] as? JsonPrimitive) ?: return null
    val dias = enteroPositivo(regalo["dias"] as? JsonPrimitive)?.takeIf { it <= Int.MAX_VALUE } ?: return null
    val vence = (regalo["venceEn"] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull ?: return null
    if (instante(vence) == null) return null
    return RegaloPremium(id, dias.toInt(), vence)
}

/** "1 día", "30 días": el número va aparte en la tarjeta, por eso solo la palabra. */
fun palabraDias(dias: Int): String = if (dias == 1) "día" else "días"

/** "22 de diciembre de 2026", en hora de Bogotá: el panel guarda el vencimiento a las 23:59 de allá. */
fun fechaVencimientoRegalo(venceEn: String): String =
    instante(venceEn)?.atZoneSameInstant(ZONA_BOGOTA)?.format(FECHA_LARGA) ?: venceEn
