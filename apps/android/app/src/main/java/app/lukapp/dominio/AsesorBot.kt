package app.lukapp.dominio

import app.lukapp.dominio.voz.CuentaConocida
import app.lukapp.dominio.voz.LexicoAprendido
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.dominio.voz.js
import app.lukapp.dominio.voz.parseTransaction
import app.lukapp.dominio.voz.trimJs
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.LocalDate
import kotlin.random.Random

/*
 * El motor local del Asesor: responde sin IA a saldos, resúmenes, 4x1000, renta y a
 * dictados que describen un movimiento. Origen: src/features/lukapp/lib/asesorBot.ts
 *
 * Es una traducción rama por rama. Lo único que cambia es lo que la web lee del reloj y
 * del azar: aquí `ahora` y `azar` llegan por parámetro para poder probarlo.
 */

/**
 * Origen: `asesorBot.ts` (`AsesorContext`). Lo que el asesor recuerda de un turno al
 * siguiente. `esRecursivo` es `_isRecursive` y `ultimoIndiceDato` es `lastInsightIdx`.
 */
data class AsesorContext(
    val ultimoAsunto: String? = null,
    val ultimaFecha: String? = null,
    val esRecursivo: Boolean = false,
    val ultimoIndiceDato: Int? = null,
    val conversacionDeuda: ConversacionDeuda? = null,
)

/**
 * Origen: `asesorBot.ts` (`AsesorResponse`). `sinRespuestaPropia`: la respuesta no sale de
 * los datos de la persona sino de una frase genérica de «no te entendí»; con IA disponible
 * esa pregunta se le debe pasar al modelo en vez de contestarla aquí.
 */
data class AsesorResponse(
    val text: String,
    val newContext: AsesorContext,
    val action: ParsedTransaction? = null,
    val actions: List<ParsedTransaction>? = null,
    val suggestions: List<String>? = null,
    val sinRespuestaPropia: Boolean = false,
)

private val VARIANCES_GASTO = listOf(
    "Mmm, revisando tus números, veo que en Y Z se te han ido **\$X**.",
    "Haciendo cuentas, llevas **\$X** gastados en Y Z. ¡Ojo ahí!",
    "Acabo de sumar todo y tienes **\$X** en Y Z.",
    "Pues mira, tienes registrados **\$X** en Y Z.",
    "Revisé la caja fuerte virtual y veo **\$X** en Y Z.",
    "Te confirmo que el total en Y Z suma **\$X**.",
)
private val VARIANCES_INGRESO = listOf(
    "¡Buenas noticias! Revisando tus números, veo que te han entrado **\$X** por Y Z.",
    "Haciendo cuentas, has recibido **\$X** en Y Z. ¡A seguir sumando!",
    "Acabo de sumar todo y tienes **\$X** de ingresos en Y Z.",
    "Pues mira, lograste generar **\$X** en Y Z. ¡Excelente trabajo!",
)
private val VARIANCES_CERO_GASTO = listOf(
    "¡Qué bien! No veo ni un solo peso gastado en Y Z.",
    "Todo en cero. No hay transacciones de eso Z.",
    "Parece que te portaste bien: no has gastado nada en Y Z.",
)
private val VARIANCES_CERO_INGRESO = listOf(
    "Aún no veo ingresos registrados en Y Z.",
    "Por ahora, no hay plata entrando por Y Z.",
    "Todo en cero en cuanto a ingresos Z. ¡A buscar nuevas oportunidades!",
)

/** Origen: `getRandom`. El azar es inyectable: la web usa `Math.random()`, aquí una `Random` que las pruebas pueden fijar. */
private fun elegir(opciones: List<String>, azar: Random): String =
    opciones[Math.floor(azar.nextDouble() * opciones.size).toInt()]

/**
 * `texto.replace('X', por)` de JS con un patrón de texto: reemplaza solo la primera
 * aparición e interpreta `$$`, `$&`, `` $` `` y `$'` del reemplazo.
 */
private fun reemplazarPrimeroJs(texto: String, buscado: String, por: String): String {
    val i = texto.indexOf(buscado)
    if (i < 0) return texto
    val sb = StringBuilder()
    var k = 0
    while (k < por.length) {
        val c = por[k]
        if (c == '$' && k + 1 < por.length) {
            when (por[k + 1]) {
                '$' -> { sb.append('$'); k += 2; continue }
                '&' -> { sb.append(buscado); k += 2; continue }
                '`' -> { sb.append(texto, 0, i); k += 2; continue }
                '\'' -> { sb.append(texto, i + buscado.length, texto.length); k += 2; continue }
            }
        }
        sb.append(c)
        k++
    }
    return texto.substring(0, i) + sb + texto.substring(i + buscado.length)
}

/**
 * Las sugerencias del fallback final («no entendí eso»). Se comparan más abajo para saber
 * si una mitad de una pregunta compuesta cayó en ese fallback: comparar contra esta lista
 * fija es determinista sin importar qué texto haya salido.
 */
val SUGERENCIAS_FALLBACK = listOf("¿Cuánto he gastado?", "Dame un resumen")

/** Origen: `esRespuestaFallbackAsesor`. Distingue una pregunta no reconocida de las respuestas locales instantáneas. */
fun esRespuestaFallbackAsesor(respuesta: AsesorResponse): Boolean =
    respuesta.sinRespuestaPropia ||
        (respuesta.suggestions?.size == SUGERENCIAS_FALLBACK.size &&
            respuesta.suggestions.withIndex().all { (i, s) -> s == SUGERENCIAS_FALLBACK[i] })

// Las consultas dictadas suelen llegar sin signos de interrogación. Un monto dentro de
// una decisión o un plan no demuestra que haya ocurrido un movimiento.
private val RE_CONSULTA_O_PLAN = js("""\b(recomiendas?|recomendacion|aconsejas|consejo|conviene|deberia|debo|quiero saber|no se si|que hago|que haria|es mejor|mejor pago|si pago|si compro|si gasto|si ahorro|voy a|pienso|planeo|quisiera|quiero comprar|quiero pagar|tengo una deuda|tengo ahorrados?|no registres|no anotes)\b""")

private fun esConsultaOPlan(norm: String): Boolean = RE_CONSULTA_O_PLAN.containsMatchIn(norm)

/** Origen: `asesorBot.ts` (`DeteccionMovimiento.propuesta`). */
data class PropuestaMovimiento(
    val text: String,
    val action: ParsedTransaction? = null,
    val actions: List<ParsedTransaction>? = null,
)

/**
 * Origen: `asesorBot.ts` (`DeteccionMovimiento`).
 * - `intent`: lo que el parser entendió de la frase completa, se haya podido proponer o
 *   no. El resto del enrutador de `responderAsesor` lo sigue necesitando (fecha,
 *   categoría, descripción) incluso cuando esto no resultó ser un movimiento que registrar.
 * - `propuesta`: lista para devolver tal cual si la frase describe uno o varios
 *   movimientos con monto real. `null` si es una pregunta, si falta el monto, o si el
 *   monto es demasiado débil para fiarse (ej. «cien» suelto sin «pesos»/«dólares»).
 */
data class DeteccionMovimiento(
    val intent: ParsedTransaction,
    val newContext: AsesorContext,
    val propuesta: PropuestaMovimiento?,
)

private val RE_NEGACION_MOVIMIENTO = js("""\b(no gaste|no pague|no compre|mi sueldo|gano)\b""")
private val RE_SEPARADORES_MOVIMIENTO = js(""" y |,| e | luego """)
private val RE_DIGITO = js("""\d""")

/** Las claves que `Object.entries` de JS pone primero: enteros canónicos, en orden ascendente. */
private fun esIndiceJs(clave: String): Boolean =
    clave.isNotEmpty() && clave.length <= 10 && clave.all { it in '0'..'9' } &&
        (clave == "0" || clave[0] != '0') && clave.toLong() < 4_294_967_295L

