package app.lukapp.dominio.voz

import java.text.Normalizer

/*
 * Lector de numerales en español de Colombia.
 * Origen: src/features/lukapp/lib/numerals.ts
 *
 * Dígitos y palabras pasan por UNA sola máquina de estados, así que `20 mil`,
 * `veinte mil`, `20mil` y `20 lucas` siguen el mismo camino: no hay un segundo
 * código que mantener sincronizado.
 */

private val UNIDADES: Map<String, Int> = linkedMapOf(
    "cero" to 0, "un" to 1, "uno" to 1, "una" to 1, "dos" to 2, "tres" to 3,
    "cuatro" to 4, "cinco" to 5, "seis" to 6, "siete" to 7, "ocho" to 8,
    "nueve" to 9, "diez" to 10, "once" to 11, "doce" to 12, "trece" to 13,
    "catorce" to 14, "quince" to 15, "dieciseis" to 16, "diecisiete" to 17,
    "dieciocho" to 18, "diecinueve" to 19, "veintiuno" to 21, "veintiun" to 21,
    "veintiuna" to 21, "veintidos" to 22, "veintitres" to 23, "veinticuatro" to 24,
    "veinticinco" to 25, "veintiseis" to 26, "veintisiete" to 27,
    "veintiocho" to 28, "veintinueve" to 29,
)

private val DECENAS: Map<String, Int> = linkedMapOf(
    "veinte" to 20, "treinta" to 30, "cuarenta" to 40, "cincuenta" to 50,
    "sesenta" to 60, "setenta" to 70, "ochenta" to 80, "noventa" to 90,
)

private val CENTENAS: Map<String, Int> = linkedMapOf(
    "cien" to 100, "ciento" to 100, "doscientos" to 200, "doscientas" to 200,
    "trescientos" to 300, "trescientas" to 300, "cuatrocientos" to 400,
    "cuatrocientas" to 400, "quinientos" to 500, "quinientas" to 500,
    "seiscientos" to 600, "seiscientas" to 600, "setecientos" to 700,
    "setecientas" to 700, "ochocientos" to 800, "ochocientas" to 800,
    "novecientos" to 900, "novecientas" to 900,
)

// La jerga de plata colombiana entra como una palabra de escala más: una
// "luca" son mil pesos, un "palo"/"melón" un millón.
private val PALABRAS_MIL = listOf("mil", "miles", "luca", "lucas", "luquita", "luquitas", "barra", "barras", "k")
private val PALABRAS_MILLON = listOf("millon", "millones", "palo", "palos", "melon", "melones", "m")
private val PALABRAS_JERGA: Set<String> = setOf(
    "luca", "lucas", "luquita", "luquitas", "barra", "barras", "palo", "palos", "melon", "melones",
)

internal val ESCALAS: Map<String, Long> = LinkedHashMap<String, Long>().apply {
    for (w in PALABRAS_MIL) put(w, 1_000L)
    for (w in PALABRAS_MILLON) put(w, 1_000_000L)
}

private val MITADES: Map<String, Double> = linkedMapOf(
    "medio" to 0.5, "media" to 0.5, "cuarto" to 0.25, "cuarta" to 0.25,
)

private const val CONECTOR = "y"

/**
 * Todo lo que el lector de numerales puede consumir. Las palabras de categoría
 * y de dirección nunca deben chocar con este conjunto: `VocabularioTest` lo
 * comprueba, porque una palabra clave como `mil` corrompería montos en silencio.
 */
val NUMERAL_WORDS: Set<String> = LinkedHashSet<String>().apply {
    addAll(UNIDADES.keys)
    addAll(DECENAS.keys)
    addAll(CENTENAS.keys)
    addAll(ESCALAS.keys)
    addAll(MITADES.keys)
    add(CONECTOR)
}

private const val TOPE_MONTO = 1_000_000_000_000.0

private val RE_DIGITOS = js("""^\d+(?:\.\d+)?$""")
private val RE_DIACRITICOS = js("""[̀-ͯ]""")

fun stripAccents(value: String): String =
    Normalizer.normalize(value, Normalizer.Form.NFD).reemplazarTodos(RE_DIACRITICOS, "")

