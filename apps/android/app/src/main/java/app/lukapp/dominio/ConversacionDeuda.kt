package app.lukapp.dominio

import app.lukapp.dominio.voz.js
import app.lukapp.dominio.voz.reemplazarPrimero
import app.lukapp.dominio.voz.trimJs
import java.text.Normalizer
import kotlin.math.abs

/** Origen: `conversacionDeuda.ts` (`CampoDeuda`). El dato que la conversación todavía espera. */
enum class CampoDeuda { DEUDA, AHORROS, RESERVA }

/**
 * Origen: `conversacionDeuda.ts` (`ConversacionDeuda`). Lo que va recordando la consulta guiada
 * «¿pago la deuda con mis ahorros?» entre un turno y el siguiente. Cada campo ausente es `undefined` en la web.
 */
data class ConversacionDeuda(
    val deuda: Long? = null,
    val ahorros: Long? = null,
    val reserva: Long? = null,
    val pendiente: CampoDeuda? = null,
    val ultimoCampo: CampoDeuda? = null,
    val ingresosInciertos: Boolean? = null,
)

/** Origen: `conversacionDeuda.ts` (retorno de `continuarDeuda`). `estado` nulo = la conversación terminó o no empezó. */
data class ResultadoDeuda(val estado: ConversacionDeuda?, val respuesta: String?)

/**
 * `valor.toLocaleString('es-CO')` de un entero: miles con punto, sin importar el locale del
 * teléfono. Lo usa todo el motor local del asesor.
 */
internal fun milesEsCo(valor: Long): String = (if (valor < 0) "-" else "") + formatAmountInput(valor)

private fun valorDe(estado: ConversacionDeuda, campo: CampoDeuda): Long? = when (campo) {
    CampoDeuda.DEUDA -> estado.deuda
    CampoDeuda.AHORROS -> estado.ahorros
    CampoDeuda.RESERVA -> estado.reserva
}

private fun conValor(estado: ConversacionDeuda, campo: CampoDeuda, valor: Long): ConversacionDeuda = when (campo) {
    CampoDeuda.DEUDA -> estado.copy(deuda = valor)
    CampoDeuda.AHORROS -> estado.copy(ahorros = valor)
    CampoDeuda.RESERVA -> estado.copy(reserva = valor)
}

private val PREGUNTAS: Map<CampoDeuda, String> = mapOf(
    CampoDeuda.DEUDA to "¿Cuál es el saldo total pendiente de esa deuda? Dime el saldo, no la cuota mensual.",
    CampoDeuda.AHORROS to "¿Cuánto tienes ahorrado en total para esta decisión?",
    CampoDeuda.RESERVA to "¿Cuánto de esos ahorros necesitas conservar para tus gastos básicos y próximos compromisos? Ese será el dinero que excluyamos del pago.",
)

// Aquí se pasa a minúsculas ANTES de quitar tildes (al revés que alcanceAsesor): así lo hace la web.
private fun normalizarImportes(texto: String): String =
    Normalizer.normalize(texto.lowercase(), Normalizer.Form.NFD)
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .trimJs()

private val RE_MONTO_COMPLETO = js("""^\$?\s*(\d+(?:[.,]\d+)*)\s*(mil|millon|millones)?\s*(?:pesos|cop)?$""")
private val RE_CIFRA_AGRUPADA = js("""^\d{1,3}(?:[.,]\d{3})+$""")
private val RE_PUNTO_O_COMA = js("""[.,]""")

private const val MAX_SEGURO = 9_007_199_254_740_991.0

/**
 * Origen: `conversacionDeuda.ts` (`leerMontoConversacion`). Aceptar únicamente un monto
 * completo evita confundir fechas, porcentajes o varios valores con la respuesta a la
 * pregunta pendiente.
 */
fun leerMontoConversacion(texto: String): Long? {
    val coincidencia = RE_MONTO_COMPLETO.find(normalizarImportes(texto)) ?: return null
    val cifra = coincidencia.groupValues[1]
    val agrupado = RE_CIFRA_AGRUPADA.containsMatchIn(cifra)
    val numero = (if (agrupado) cifra.replace(RE_PUNTO_O_COMA, "") else cifra.replaceFirst(',', '.')).toDoubleOrNull() ?: return null
    val sufijo = coincidencia.groups[2]?.value
    val factor = if (sufijo == "mil") 1000.0 else if (sufijo != null && sufijo.isNotEmpty()) 1_000_000.0 else 1.0
    val monto = numero * factor
    // `Number.isSafeInteger`: entero y dentro de ±(2^53 − 1).
    return if (monto == Math.floor(monto) && abs(monto) <= MAX_SEGURO && monto >= 0) monto.toLong() else null
}

private val RE_REGISTRO_EXPLICITO = js("""^(?:(?:hoy|ayer|ya)\s+)?(?:registre|registra|registrar|anota|anotar|gaste|pague|compre|recibi|me pagaron)\b""")