/** `Object.entries(obj)`: orden de inserción, salvo que las claves tipo índice van antes y ordenadas. */
private fun <V> Map<String, V>.entradasJs(): List<Pair<String, V>> {
    val (indices, otras) = entries.partition { esIndiceJs(it.key) }
    return indices.sortedBy { it.key.toLong() }.map { it.key to it.value } + otras.map { it.key to it.value }
}

/**
 * Origen: `asesorBot.ts` (`detectarMovimiento`). Si lo dictado describe uno o varios
 * movimientos reales, listos para proponer con confirmación.
 *
 * Esta es la ÚNICA puerta por la que un movimiento entra al libro desde el asesor, la
 * use el motor de reglas local o el modelo en línea. El LLM puede redactar lo que quiera;
 * lo que decide el monto, la categoría y si hay algo que guardar es siempre
 * `parseTransaction` — determinista, local, el mismo camino para los dos casos.
 *
 * `ahora` reemplaza al reloj: la alerta de promedio usa el mes UTC (`toISOString`) tal
 * como la web, y las fechas relativas del parser salen del día de Bogotá.
 */
fun detectarMovimiento(
    texto: String,
    transacciones: List<Transaccion>,
    cajitas: List<Cajita>,
    categorias: List<CategoriaPersonal>,
    lexico: LexicoAprendido,
    context: AsesorContext,
    ahora: Instant = Instant.now(),
): DeteccionMovimiento {
    val norm = normalizarNombre(texto)
    var newContext = context.copy()
    val consulta = continuarDeuda(texto, context.conversacionDeuda)
    newContext = newContext.copy(conversacionDeuda = consulta.estado)
    val hoyParser = deIso(bogotaDate(ahora))

    val cuentasParaElegir = cajitas
        .filter { it.archivedAt == null && it.tipo == TipoCajita.CUENTA }
        .map { CuentaConocida(it.id, it.nombre) }

    val isQuestion =
        consulta.respuesta != null ||
            RE_NEGACION_MOVIMIENTO.containsMatchIn(norm) ||
            esConsultaOPlan(norm) ||
            norm.contains("cuanto") ||
            norm.contains("cual") ||
            norm.contains("?") ||
            norm.contains("total") ||
            norm.contains("dime")

    // Multi-Transaction NLP Router (ej. "gaste 50 en comida, 20 en transporte y 100 en cine")
    if (!isQuestion && !context.esRecursivo) {
        val parts = norm
            .split(RE_SEPARADORES_MOVIMIENTO)
            .map { it.trimJs() }
            .filter { it.length > 4 }
        val partsWithNumbers = parts.filter { RE_DIGITO.containsMatchIn(it) }

        if (partsWithNumbers.size > 1) {
            val allActions = mutableListOf<ParsedTransaction>()
            val combinedText = StringBuilder("¡Guau, a la velocidad de la luz! Detecté varias transacciones de una sola pasada:\n\n")

            var lastKind = "gasto" // Default propagation
            for (part in partsWithNumbers) {
                val partToParse =
                    if (part.contains("gaste") || part.contains("pague") || part.contains("me pagaron")) part
                    else (if (lastKind == "ingreso") "me pagaron " else "gaste ") + part

                var subIntent = parseTransaction(partToParse, cuentasParaElegir, categorias, lexico, transacciones, hoyParser)
                val monto = subIntent.amount
                if (monto != null && monto > 0) {
                    lastKind = subIntent.kind

                    if ((subIntent.category == "otros" || subIntent.category.isEmpty()) && !context.ultimoAsunto.isNullOrEmpty()) {
                        subIntent = subIntent.copy(category = context.ultimoAsunto)
                    }

                    allActions.add(subIntent)
                    combinedText.append("• Un ${subIntent.kind} de **\$${milesEsCo(monto)}** en **${subIntent.category}**.\n")
                }
            }

            if (allActions.size > 1) {
                newContext = newContext.copy(ultimoAsunto = allActions.last().category)
                return DeteccionMovimiento(
                    intent = allActions.last(),
                    newContext = newContext,
                    propuesta = PropuestaMovimiento(
                        text = combinedText.toString() + "\nRevisa los botones abajo y dale clic a cada uno para registrarlos.",
                        actions = allActions,
                    ),
                )
            }
        }
    }

    // Single Transaction
    var intent = parseTransaction(texto, cuentasParaElegir, categorias, lexico, transacciones, hoyParser)

    val montoIntent = intent.amount
    if (montoIntent != null && montoIntent > 0 && intent.category == "otros" && !context.ultimoAsunto.isNullOrEmpty()) {
        intent = intent.copy(
            category = context.ultimoAsunto,
            description = intent.description.ifEmpty { "Adición a ${context.ultimoAsunto}" },
        )
    }

    val isWeakAmount =
        intent.amount != null &&
            intent.amount!! < 100 &&
            intent.signals.amountSource == "words" &&
            !norm.contains("peso") &&
            !norm.contains("dolar") &&
            !norm.contains("euro")

    val monto = intent.amount
    if (!isQuestion && monto != null && monto > 0 && !isWeakAmount) {
        newContext = newContext.copy(ultimoAsunto = intent.category)

        var alertText = ""
        if (intent.kind == "gasto" && intent.category != "otros") {
            val currentMonth = ahora.toString().substring(0, 7)
            val totalMonthCategory = transacciones
                .filter { it.kind == "gasto" && it.category == intent.category && it.occurredOn.startsWith(currentMonth) }
                .sumOf { it.amountCop }

            val newTotal = totalMonthCategory + monto

            val pastTxs = transacciones.filter {
                it.kind == "gasto" && it.category == intent.category && !it.occurredOn.startsWith(currentMonth)
            }
            if (pastTxs.size > 2) {
                val pastMonths = pastTxs.map { it.occurredOn.substring(0, minOf(7, it.occurredOn.length)) }.toSet().size.let { if (it == 0) 1 else it }
                val pastSum = pastTxs.sumOf { it.amountCop }
                val avgMonth = pastSum.toDouble() / pastMonths

                if (newTotal > avgMonth * 1.2) {
                    alertText = "\n\n**Alerta:** con este gasto llegarás a **\$${milesEsCo(newTotal)}** en ${intent.category} este mes — un 20% más de tu promedio mensual habitual (\$${milesEsCo(Math.round(avgMonth))})."
                } else if (newTotal > avgMonth * 0.9) {
                    alertText = "\n\n**Ojo ahí:** con este gasto ya estás rozando tu promedio habitual en ${intent.category}."
                }
            }
        }

        return DeteccionMovimiento(
            intent = intent,
            newContext = newContext,
            propuesta = PropuestaMovimiento(
                text = "Veo que mencionas un ${intent.kind} de **\$${milesEsCo(monto)}** en **${intent.category}**. ¿Quieres que lo registre de una vez en tus finanzas?$alertText",
                action = intent,
            ),
        )
    }

    return DeteccionMovimiento(intent, newContext, null)
}

private val RE_CANCELAR = js("""^(cancelar|salir|otro tema)[.!?]*$""")
private val RE_SIN_MOVIMIENTO = js("""\b(no gaste|no pague|no compre|tengo ahorrados?|mi sueldo|gano)\b""")
private val RE_SALUDO = js("""^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|q tal)""")
private val RE_QUIEN_ERES = js("""quien (eres|sos)|que eres|como te llamas""")
private val RE_GRACIAS = js("""gracias|te amo|excelente|genial|buen trabajo""")
private val RE_GMF = js("""4x1000|cuatro por mil|gmf|impuesto""")
private val RE_SORPRENDEME = js("""sorpren.*deme|dato curioso|raro|interesante|sorprendeme""")
private val RE_FUI_A = js("""fui a (comer|cenar|comprar|mercar)""")
private val RE_Y_EN = js("""^y en """)
private val RE_Y_ESTE_MES = js("""^(y )?(el|este) (mes|año|dia|semana)""")

private val RELLENO_PREGUNTA = setOf(
    "este", "esta", "el", "la", "de", "en", "mes", "dia", "dias", "ayer", "hoy", "cuanto", "cuanta",
    "gastado", "gaste", "gasto", "total", "año", "anio", "pasado", "semana", "busca", "gastos",
)

private val DIAS_NOMBRES = listOf("Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado")