/** Minúsculas + sin tildes. Se aplica por token para que los índices no se corran. */
fun normalizeWord(value: String): String = stripAccents(value.lowercase())

private val RE_PESOS = js("""\$""")
private val RE_COP = js("""^cop$""")
private val RE_APOSTROFE = js("""(\d+)'(\d{3})(?:\.(\d{3}))?""")
private val RE_MILES_CON_PUNTO = js("""\d{1,3}(?:\.\d{3})+(?!\d)""")
private val RE_PUNTO = js("""\.""")
private val RE_COMA_DECIMAL = js("""(\d),(\d)""")
private val RE_PEGADO_A_ESCALA =
    js("""^(\d+(?:\.\d+)?)(mil|miles|millon|millones|lucas?|luquitas?|palos?|melones?|barras?|k|m)$""")

/**
 * Reescribe la notación numérica es-CO dentro de UN token ya en minúsculas y
 * sin tildes. Puede partirlo en dos (`20mil` -> `20`, `mil`).
 *
 * El punto es ambiguo de verdad en Colombia: `45.000` son cuarenta y cinco mil
 * pero `45.5` es un decimal. Regla: punto seguido de EXACTAMENTE tres dígitos
 * en una corrida agrupada es separador de miles; lo demás es decimal.
 */
fun normalizeNumericToken(token: String): List<String> {
    if (token == "$") return listOf("$")
    var t = token.reemplazarTodos(RE_PESOS, "").reemplazarPrimero(RE_COP, "")
    if (t == "") return emptyList()

    // 1'200.000 -> 1200000 (el apóstrofo es el separador de millones colombiano)
    t = RE_APOSTROFE.replace(t) { m ->
        m.groupValues[1] + m.groupValues[2] + (m.groups[3]?.value ?: "")
    }

    // 45.000 -> 45000, 1.250.000 -> 1250000
    t = RE_MILES_CON_PUNTO.replace(t) { m -> m.value.reemplazarTodos(RE_PUNTO, "") }

    // 45,5 -> 45.5 (la coma es el separador decimal en es-CO)
    t = t.reemplazarTodos(RE_COMA_DECIMAL, "$1.$2")

    // 20mil -> 20 mil, 45k -> 45 k, 2.5m -> 2.5 m
    val partido = RE_PEGADO_A_ESCALA.find(t)
    if (partido != null) return listOf(partido.groupValues[1], partido.groupValues[2])

    return listOf(t)
}

data class NumberMatch(
    val value: Long,
    /** Índice uno después del último token numérico consumido. */
    val next: Int,
    val hasScale: Boolean,
    val usedDigits: Boolean,
    val usedWords: Boolean,
    val usedSlang: Boolean,
)

/**
 * Lee el numeral más largo que empieza en `start`, o null si no hay.
 *
 * Hacen falta tres registros. Con dos no se puede representar «un millón
 * doscientos mil», porque el grupo de miles tiene que cerrarse aparte antes de
 * aplicar la escala de millón:
 *
 *   result     — millones en adelante, ya cerrados
 *   groupTotal — miles cerrados dentro del grupo del millón actual
 *   current    — el grupo en construcción (0..999, o un literal en dígitos)
 */