/** Origen: `conversacionDeuda.ts` (`esRegistroExplicito`). */
fun esRegistroExplicito(texto: String): Boolean = RE_REGISTRO_EXPLICITO.containsMatchIn(normalizarNombre(texto))

private val RE_TEMA_DEUDA = js("""\b(deuda|tarjeta|credito|prestamo)\b""")
private val RE_PIDE_AYUDA_DEUDA = js("""\b(recomiend\w*|consejo|conviene|pagar|pago|debo|deuda|ayud\w*)\b""")
private val RE_NO_ES_DEUDA = js("""\b(cuanto gaste|cuanto he gastado|resumen|saldo de mis cuentas)\b""")

/** Origen: `conversacionDeuda.ts` (`esConsultaDeuda`). */
fun esConsultaDeuda(texto: String): Boolean {
    val norm = normalizarNombre(texto)
    return RE_TEMA_DEUDA.containsMatchIn(norm) &&
        RE_PIDE_AYUDA_DEUDA.containsMatchIn(norm) &&
        !esRegistroExplicito(texto) && !RE_NO_ES_DEUDA.containsMatchIn(norm)
}

private val RE_SALIDA_CONVERSACION = js("""^(cancelar|salir|otro tema|dime mi resumen|resumen|dime mi saldo|cuanto he gastado)[?.!]*$""")
private val RE_INGRESOS_INCIERTOS = js("""\b(contrato|desempleo|sin trabajo)\b""")
private val RE_MENCIONA_CAJITA = js("""\b(cajita|ahorro|ahorros|cuenta)\b""")
private val RE_CORRECCION = js("""^(?:no\s*[,;]?\s*)?(?:perdon\s*[,;]?\s*(?:eran?|son)?|eran?|corrijo|me equivoque\s*[,;]?\s*(?:eran?|son)?)\s*:?\s*(.+)$""")
private val RE_COLA_PUNTUACION = js("""[.!]$""")
private val RE_ENVOLTURA_RESPUESTA = js("""^(?:son|es|serian|seria|en total son|en total es)\s+""")

// Las etiquetas con las que la persona nombra cada dato. Las tres comparten la misma forma de captura.
private val ETIQUETAS_CAMPO: List<Pair<CampoDeuda, String>> = listOf(
    CampoDeuda.DEUDA to """(?:(?:el |mi |la )?(?:deuda|saldo(?: total)?(?: pendiente)?)|debo)""",
    CampoDeuda.AHORROS to """(?:(?:mis |los )?ahorros|tengo ahorrados?|he ahorrado)""",
    CampoDeuda.RESERVA to """(?:(?:mi |la )?reserva|necesito conservar|quiero conservar|necesito guardar)""",
)
private val RE_DATO_ETIQUETADO: List<Pair<CampoDeuda, Regex>> = ETIQUETAS_CAMPO.map { (campo, etiqueta) ->
    campo to js("""(?:^|[,;\n]\s*)""" + etiqueta + """\s*(?:es|son|de|:)?\s*(.+?)(?=[,;]\s*[a-z]|$)""")
}

private fun cop(valor: Long): String = "\$" + milesEsCo(valor)

/**
 * Origen: `conversacionDeuda.ts` (`continuarDeuda`). Conversación guiada: pregunta de a un
 * dato (deuda, ahorros, reserva) y al final compara sin mover dinero ni calcular intereses.
 */