private class ReglaCharla(val regex: Regex, val respuestas: List<String>)

private val REGLAS_CHARLA = listOf(
    ReglaCharla(
        js("""me (entiendes|comprendes|escuchas)""", "i"),
        listOf(
            "¡Te entiendo perfectamente! Aunque mi lenguaje principal son los números y las finanzas, hago mi mejor esfuerzo por procesar todo lo que dices. ¿De qué te gustaría hablar?",
            "Claro que sí. Leo tus mensajes en tiempo real. Soy mejor calculando gastos que filosofando, ¡pero aquí estoy para ti!",
        ),
    ),
    ReglaCharla(
        js("""(eres|sos) (inteligente|bruto|tonto|ia|robot)""", "i"),
        listOf(
            "Hago lo mejor que puedo con mis algoritmos. No soy tan grande como ChatGPT, pero tengo la ventaja de que vivo en tu dispositivo y protejo tu privacidad al 100%.",
            "Soy una inteligencia especializada. Pregúntame sobre tus finanzas y verás cómo hago magia con tus números.",
        ),
    ),
    ReglaCharla(
        js("""(jaja|jeje|jiji|lol|lmao|xdd)""", "i"),
        listOf(
            "Siempre es bueno mantener el humor, sobre todo cuando hablamos de plata.",
            "Me alegra que te diviertas. Las finanzas no tienen por qué ser aburridas.",
        ),
    ),
    ReglaCharla(
        js("""que (puedes|sabes) hacer""", "i"),
        listOf(
            "Puedo hacer muchas cosas: preguntarme cuánto gastaste en algo, pedirme un resumen del mes, comparar tus gastos con el mes pasado, pedirme tu saldo o incluso decirme directamente \"ayer gasté 20 lucas en cine\" para que lo anote por ti.",
            "Mi especialidad es tu bolsillo. Pregúntame sobre tus gastos en fechas específicas, pídeme un resumen financiero, o dime cuánto gastaste en algo para que lo sume a tus cuentas.",
        ),
    ),
    ReglaCharla(
        js("""como (te sientes|estas)""", "i"),
        listOf(
            "Muy bien, gracias por preguntar. Me alegra acompañarte un rato. ¿Cómo estás tú?",
            "Todo bien por aquí, y mejor ahora que hablamos. Cuéntame, ¿cómo te ha ido hoy?",
        ),
    ),
    ReglaCharla(
        js("""te (amo|quiero)""", "i"),
        listOf(
            "Aprecio que confíes en mí para cuidar tus finanzas.",
            "Yo solo quiero ver crecer tus ahorros.",
        ),
    ),
    ReglaCharla(
        js("""chao|adios|hasta luego|nos vemos""", "i"),
        listOf(
            "Hasta pronto. Aquí estaré guardando tus finanzas bajo llave.",
            "Nos vemos. Piensa dos veces antes de ese \"gasto hormiga\".",
        ),
    ),
    ReglaCharla(
        js("""y si no me alcanza""", "i"),
        listOf(
            "¡Tranquilo! Ese es el miedo de todos. Si sientes que no te va a alcanzar, lo mejor es frenar cualquier \"gasto hormiga\" desde ya. ¿Quieres que miremos en qué estás gastando más este mes para cortarlo a tiempo?",
            "Si no te alcanza, tenemos que entrar en \"modo supervivencia\". Cero domicilios, cero salidas innecesarias. ¿Te parece si hacemos un presupuesto diario con la plata que te queda?",
        ),
    ),
    ReglaCharla(
        js("""no me rinde|no me alcanza|se me va( la plata| el dinero)""", "i"),
        listOf(
            "Es una sensación horrible, lo sé. Generalmente la plata \"se va\" sin darnos cuenta en compras chiquitas. Intenta registrar *absolutamente todo* esta semana, hasta un chicle, y te prometo que encontraremos el hueco.",
            "Suele pasar cuando no tenemos un presupuesto fijo. ¡Pero para eso estoy aquí! Hagamos el ejercicio: ¿ya registraste todos los gastos de hoy?",
        ),
    ),
    ReglaCharla(
        js("""que (hago|me recomiendas|deberia hacer)""", "i"),
        listOf(
            "Mi primera recomendación es que siempre sepas cuánto tienes. Pídeme un \"resumen\" a menudo. Si ves que el balance está en rojo, corta gastos. Si está en verde, ¡ahorra la diferencia!",
            "Haz un presupuesto a principio de mes y no te salgas de él. Y si sobra alguito, mételo directo a una Cajita para que no te pique la mano por gastarlo.",
        ),
    ),
    ReglaCharla(
        js("""estoy (triste|feliz|cansado|aburrido)""", "i"),
        listOf(
            "Entiendo que te sientas así. A veces ordenar las finanzas ayuda a tener una mente más tranquila. ¿Quieres que miremos tus números para ver si hay buenas noticias?",
            "Tomo nota de cómo te sientes. Si quieres distraerte un poco, podemos revisar tu balance o buscar oportunidades de ahorro.",
        ),
    ),
    ReglaCharla(
        js("""estoy (quebrado|pobre|sin plata|arruinado|endeudado)""", "i"),
        listOf(
            "¡Tranquilo! Las malas rachas pasan. Lo importante es empezar a registrar cada peso para saber por dónde se está fugando el dinero. Si quieres, dime un resumen de lo que tienes ahora mismo en el bolsillo y empezamos desde ahí.",
            "A todos nos pasa. El primer paso para mejorar es medir. Intenta no gastar más de lo necesario esta semana y revisemos tu resumen en unos días.",
        ),
    ),
    ReglaCharla(
        js("""(mierda|puta|joder|carajo|maldita sea|puto|hijueputa|hpta)""", "i"),
        listOf(
            "¡Uy, respira profundo! Sé que los números a veces estresan y dan ganas de tirar todo por la ventana, pero todo tiene arreglo si nos organizamos. ¿Qué pasó? ¿Hiciste un gasto que no debías?",
            "¡Calma, calma! Las finanzas pueden ser un dolor de cabeza. Tomemos un vaso de agua y revisemos los números con cabeza fría.",
        ),
    ),
    ReglaCharla(
        js("""(consejo|tip|recomendacion|recomiendas)""", "i"),
        listOf(
            "¡Claro! Mi mejor consejo es la regla del 50/30/20: destina 50% de tus ingresos a necesidades básicas, 30% a gustos y un 20% inténtalo ahorrar o invertir. Si quieres, pregúntame por tu resumen y miramos cómo vas.",
            "Te doy un tip: revisa siempre los \"gastos hormiga\" (esos cafés o snacks diarios que parecen poco pero suman mucho a fin de mes). Si me dices \"¿cuánto gasté en café?\", podemos investigarlo juntos.",
            "La mejor recomendación que te puedo dar es que mantengas tus ahorros separados de tu cuenta principal (por ejemplo, en una Cajita). Así tu cerebro cree que tienes menos dinero disponible y evitarás gastar por impulso.",
        ),
    ),
    ReglaCharla(
        js("""robo|estafa|atraco|carisimo|muy caro""", "i"),
        listOf(
            "Qué dolor de bolsillo. A veces toca aprender a la mala — registremos esto y tratemos de recuperarnos ahorrando en otras cosas esta semana.",
            "Eso suena terrible. Da rabia pagar más de la cuenta, pero míralo como una alerta para no volver a caer. ¿Lo anotamos de todas formas?",
        ),
    ),
    ReglaCharla(
        js("""ganga|barato|promocion|descuento|ofertazo""", "i"),
        listOf(
            "Aprovechar buenas ofertas es la base del ahorro inteligente. Dime el monto y lo anoto.",
            "Eso es una victoria financiera. Cada peso que te ahorras en una promoción es un peso que puedes mandar a tu Cajita de ahorros.",
        ),
    ),
    ReglaCharla(
        js("""cdt|invertir|inversion|acciones|bitcoin|cripto|bolsa""", "i"),
        listOf(
            "¡Me encanta que pienses en el futuro! Si vas a invertir en algo seguro, un CDT es ideal hoy en día porque las tasas suelen estar altas. Si buscas cripto o acciones, hazlo solo con dinero que \"estés dispuesto a perder\". Recuerda diversificar.",
            "Regla de oro: nunca inviertas en negocios que no entiendes. Si quieres empezar suave, los depósitos a plazo fijo (CDT) de los bancos son buena opción. Si quieres más riesgo, busca ETFs en la bolsa. ¡Pero siempre con cabeza fría!",
        ),
    ),
    ReglaCharla(
        js("""cuanto me falta para|meta de ahorro|como va mi meta""", "i"),
        listOf(
            "Para revisar el progreso de tus metas, ve a la sección \"Cuentas\" y mira el progreso de tu \"Cajita\" asignada. Si le pones una meta clara y le asignas un monto total, la app te mostrará exactamente qué porcentaje llevas. ¡Sigue así!",
            "¡Vas por buen camino! Cada vez que guardas dinero en una Cajita te acercas a esa meta. Intenta establecer transferencias automáticas para que el ahorro crezca sin que te des cuenta.",
        ),
    ),
    ReglaCharla(
        js("""(como|puedo) (borrar|eliminar|editar|modificar|corregir|cancelar|deshacer)|me equivoque""", "i"),
        listOf(
            "¡No te preocupes! Si te equivocaste con un gasto, simplemente ve a la pestaña \"Movimientos\" en la barra inferior. Ahí puedes tocar cualquier transacción para editarla o deslizarla hacia la izquierda para eliminarla.",
            "Es muy fácil corregir errores: ve a \"Movimientos\", busca el registro y tócalo para cambiar el monto o la categoría. ¡O elimínalo si fue una prueba!",
        ),
    ),
    ReglaCharla(
        js("""como (ahorrar|ahorro)|quiero ahorrar|empezar a ahorrar""", "i"),
        listOf(
            "¡Esa es la actitud! La mejor forma de ahorrar aquí es crear una \"Cajita\". Ve a la pestaña \"Cuentas\", crea una Cajita y muévele dinero. Así separas tu ahorro de tu plata de uso diario y evitas gastarlo.",
            "Te recomiendo la técnica de \"pagarte a ti primero\". Apenas recibas tu sueldo, manda el 10% a una Cajita de ahorro en la app. ¡Ojos que no ven, corazón que no gasta!",
        ),
    ),
    ReglaCharla(
        js("""prestamo|deuda|me prestaron|le preste""", "i"),
        listOf(
            "Las deudas pueden ser engañosas. Si prestaste plata, regístralo como un Gasto en la categoría \"Préstamos\". Cuando te paguen, lo registras como un Ingreso en esa misma categoría. Así tu balance se mantendrá exacto.",
            "Para llevar el control de préstamos, te sugiero crear una categoría personalizada llamada \"Deudas\" o \"Préstamos\" y registrar ahí los movimientos. ¡Que no se te olvide cobrar!",
        ),
    ),
)