fun readNumberAt(tokens: List<String>, start: Int): NumberMatch? {
    var result = 0.0
    var groupTotal = 0.0
    var current = 0.0

    var hasScale = false
    var usedDigits = false
    var usedWords = false
    var usedSlang = false
    var sawAny = false
    var consumedUpTo = start
    // La última escala aplicada, para que un «y medio» final sepa qué divide.
    var lastScale = 0L
    // Dónde empezó el grupo que está en `current`, para devolvérselo al
    // siguiente numeral si resulta no ser de este. -1 = nada pendiente.
    var currentStart = -1

    var i = start
    while (i < tokens.size) {
        val t = tokens[i]

        if (t == CONECTOR) {
            // Solo tiene sentido entre numerales («treinta y cinco»). A propósito
            // no avanza consumedUpTo: una «y» final se queda en la descripción.
            if (!sawAny) break
            i += 1
            continue
        }

        if (t == "de") {
            // Une fracción o cuantificador a la escala («cuarto de millón»).
            if (sawAny && current > 0 && i + 1 < tokens.size && tokens[i + 1] in ESCALAS) {
                i += 1
                continue
            }
            break
        }

        val mitad = MITADES[t]
        if (mitad != null) {
            if (current == 0.0 && lastScale > 0) {
                // «dos millones y medio»: divide la escala recién aplicada.
                val medio = mitad * lastScale
                if (lastScale >= 1_000_000) result += medio else groupTotal += medio
            } else {
                // «medio millón», «un cuarto de millón»: espera en `current` a
                // que una escala lo multiplique.
                if (current == 0.0) {
                    currentStart = i
                    current = mitad
                } else if (current == 1.0) {
                    // «un cuarto» -> 0.25
                    current = mitad
                } else {
                    current += mitad
                }
            }
            usedWords = true
            sawAny = true
            consumedUpTo = i + 1
            i += 1
            continue
        }

        if (RE_DIGITOS.containsMatchIn(t)) {
            // Dos literales seguidos significan que empezó otro numeral («20 30»).
            if (current != 0.0) break
            currentStart = i
            current = t.toDouble()
            usedDigits = true
            sawAny = true
            consumedUpTo = i + 1
            i += 1
            continue
        }

        val palabra = UNIDADES[t] ?: DECENAS[t] ?: CENTENAS[t]
        if (palabra != null) {
            if (current == 0.0) currentStart = i
            current += palabra
            usedWords = true
            sawAny = true
            consumedUpTo = i + 1
            i += 1
            continue
        }

        val escala = ESCALAS[t]
        if (escala != null) {
            // El español aplica cada escala a lo sumo una vez por grupo, en orden
            // descendente. Si se repite, empezó otro numeral («20 mil 30 mil»):
            // se para y se devuelve el grupo pendiente, porque esos dígitos son
            // del numeral nuevo. Sin esa devolución se leería 20030.
            val repetida = if (escala == 1_000L) groupTotal != 0.0 else result != 0.0
            if (repetida) {
                if (currentStart >= 0) {
                    consumedUpTo = currentStart
                    current = 0.0
                }
                break
            }

            if (escala == 1_000L) {
                groupTotal += (if (current != 0.0) current else 1.0) * 1_000
            } else {
                val grupo = groupTotal + current
                result += (if (grupo != 0.0) grupo else 1.0) * 1_000_000
                groupTotal = 0.0
            }

            lastScale = escala
            current = 0.0
            currentStart = -1
            hasScale = true
            if (t in PALABRAS_JERGA) usedSlang = true
            sawAny = true
            consumedUpTo = i + 1
            i += 1
            continue
        }

        break
    }

    if (!sawAny) return null

    // Con millones dichos (result >= 1.000.000), sin grupo de miles y con un
    // número menor a mil al final («dos millones cuatrocientos», «un palo
    // trescientos»), en el habla colombiana ese número son miles (400 -> 400.000).
    var finalCurrent = current
    if (result >= 1_000_000 && groupTotal == 0.0 && current > 0 && current < 1_000) {
        finalCurrent = current * 1_000
    }

    val total = result + groupTotal + finalCurrent
    // Rechaza un «medio» suelto (0.5) pero conserva «medio millón».
    if (!hasScale && total < 1) return null

    val value = Math.round(total)
    if (value < 1 || value > TOPE_MONTO) return null

    return NumberMatch(value, consumedUpTo, hasScale, usedDigits, usedWords, usedSlang)
}

private val RE_ESPACIOS = js("""\s+""")

/** Atajo: lee un monto de un fragmento de texto libre. */
fun parseAmount(text: String): Long? {
    val tokens = text.split(RE_ESPACIOS)
        .filter { it.isNotEmpty() }
        .flatMap { normalizeNumericToken(normalizeWord(it)) }

    for (i in tokens.indices) {
        val match = readNumberAt(tokens, i)
        if (match != null) return match.value
    }
    return null
}