fun continuarDeuda(
    texto: String,
    anterior: ConversacionDeuda? = null,
    cajitas: List<Cajita> = emptyList(),
    balances: Map<String, Long> = emptyMap(),
): ResultadoDeuda {
    val norm = normalizarNombre(texto)
    if (RE_SALIDA_CONVERSACION.containsMatchIn(norm) || esRegistroExplicito(texto)) {
        return ResultadoDeuda(null, null)
    }
    if (anterior == null && !esConsultaDeuda(texto)) return ResultadoDeuda(null, null)
    var estado = anterior ?: ConversacionDeuda()
    if (RE_INGRESOS_INCIERTOS.containsMatchIn(norm)) estado = estado.copy(ingresosInciertos = true)

    var recibidos = 0
    var fuente = ""
    if (anterior?.pendiente == CampoDeuda.AHORROS && RE_MENCIONA_CAJITA.containsMatchIn(norm)) {
        val coincidencias = cajitas.filter { c ->
            c.archivedAt == null &&
                (c.tipo == TipoCajita.CUENTA || c.tipo == TipoCajita.CAJITA) &&
                " $norm ".contains(" ${normalizarNombre(c.nombre)} ")
        }
        if (coincidencias.size > 1) {
            return ResultadoDeuda(estado, "Encontré varias cajitas: ${coincidencias.joinToString(", ") { it.nombre }}. ¿Cuál quieres usar para esta comparación?")
        }
        val cajita = coincidencias.firstOrNull()
        if (cajita != null) {
            val saldo = balances[cajita.id]
            if (saldo == null || saldo < 0) {
                return ResultadoDeuda(estado, "Encontré «${cajita.nombre}», pero no tengo un saldo válido para esta comparación. Revisa su saldo o dime cuánto quieres considerar.")
            }
            estado = estado.copy(ahorros = saldo, ultimoCampo = CampoDeuda.AHORROS)
            recibidos++
            fuente = "Tomé **${cop(saldo)}** del saldo registrado en «${cajita.nombre}». Solo lo uso para comparar; no moví dinero.\n\n"
        }
    }
    val textoImportes = normalizarImportes(texto)
    val correccion = RE_CORRECCION.find(textoImportes)
    if (correccion != null) {
        val montoCorregido = leerMontoConversacion(correccion.groupValues[1].reemplazarPrimero(RE_COLA_PUNTUACION, "").trimJs())
        val ultimo = estado.ultimoCampo
        if (ultimo != null && montoCorregido != null && (ultimo != CampoDeuda.DEUDA || montoCorregido > 0)) {
            estado = conValor(estado, ultimo, montoCorregido)
            recibidos++
        }
    }
    for ((campo, regex) in RE_DATO_ETIQUETADO) {
        val valor = regex.find(textoImportes)?.groupValues?.get(1)
        val monto = if (valor == null) null else leerMontoConversacion(valor.reemplazarPrimero(RE_COLA_PUNTUACION, "").trimJs())
        if (monto != null && (campo != CampoDeuda.DEUDA || monto > 0)) {
            estado = conValor(estado, campo, monto).copy(ultimoCampo = campo)
            recibidos++
        }
    }
    // Solo quitar envolturas inequívocas de respuesta. No extraer el primer
    // número de cualquier frase: podría ser una cuota, una fecha o un interés.
    val respuestaBreve = textoImportes
        .reemplazarPrimero(RE_ENVOLTURA_RESPUESTA, "")
        .reemplazarPrimero(RE_COLA_PUNTUACION, "").trimJs()
    val monto = leerMontoConversacion(respuestaBreve)
    val esperado = anterior?.pendiente
    if (recibidos == 0 && esperado != null && monto != null && (esperado != CampoDeuda.DEUDA || monto > 0)) {
        estado = conValor(estado, esperado, monto).copy(ultimoCampo = esperado)
        recibidos++
    }
    val pendiente = CampoDeuda.values().firstOrNull { valorDe(estado, it) == null }
    estado = estado.copy(pendiente = pendiente)
    val resumen = listOf(
        estado.deuda?.let { "Deuda: **${cop(it)}**." } ?: "",
        estado.ahorros?.let { "Ahorros: **${cop(it)}**." } ?: "",
        estado.reserva?.let { "Reserva: **${cop(it)}**." } ?: "",
    ).filter { it.isNotEmpty() }.joinToString(" ")
    val contexto = if (estado.ingresosInciertos == true && anterior == null) " Como mencionaste tu contrato o una situación laboral que puede afectar tus ingresos, incluiremos el dinero que necesitas conservar." else ""
    if (pendiente != null) {
        val inicio = if (anterior == null) "Podemos comparar pagar la deuda con tus ahorros y conservar dinero para tus compromisos."
        else if (recibidos > 0) (if (correccion != null) "Listo, corregí el dato anterior." else "Gracias, ya tengo ese dato.")
        else "No pude identificar con seguridad ese monto. Puedes responder, por ejemplo, «900 mil» o «el saldo total es 900000»."
        return ResultadoDeuda(
            estado,
            "$inicio$contexto\n\n$fuente${if (resumen.isNotEmpty()) "$resumen\n\n" else ""}${PREGUNTAS.getValue(pendiente)}${if (anterior != null) "" else "\n\nPuedes escribir «cancelar» para salir de esta consulta."}",
        )
    }
    val deuda = estado.deuda!!
    val ahorros = estado.ahorros!!
    val reserva = estado.reserva!!
    val abono = minOf(deuda, maxOf(0L, ahorros - reserva))
    val pagoTotal = if (ahorros >= deuda)
        "Pagar toda la deuda dejaría **${cop(ahorros - deuda)}** de ahorros${if (ahorros - deuda < reserva) ", por debajo de la reserva que indicaste" else ""}."
    else "Tus ahorros no cubren toda la deuda: faltarían **${cop(deuda - ahorros)}**."
    return ResultadoDeuda(
        estado,
        "$resumen\n\n$pagoTotal\n\nSi conservas tu reserva, podrías destinar como máximo **${cop(abono)}** a esta deuda; quedarían **${cop(deuda - abono)}** pendientes y **${cop(ahorros - abono)}** de ahorros.${if (reserva > ahorros) " La reserva que necesitas supera tus ahorros actuales." else ""}\n\nEsta comparación usa los montos que me diste; no incluye intereses ni comisiones. Para comparar cuotas y recomendar un plan también hacen falta la tasa de interés, el pago mínimo y tus ingresos y gastos básicos. La IA en línea puede ayudarte con ese análisis. Puedes corregir un dato con «deuda: 500 mil», «ahorros: 1 millón» o «reserva: 300 mil».",
    )
}