/** `Number.prototype.toFixed(1)` de JS: el valor exacto del double, redondeado hacia arriba en el empate. */
private fun aFijo1(valor: Double): String = BigDecimal(valor).setScale(1, RoundingMode.HALF_UP).toPlainString()

private fun claveMes(anio: Int, mes: Int): String = "$anio-${mes.toString().padStart(2, '0')}"

private fun diasDelMes(anio: Int, mes: Int): Int = LocalDate.of(anio, mes, 1).lengthOfMonth()

/**
 * El mes anterior como lo calcula la web con `setMonth(getMonth() - 1)`: si el día no existe
 * en ese mes se desborda al siguiente (el 31 de octubre da el 1 de octubre, no septiembre).
 */
private fun mesAnteriorJs(anio: Int, mes: Int, dia: Int): String {
    val f = fechaUtc(anio, mes - 1, dia)
    return claveMes(f.year, f.monthValue)
}

/**
 * Origen: `asesorBot.ts` (`responderAsesor`). El enrutador de reglas del asesor local.
 *
 * @param ahora el instante de la consulta: de él salen el mes en curso, los días que
 *   quedan y el saludo por hora, todo en hora de Bogotá (la web usa `new Date()`).
 * @param azar de dónde salen las variantes de texto; en pruebas, una `Random` con semilla.
 * @param disponibleDiarioCop el disponible diario que ya calculó el motor financiero; si
 *   falta se reparte el saldo de las cuentas entre los días que quedan.
 */
fun responderAsesor(
    texto: String,
    transacciones: List<Transaccion>,
    cajitas: List<Cajita>,
    cajitasBalances: Map<String, Long>,
    categorias: List<CategoriaPersonal>,
    lexico: LexicoAprendido,
    context: AsesorContext,
    disponibleDiarioCop: Long? = null,
    ahora: Instant = Instant.now(),
    azar: Random = Random.Default,
): AsesorResponse {
    val ayudaLukApp = responderAyudaLukApp(texto)
    if (ayudaLukApp != null) return AsesorResponse(ayudaLukApp, context.copy())
    if (clasificarAlcanceAsesor(texto) == AlcanceAsesor.TECNICA_SIN_FINANZAS) {
        return AsesorResponse(RESPUESTA_TEMA_TECNICO, context.copy())
    }
    val norm = normalizarNombre(texto)
    var newContext = context.copy()
    val consulta = continuarDeuda(texto, context.conversacionDeuda, cajitas, cajitasBalances)
    newContext = newContext.copy(conversacionDeuda = consulta.estado)
    if (consulta.respuesta != null) {
        return AsesorResponse(consulta.respuesta, newContext, suggestions = listOf("Cancelar"))
    }
    if (RE_CANCELAR.containsMatchIn(norm)) {
        return AsesorResponse("Cerramos la consulta. Puedes preguntarme por tus cuentas o registrar un movimiento.", newContext, suggestions = SUGERENCIAS_FALLBACK)
    }
    // Mantener la decisión completa: dividirla puede convertir una alternativa
    // de pago en un gasto y perder la negación que aparecía antes del monto.
    val consultaSinMovimiento = esConsultaOPlan(norm) || RE_SIN_MOVIMIENTO.containsMatchIn(norm)

    // Resolver la consulta completa antes de separar por "y": sus montos pueden
    // ser alternativas de pago, no transacciones independientes.
    if (consultaSinMovimiento && RE_DIGITO.containsMatchIn(norm)) {
        return AsesorResponse(
            "Veo que esos montos forman parte de una consulta o de tu situación financiera. Para simular un cambio puedes escribir «Qué pasa si gasto 100 mil». Si quieres registrar algo que ya ocurrió, escribe por ejemplo «Pagué 70 mil en comida».",
            newContext,
        )
    }

    val hoy = bogotaDate(ahora)
    val (anioHoy, mesHoy, diaHoy) = hoy.split("-").map { it.toInt() }
    val mesActual = claveMes(anioHoy, mesHoy)

    // 0. Multi-Query NLP Router (ej. "cuanto tengo en cuentas y cuanto gaste en rappi")
    if (
        !context.esRecursivo &&
        !consultaSinMovimiento &&
        norm.contains(" y ") &&
        !norm.startsWith("y ") &&
        !norm.contains("ayer") &&
        !norm.contains("hoy")
    ) {
        val parts = norm.split(" y ")
        // Intentar partir la oración en dos preguntas completas si son suficientemente largas
        if (parts.size == 2 && parts[0].length > 6 && parts[1].length > 6) {
            val p1 = parts[0]
            // Restauramos la intención natural a la segunda parte (ej. si la parte 1 es "dime mi saldo", la 2 es "cuanto gaste en comida")
            val p2 = if (parts[1].contains("cuanto")) parts[1]
            else if (parts[0].contains("cuanto")) "cuanto " + parts[1]
            else parts[1]

            val r1 = responderAsesor(p1, transacciones, cajitas, cajitasBalances, categorias, lexico, context.copy(esRecursivo = true), disponibleDiarioCop, ahora, azar)
            val r2 = responderAsesor(p2, transacciones, cajitas, cajitasBalances, categorias, lexico, r1.newContext.copy(esRecursivo = true), disponibleDiarioCop, ahora, azar)

            // Solo combinamos si ninguna de las dos cayó en el fallback final —
            // comparar las sugerencias es determinista; comparar el texto no lo
            // era, porque el fallback elige una de tres frases al azar. A
            // diferencia de `esRespuestaFallbackAsesor`, aquí NO cuenta `sinRespuestaPropia`.
            val cayoEnFallback = { r: AsesorResponse ->
                r.suggestions?.size == SUGERENCIAS_FALLBACK.size &&
                    r.suggestions.withIndex().all { (i, s) -> s == SUGERENCIAS_FALLBACK[i] }
            }

            if (!cayoEnFallback(r1) && !cayoEnFallback(r2)) {
                // Si cualquiera de las dos mitades propuso un movimiento, ese `action`
                // tiene que sobrevivir a la combinación: cada mitad lo lleva en su
                // propia respuesta y aquí solo se arma `text`.
                val accionesCombinadas =
                    (r1.actions ?: listOfNotNull(r1.action)) + (r2.actions ?: listOfNotNull(r2.action))

                return AsesorResponse(
                    text = "${r1.text}\n\n**Por otro lado...**\n${r2.text}",
                    newContext = r2.newContext.copy(esRecursivo = false),
                    action = if (accionesCombinadas.size == 1) accionesCombinadas[0] else null,
                    actions = if (accionesCombinadas.size > 1) accionesCombinadas else null,
                )
            }
        }
    }

    // Saludos dinámicos por hora del día
    if (RE_SALUDO.containsMatchIn(norm)) {
        val hora = bogotaHora(ahora)
        val saludo = if (hora < 12) "¡Buenos días!" else if (hora < 19) "¡Buenas tardes!" else "¡Buenas noches!"

        return AsesorResponse(
            elegir(
                listOf(
                    "$saludo Qué bueno leerte. Soy Luki, tu amigo contador; ¿cómo vas hoy?",
                    "$saludo Aquí estoy contigo. Cuando quieras revisamos tus números, pero primero cuéntame: ¿cómo estás?",
                    "$saludo Me alegra verte por aquí. ¿Qué tal va tu día?",
                ),
                azar,
            ),
            newContext,
        )
    }

    if (RE_QUIEN_ERES.containsMatchIn(norm)) {
        return AsesorResponse(
            "Soy Luki, tu amigo contador en LukApp. Estoy para conversar contigo y ayudarte a entender y organizar tu plata con consejos claros para Colombia. Cuando se trate de decisiones importantes, te daré contexto para que las tomes con calma.",
            newContext,
        )
    }
    if (RE_GRACIAS.containsMatchIn(norm)) {
        return AsesorResponse(
            elegir(
                listOf(
                    "¡Con todo gusto! Para eso estoy. Si necesitas algo más, aquí sigo.",
                    "¡De nada! Recuerda que un peso ahorrado es un peso ganado. ¿Deseas ver algo más?",
                    "¡Me alegra ayudar! Cuidar tus finanzas es mi pasión.",
                ),
                azar,
            ),
            newContext,
        )
    }

    // 1.5 Memoria de Edición al Vuelo (Correcciones)
    if (
        !context.ultimoAsunto.isNullOrEmpty() &&
        (norm.startsWith("fueron ") ||
            norm.startsWith("era ") ||
            norm.startsWith("eran ") ||
            norm.contains("corrijo") ||
            norm.contains("ah no,"))
    ) {
        val parsed = parseTransaction(texto, emptyList(), categorias, lexico, transacciones, deIso(hoy))
        val monto = parsed.amount
        if (monto != null && monto > 0) {
            val intent = parsed.copy(category = context.ultimoAsunto, description = "Corrección en ${context.ultimoAsunto}")
            return AsesorResponse(
                "¡Listo! Entendido, en realidad fueron **\$${milesEsCo(monto)}** en **${context.ultimoAsunto}**. (Recuerda que para eliminar el registro erróneo anterior, debes deslizarlo en la pestaña Movimientos). ¿Registro este nuevo monto corregido?",
                newContext,
                action = intent,
            )
        }
    }

    // 2. Resumen General / Analytics y "Opiniones" ("como voy", "resumen del mes", "estoy gastando mucho?")
    if (
        norm.contains("resumen") ||
        norm.contains("como voy") ||
        norm.contains("como me ves") ||
        norm.contains("como ves") ||
        norm.contains("finanzas") ||
        norm.contains("gastando mucho") ||
        norm.contains("analisis")
    ) {
        val mesTxs = transacciones.filter { it.occurredOn.startsWith(mesActual) }

        val ingresos = mesTxs.filter { it.kind == "ingreso" }.sumOf { it.amountCop }
        val gastos = mesTxs.filter { it.kind == "gasto" }.sumOf { it.amountCop }
        val ahorro = ingresos - gastos
        val tasaAhorro: String = if (ingresos > 0) aFijo1(ahorro.toDouble() / ingresos * 100) else "0"

        var text = "Tu resumen de este mes:\n\n"
        text += "**Ingresos:** \$${milesEsCo(ingresos)}\n"
        text += "**Gastos:** \$${milesEsCo(gastos)}\n"

        if (ahorro > 0) {
            text += "**Balance:** +\$${milesEsCo(ahorro)} (ahorrando el $tasaAhorro%)\n\n"
            text += if (tasaAhorro.toDouble() > 20) {
                "Ahorrar más del 20% es una tasa muy sólida. Sigue así y vas a construir un colchón fuerte."
            } else {
                "Vas bien, en verde. Intenta no subir los gastos de aquí a fin de mes para mantener ese ahorro."
            }
        } else if (ahorro == 0L && ingresos == 0L) {
            text += "\nEste mes no has registrado movimientos todavía. Registra tus primeros gastos o ingresos para darte un diagnóstico real."
        } else {
            text += "**Balance:** -\$${milesEsCo(Math.abs(ahorro))}\n\n"
            text += "Estás gastando más de lo que ha entrado este mes. Toca apretarse el cinturón o revisar si te faltó registrar algún ingreso."
        }

        // Top Category
        val porCategoria = LinkedHashMap<String, Long>()
        mesTxs.filter { it.kind == "gasto" }.forEach { porCategoria[it.category] = (porCategoria[it.category] ?: 0L) + it.amountCop }
        val topCat = porCategoria.entradasJs().sortedByDescending { it.second }.firstOrNull()

        if (topCat != null && topCat.second > 0) {
            text += "\n\nPor cierto, tu \"agujero negro\" de dinero este mes es **${topCat.first}** con \$${milesEsCo(topCat.second)}... ten cuidado con eso."
        }

        // Biggest Transaction
        val biggestTx = mesTxs.filter { it.kind == "gasto" }.sortedByDescending { it.amountCop }.firstOrNull()
        if (biggestTx != null && biggestTx.amountCop > 0) {
            text += "\nTu compra más grande fue de **\$${milesEsCo(biggestTx.amountCop)}** en ${biggestTx.category} el ${biggestTx.occurredOn}."
        }

        // Financial Projection (Burn Rate)
        if (gastos > 0 && diaHoy > 3) {
            val burnRate = gastos.toDouble() / diaHoy
            val ultimoDia = diasDelMes(anioHoy, mesHoy)
            val proyeccion = burnRate * ultimoDia

            text += "\n\n**Proyección a fin de mes:** al ritmo que llevas (\$${milesEsCo(Math.round(burnRate))} diarios), terminarás gastando unos **\$${milesEsCo(Math.round(proyeccion))}** en total este mes. "

            if (proyeccion > ingresos && ingresos > 0) {
                text += "Eso es más de lo que ha ingresado."
            } else if (ingresos > 0) {
                text += "Parece que te sobrará dinero."
            }
        }

        val suggestions = if (topCat != null) listOf("¿Cuánto he gastado en ${topCat.first}?", "Dame un consejo")
        else listOf("Dime mi saldo", "Dame un consejo")

        return AsesorResponse(text, newContext, suggestions = suggestions)
    }

    // 3. Consulta de Saldos (Cuentas/Cajitas)
    if (
        norm.contains("cuanto") &&
        (norm.contains("tengo") || norm.contains("saldo") || norm.contains("dinero") || norm.contains("plata")) &&
        !norm.contains("gastado") &&
        !norm.contains("gaste")
    ) {
        val totalCuentas = cajitas
            .filter { it.tipo == TipoCajita.CUENTA && it.archivedAt == null }
            .sumOf { cajitasBalances[it.id] ?: 0L }
        val totalAhorro = cajitas
            .filter { it.tipo == TipoCajita.CAJITA && it.archivedAt == null }
            .sumOf { cajitasBalances[it.id] ?: 0L }

        val cuentaEspecifica = cajitas.firstOrNull { norm.contains(normalizarNombre(it.nombre)) }
        if (cuentaEspecifica != null) {
            val bal = cajitasBalances[cuentaEspecifica.id] ?: 0L
            return AsesorResponse(
                "En tu cuenta **${cuentaEspecifica.nombre}** tienes un saldo de \$${milesEsCo(bal)}.",
                newContext,
            )
        }

        var resp = "Actualmente tienes **\$${milesEsCo(totalCuentas)}** disponibles en tus cuentas principales, y **\$${milesEsCo(totalAhorro)}** en tus ahorros o bolsillos."

        if (totalCuentas > 1000000 && totalAhorro < 100000) {
            resp += "\n\n**Consejo:** tienes bastante dinero líquido en tus cuentas y poco en tus cajitas de ahorro. Considera mover un porcentaje a una \"Cajita\" para separarlo de tu plata de uso diario."
        }

        return AsesorResponse(
            resp,
            newContext,
            suggestions = if (totalCuentas > 1000000 && totalAhorro < 100000) listOf("¿Cómo crear una Cajita?", "Dime mi resumen")
            else listOf("Dime mi resumen", "¿Cuánto puedo gastar?"),
        )
    }

    // 3.4 Exención Inteligente 4x1000 / GMF
    if (RE_GMF.containsMatchIn(norm)) {
        val bajoMonto = cajitas.filter { it.esBajoMonto && it.archivedAt == null }

        var text = "Acá entre nos, el 4x1000 (o GMF) te quita \$4 por cada \$1.000 que muevas de tus cuentas financieras hacia afuera.\n\n"

        text += if (bajoMonto.isNotEmpty()) {
            "Marcaste **${bajoMonto[0].nombre}** como Depósito de Bajo Monto: la DIAN te da una exención de hasta 65 UVT (aprox \$3 millones de pesos al mes) en retiros de esa cuenta antes de cobrarte un solo peso de 4x1000.\n\nLlevo esa cuenta por ti — si veo que te vas a pasar del límite en el mes, te lo advierto."
        } else {
            "**Un truco útil:** si tienes una cuenta como Nequi o Daviplata (Depósitos de Bajo Monto), tienes hasta ~3 millones de pesos al mes libres de este impuesto sin importar cuál sea tu cuenta principal exenta.\n\nVe a 'Configuración > Editar Cajita' y márcala como 'Depósito de Bajo Monto' para que te calcule exactamente cuánto cupo te queda sin pagar impuestos."
        }

        return AsesorResponse(text, newContext, suggestions = listOf("Dame un consejo", "Resumen del mes"))
    }

    // 3.4.1. Topes Declaración de Renta DIAN
    if (
        norm.contains("renta") ||
        norm.contains("declarar") ||
        norm.contains("dian") ||
        (norm.contains("tope") && norm.contains("declar"))
    ) {
        val anal = analizarTopesRenta(transacciones, anioHoy, UVT_POR_DEFECTO)
        return AsesorResponse(
            "🇨🇴 **Análisis de Topes DIAN para Declaración de Renta (${anal.anio}):**\n\n" +
                "• **Consignaciones / Ingresos:** \$${milesEsCo(anal.acumuladoConsignacionesPesos)} de \$${milesEsCo(anal.topeConsignacionesPesos)} (${anal.porcentajeConsignaciones}% del tope de 1.400 UVT)\n" +
                "• **Compras y Gastos:** \$${milesEsCo(anal.acumuladoComprasPesos)} de \$${milesEsCo(anal.topeComprasPesos)} (${anal.porcentajeCompras}%)\n\n" +
                "📌 **Diagnóstico:** ${anal.mensajeConsejo}",
            newContext,
            suggestions = listOf("Simular Retefuente", "¿Pagaré 4x1000?", "Resumen del mes"),
        )
    }

    // 3.4.2. Retención en la Fuente e Independientes
    if (
        norm.contains("retencion") ||
        norm.contains("retefuente") ||
        norm.contains("honorarios") ||
        norm.contains("cuenta de cobro")
    ) {
        return AsesorResponse(
            "💼 **Simulador de Retenciones para Independientes:**\n\n" +
                "Para calcular retenciones en una cuenta de cobro en Colombia:\n\n" +
                "• **Honorarios No declarante:** 10% Retefuente + 9.66‰ ReteICA\n" +
                "• **Honorarios Declarante:** 11% Retefuente + 9.66‰ ReteICA\n" +
                "• **Servicios generales:** 4% a 6%\n\n" +
                "Puedes abrir las **Herramientas Fiscales** para simular tu liquidación exacta con aportes a seguridad social.",
            newContext,
            suggestions = listOf("¿Debo declarar renta?", "¿Cuánto puedo gastar?"),
        )
    }

    // 3.4.3. Vaquitas y Gastos Compartidos
    if (
        norm.contains("vaca") ||
        norm.contains("vaquita") ||
        norm.contains("gasto compartido") ||
        norm.contains("dividir cuenta")
    ) {
        return AsesorResponse(
            "🐮 **Vaquitas y Gastos Compartidos:**\n\n" +
                "En LukApp puedes organizar salidas, asados y paseos con amigos. Cada persona aporta su cuota, anotan los gastos comunes y el sistema calcula exactamente **quién le debe a quién** para quedar a mano sin enredos.",
            newContext,
            suggestions = listOf("¿Cuánto puedo gastar?", "Dime mi resumen"),
        )
    }

    // 3.5. Presupuesto Diario Sugerido ("cuanto puedo gastar", "cuanto me queda")
    if (
        norm.contains("puedo gastar") ||
        (norm.contains("cuanto") && norm.contains("me queda")) ||
        norm.contains("presupuesto")
    ) {
        val totalCuentas = cajitas
            .filter { it.tipo == TipoCajita.CUENTA && it.archivedAt == null }
            .sumOf { cajitasBalances[it.id] ?: 0L }

        if (totalCuentas == 0L) {
            return AsesorResponse("No tienes saldo en tus cuentas ahora mismo para calcular un presupuesto.", newContext)
        }

        val ultimoDia = diasDelMes(anioHoy, mesHoy)
        val diasRestantes = ultimoDia - diaHoy + 1 // +1 to include today

        val diario = disponibleDiarioCop ?: Math.floor(totalCuentas.toDouble() / diasRestantes).toLong()

        return AsesorResponse(
            "Te quedan **$diasRestantes días** para que acabe el mes y tienes **\$${milesEsCo(totalCuentas)}** en tus cuentas. \n\nSi quieres que esa plata te alcance hasta fin de mes, tu presupuesto diario calculado por LukApp es de **\$${milesEsCo(diario)} diarios**.",
            newContext,
        )
    }

    // 3.6. Gastos Recurrentes / Suscripciones
    if (
        norm.contains("suscripciones") ||
        norm.contains("gastos fijos") ||
        norm.contains("pagos recurrentes")
    ) {
        class Conteo(var occurrences: Int, var amount: Long, var lastDate: String)
        val counts = LinkedHashMap<String, Conteo>()

        // Agrupar por descripción exacta
        transacciones
            .filter { it.kind == "gasto" && it.description.length > 3 }
            .forEach { t ->
                val d = t.description.trimJs().lowercase()
                val conteo = counts.getOrPut(d) { Conteo(0, t.amountCop, t.occurredOn) }
                conteo.occurrences += 1
                // Actualizar a la cantidad más reciente
                if (t.occurredOn > conteo.lastDate) {
                    conteo.amount = t.amountCop
                    conteo.lastDate = t.occurredOn
                }
            }

        val recurrentes = counts.entradasJs()
            .filter { it.second.occurrences >= 2 }
            .sortedByDescending { it.second.amount }

        if (recurrentes.isEmpty()) {
            return AsesorResponse("No he detectado suscripciones ni gastos fijos que se repitan en tu historial por ahora.", newContext)
        }

        val sumaRecurrente = recurrentes.sumOf { it.second.amount }
        var text = "Detecté **${recurrentes.size} gastos recurrentes** en tu historial (suscripciones o pagos frecuentes). \n\nCalculo que esto te cuesta aproximadamente **\$${milesEsCo(sumaRecurrente)}** cada mes:\n"

        recurrentes.take(5).forEach { (nombre, data) ->
            text += "• **$nombre**: \$${milesEsCo(data.amount)}\n"
        }

        if (recurrentes.size > 5) text += "• ...y otros ${recurrentes.size - 5} gastos menores.\n"

        return AsesorResponse(text, newContext, suggestions = listOf("Dame un consejo", "Resumen del mes"))
    }

    // 3.7. Analítica Profunda / Anomaly Detection ("sorprendeme", "dato curioso", "algo raro")
    if (RE_SORPRENDEME.containsMatchIn(norm)) {
        if (transacciones.size < 10) {
            return AsesorResponse(
                "Aún no tienes suficientes transacciones para que mi motor analítico encuentre patrones interesantes. ¡Registra más gastos!",
                newContext,
            )
        }

        val gastos = transacciones.filter { it.kind == "gasto" }
        val avg = gastos.sumOf { it.amountCop }.toDouble() / gastos.size

        val byDayOfWeek = LongArray(7) // 0 = Sunday
        gastos.forEach { t ->
            // `new Date('YYYY-MM-DD')` corrido a la hora local: el día de la semana del propio día calendario.
            val dia = runCatching { deIso(t.occurredOn).dayOfWeek.value % 7 }.getOrNull() ?: return@forEach
            byDayOfWeek[dia] += t.amountCop
        }

        val maxDayIdx = byDayOfWeek.indexOf(byDayOfWeek.max())
        val dayName = DIAS_NOMBRES[maxDayIdx]

        val anomaly = gastos.firstOrNull { it.amountCop > avg * 4 } // Gastó 4x el promedio

        val descFreq = LinkedHashMap<String, Int>()
        gastos.forEach { descFreq[it.description] = (descFreq[it.description] ?: 0) + 1 }
        val sortedFreq = descFreq.entradasJs().sortedByDescending { it.second }
        val topFreq = sortedFreq.getOrNull(0)
        val top2Freq = sortedFreq.getOrNull(1)

        val insights = mutableListOf<String>()

        insights.add("**Tu día más caro:** históricamente, el día de la semana en el que más dinero gastas es el **$dayName**. Considera dejar la tarjeta en casa ese día.")

        if (anomaly != null) {
            insights.add("**Gasto inusual:** el ${anomaly.occurredOn} gastaste **\$${milesEsCo(anomaly.amountCop)}** en \"${anomaly.description}\" — muy por encima de tu promedio normal por compra (\$${milesEsCo(Math.round(avg))}).")
        }

        if (topFreq != null && topFreq.second > 3) {
            insights.add("**Frecuencia constante:** has pagado por \"${topFreq.first}\" un total de **${topFreq.second} veces**. Ese es tu gasto hormiga más silencioso.")
        }

        if (top2Freq != null && top2Freq.second > 2) {
            insights.add("**Otro gasto frecuente:** \"${top2Freq.first}\" se repite mucho en tu historial (lo has pagado ${top2Freq.second} veces). Si lo recortas a la mitad, verás crecer tu ahorro.")
        }

        val intros = listOf(
            "Me metí en tus datos y encontré esto:",
            "Mira este patrón en tus finanzas:",
            "Analizando tu historial de gastos, hay algo que me llamó la atención:",
            "Aquí tienes un dato curioso sobre cómo manejas tu dinero:",
        )

        val idx = (context.ultimoIndiceDato ?: 0) % insights.size
        val selectedInsight = insights[idx]

        newContext = newContext.copy(ultimoIndiceDato = idx + 1)

        return AsesorResponse(
            "${elegir(intros, azar)}\n\n$selectedInsight",
            newContext,
            suggestions = listOf("Dame otro dato", "Mis suscripciones", "Dame un consejo"),
        )
    }

    // 4. Analizar intención usando ParseTransaction (extraído a detectarMovimiento,
    // que es la misma puerta que usa AsesorView cuando responde el LLM).
    val isQuestion =
        norm.contains("cuanto") ||
            norm.contains("cual") ||
            norm.contains("?") ||
            norm.contains("total") ||
            norm.contains("dime")

    val deteccion = detectarMovimiento(texto, transacciones, cajitas, categorias, lexico, context, ahora)
    val intent = deteccion.intent
    // En la web es `Object.assign(newContext, deteccion.newContext)`: el contexto de la
    // detección parte de una copia de `context`, así que lo sobrescribe entero.
    newContext = deteccion.newContext

    if (deteccion.propuesta != null) {
        return AsesorResponse(
            deteccion.propuesta.text,
            newContext,
            action = deteccion.propuesta.action,
            actions = deteccion.propuesta.actions,
        )
    }

    // 4.3 Missing amount fallback
    if (
        !isQuestion &&
        (intent.amount == null || intent.amount == 0L) &&
        (norm.contains("gaste") ||
            norm.contains("compre") ||
            norm.contains("pague") ||
            norm.contains("costo") ||
            norm.contains("cobraron") ||
            norm.contains("me pagaron") ||
            RE_FUI_A.containsMatchIn(norm))
    ) {
        return AsesorResponse(
            "¡Entiendo! Pero me faltó el dato más importante: ¿cuánto fue el monto exacto? Dímelo y lo registro de inmediato en ${if (intent.category != "otros") intent.category else "tus cuentas"}.",
            newContext,
        )
    }

    // 5. Preguntas de Gastos Contextuales
    if (isQuestion || norm.contains("gasto") || norm.contains("gaste") || norm.contains("gastos")) {
        var filtered: List<Transaccion> = transacciones

        // Use Context Date or Intent Date
        var filterDate: String? = intent.dateOverride?.takeIf { it.isNotEmpty() }
        if (filterDate == null && (norm.contains("y ayer") || norm.contains("y hoy"))) {
            // Si dice "y ayer", el parser ya debería haber puesto la fecha; no se inyecta nada.
        } else if (filterDate == null && !context.ultimaFecha.isNullOrEmpty() && RE_Y_EN.containsMatchIn(norm)) {
            // Si dice "y en comida?" y veniamos hablando de una fecha especifica, la mantenemos.
            filterDate = context.ultimaFecha
        }

        if (filterDate != null) {
            val fecha: String = filterDate
            filtered = filtered.filter { it.occurredOn == fecha }
            newContext = newContext.copy(ultimaFecha = fecha)
        } else if (norm.contains("mes pasado") || norm.contains("mes anterior")) {
            val lmKey = mesAnteriorJs(anioHoy, mesHoy, diaHoy)
            filtered = filtered.filter { it.occurredOn.startsWith(lmKey) }
            newContext = newContext.copy(ultimaFecha = lmKey)
            filterDate = lmKey
        } else if (norm.contains("año pasado")) {
            val ly = (anioHoy - 1).toString()
            filtered = filtered.filter { it.occurredOn.startsWith(ly) }
            newContext = newContext.copy(ultimaFecha = ly)
            filterDate = ly
        } else if (norm.contains("este año") || norm.contains("el año")) {
            val cy = anioHoy.toString()
            filtered = filtered.filter { it.occurredOn.startsWith(cy) }
            newContext = newContext.copy(ultimaFecha = cy)
            filterDate = cy
        } else {
            filtered = filtered.filter { it.occurredOn.startsWith(mesActual) }
            newContext = newContext.copy(ultimaFecha = null)
        }

        // Use Context Category or Intent Category
        var asunto = "total"

        // Fuzzy match manual si no hay signals directos del parser
        val palabras = norm.split(" ")
        var fuzzyCat: String? = null
        val catNombres = categorias.map { normalizarNombre(it.nombre) }
        for (p in palabras) {
            if (p.length < 4) continue
            // Levenshtein simplificado o startsWith/endsWith
            val match = catNombres.firstOrNull { it.contains(p) || p.contains(it) || it == p }
            if (match != null) {
                fuzzyCat = categorias.firstOrNull { normalizarNombre(it.nombre) == match }?.id?.takeIf { it.isNotEmpty() } ?: match
                break
            }
        }

        // `intent.description` es lo que le sobró al parser después de sacar el monto y la
        // fecha — para "cuánto gasté ayer" eso es literalmente "Cuanto gaste", puro relleno
        // de la pregunta. Comparar la FRASE completa contra palabras sueltas nunca coincidía
        // y filtraba todo el historial a cero; ahora se descarta si CADA palabra de lo que
        // quedó es puro relleno de pregunta.
        val isMeaningfulDescription =
            intent.description.isNotEmpty() &&
                intent.description.length > 2 &&
                !normalizarNombre(intent.description).split(" ").all { it in RELLENO_PREGUNTA }
        val fuzzy = fuzzyCat?.takeIf { it.isNotEmpty() }

        if (intent.signals.categorySource != "default" || isMeaningfulDescription || fuzzy != null) {
            val catFinal = if (intent.signals.categorySource != "default") intent.category else fuzzy ?: intent.category
            val descNorm = normalizarNombre(intent.description)
            filtered = filtered.filter { t ->
                t.category == catFinal ||
                    (isMeaningfulDescription &&
                        (normalizarNombre(t.description).contains(descNorm) ||
                            (t.rawTranscript.isNotEmpty() && normalizarNombre(t.rawTranscript).contains(descNorm)))) ||
                    (fuzzy != null && t.category == fuzzy)
            }
            asunto = if (intent.signals.categorySource != "default") intent.category
            else fuzzy ?: intent.description.ifEmpty { "varios" }
            newContext = newContext.copy(ultimoAsunto = asunto)
        } else if (!context.ultimoAsunto.isNullOrEmpty() && RE_Y_ESTE_MES.containsMatchIn(norm)) {
            // Si dice "y este mes?" y veniamos hablando de comida, recordamos comida.
            filtered = filtered.filter { it.category == context.ultimoAsunto }
            asunto = context.ultimoAsunto
        }

        val tipo = if (norm.contains("ingreso") || norm.contains("gane") || norm.contains("recibi")) "ingreso" else "gasto"
        filtered = filtered.filter { it.kind == tipo }

        val total = filtered.sumOf { it.amountCop }

        var fechaStr = if (filterDate != null) {
            if (filterDate.length == 7) "en el mes de $filterDate"
            else if (filterDate.length == 4) "en el año $filterDate"
            else "el $filterDate"
        } else "este mes"
        if (norm.contains("año pasado")) fechaStr = "el año pasado"
        else if (norm.contains("mes pasado") || norm.contains("mes anterior")) fechaStr = "el mes pasado"

        val concepto = if (asunto == "total") "general" else "**$asunto**"

        if (filtered.isEmpty()) {
            val varsCero = if (tipo == "ingreso") VARIANCES_CERO_INGRESO else VARIANCES_CERO_GASTO
            var cuerpo = elegir(varsCero, azar)
            cuerpo = reemplazarPrimeroJs(cuerpo, "X", milesEsCo(total))
            cuerpo = reemplazarPrimeroJs(cuerpo, "Y", concepto)
            cuerpo = reemplazarPrimeroJs(cuerpo, "Z", fechaStr)
            return AsesorResponse(cuerpo, newContext)
        }

        // Top contact/comment within this specific search!
        val porContacto = LinkedHashMap<String, Long>()
        filtered.forEach { t ->
            val desc = t.description.trimJs().ifEmpty { "Sin descripción" }
            porContacto[desc] = (porContacto[desc] ?: 0L) + t.amountCop
        }
        val topContacto = porContacto.entradasJs().sortedByDescending { it.second }.firstOrNull()

        var drilldown = ""
        if (
            topContacto != null &&
            topContacto.second > 0 &&
            topContacto.first != "Sin descripción" &&
            !isMeaningfulDescription
        ) {
            drilldown = "\n\nDe esos \$${milesEsCo(total)}, la mayor parte se fue en **\"${topContacto.first}\"** (\$${milesEsCo(topContacto.second)})."
        }

        // Comparativa con el mes pasado a la misma fecha.
        var tendencia = ""
        if (tipo == "gasto" && filterDate == null && !norm.contains("año")) {
            val lmKey = mesAnteriorJs(anioHoy, mesHoy, diaHoy)

            val descNorm = normalizarNombre(intent.description)
            val lastMonthTotal = transacciones
                .filter { t ->
                    t.occurredOn.startsWith(lmKey) &&
                        t.kind == "gasto" &&
                        (asunto == "total" ||
                            t.category == asunto ||
                            (isMeaningfulDescription && normalizarNombre(t.description).contains(descNorm)))
                }
                .sumOf { it.amountCop }

            if (lastMonthTotal > 0) {
                val diff = total - lastMonthTotal
                tendencia = if (diff > 0) "(Van **\$${milesEsCo(Math.abs(diff))} más** que el mes pasado a esta misma fecha)."
                else "(Van **\$${milesEsCo(Math.abs(diff))} menos** que el mes pasado a esta fecha)."
            }
        }

        val varsFinal = if (tipo == "ingreso") VARIANCES_INGRESO else VARIANCES_GASTO
        var cuerpo = elegir(varsFinal, azar)
        cuerpo = reemplazarPrimeroJs(cuerpo, "X", milesEsCo(total))
        cuerpo = reemplazarPrimeroJs(cuerpo, "Y", concepto)
        cuerpo = reemplazarPrimeroJs(cuerpo, "Z", fechaStr)
        return AsesorResponse(
            cuerpo + " (Eso fue en ${filtered.size} transacciones). $tendencia" + drilldown,
            newContext,
            suggestions = if (topContacto != null && topContacto.first != "Sin descripción") listOf("¿Y el mes pasado?", "¿Cuánto puedo gastar?")
            else listOf("Dime mi resumen", "Dame un consejo"),
        )
    }

    // Fallback a LLM-like
    if (norm.length > 30 && !norm.contains("gaste") && !norm.contains("gastado")) {
        return AsesorResponse(
            "¡Esa es una pregunta profunda! Como soy una IA local basada en reglas, soy experto en buscar sumas, fechas y gastos exactos, pero me cuesta leer párrafos muy largos. Prueba preguntándome montos o resúmenes directos.",
            newContext,
            // Sin esta marca el Asesor la tomaba como respuesta instantánea y nunca
            // consultaba la IA: justo las preguntas largas, las que más la necesitan.
            sinRespuestaPropia = true,
        )
    }

    // ELIZA-like Chitchat Fallback
    for (regla in REGLAS_CHARLA) {
        if (regla.regex.containsMatchIn(norm)) {
            return AsesorResponse(
                elegir(regla.respuestas, azar),
                newContext,
                suggestions = listOf("Dime mi resumen", "¿Cuánto puedo gastar?"),
            )
        }
    }

    // Fallback final
    return AsesorResponse(
        elegir(
            listOf(
                "No logré entender eso último. Mi fuerte son los números, sumas y fechas — pregúntame por tu saldo, tu resumen del mes, o dime directamente un gasto para registrarlo.",
                "Sigo aprendiendo a conversar. Con instrucciones más directas, como \"cuánto gasté en Rappi\" o \"resumen de mis cuentas\", te ayudo de inmediato.",
                "No estoy seguro de haber entendido bien. Soy mejor para las cuentas claras — prueba preguntarme montos, resúmenes, o dime qué gastaste hoy para registrarlo.",
            ),
            azar,
        ),
        newContext,
        suggestions = SUGERENCIAS_FALLBACK,
    )
}
