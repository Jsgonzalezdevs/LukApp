package app.lukapp.dominio.voz

import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.Transaccion
import java.time.LocalDate

/*
 * Origen: src/features/lukapp/lib/parseMultipleTransactions.ts
 */

private val RE_UNO_Y_QUINIENTOS = js("""\b(\d{1,3})\s+y\s+(\d{3})(?=\s+(?:pesos?|cop)\b)""", "gi")
private val RE_CLAUSULA_PRECIO =
    js("""\b(?:que\s+)?me\s+(?:costo|costó|costaron|valio|valió|valieron|salio|salió|salieron)\b""", "i")
private val RE_TOTAL_UNICO = js(
    """(?:^|\s)(?:compre|compré|pedi|pedí|gaste|gasté|pague|pagué)(?:\s|$)[\s\S]*\by\b[\s\S]*\b(?:por|en\s+total)\s+\$?\s*(?:\d+|un(?:a)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b""",
    "i",
)
private val RE_LINEAS = js("""\r?\n+""")
private val RE_CONECTORES = js(
    """(?:\s+(?:y|e|además|ademas|también|tambien|luego)\s+)|(?:\s*,\s*(?=(?:[0-9]|gaste|gasté|pague|pagué|recibi|recibí|compre|compré|transferi|transferí|meti|metí|saque|saqué|me entraron|me pagaron)(?!.*(?:que\s+(?:me\s+)?(?:valio|valió|costo|costó)))))""",
    "i",
)

/**
 * Detecta si una frase trae varios movimientos unidos por «y», «además»,
 * «también», comas o saltos de línea («15 mil de taxi y 30 mil de almuerzo»).
 *
 * Si hay 2 o más partes con monto válido devuelve la lista; si es un
 * movimiento normal devuelve una lista de uno.
 */
fun parseMultipleTransactions(
    raw: String,
    cajitas: List<CuentaConocida> = emptyList(),
    categorias: List<CategoriaPersonal> = emptyList(),
    lexico: LexicoAprendido = LEXICO_VACIO,
    historial: List<Transaccion> = emptyList(),
    hoy: LocalDate = hoyEnBogota(),
): List<ParsedTransaction> {
    val trimmed = raw.trimJs()
    if (trimmed.isEmpty()) return emptyList()

    fun leer(texto: String) = parseTransaction(texto, cajitas, categorias, lexico, historial, hoy)

    // Whisper a veces deja un monto corto como «1 y 500 pesos». En un dictado
    // financiero eso casi siempre es $1.500, no dos gastos de $1 y $500. Solo
    // se toca la copia que se analiza: `raw` sigue siendo lo que dijo la persona.
    val texto = trimmed.reemplazarTodos(RE_UNO_Y_QUINIENTOS, "$1 mil $2")

    if (texto.startsWith("[OCR]")) return listOf(leer(texto))

    // Una cláusula de precio explica el mismo movimiento: «me gasté 3 cafés con
    // leche que me costó 7.500» es una sola compra, no gastos de 3 y 7.500.
    if (RE_CLAUSULA_PRECIO.containsMatchIn(texto)) return listOf(leer(texto))

    // Varios productos unidos por «y» con una sola cifra final marcada con
    // «por» o «en total» son una sola compra; partirla daría $2 por dos pizzas.
    if (RE_TOTAL_UNICO.containsMatchIn(texto)) return listOf(leer(texto))

    // 1. Saltos de línea (si pegó varias líneas).
    val lineas = texto.split(RE_LINEAS).map { it.trimJs() }.filter { it.isNotEmpty() }
    if (lineas.size > 1) {
        val parseadas = lineas.map(::leer).filter { it.amount != null && it.amount > 0 }
        if (parseadas.size >= 2) return parseadas
    }

    // 2. Conectores naturales colombianos, sin partir «que me valió 10 mil».
    val partes = texto.split(RE_CONECTORES)
    if (partes.size > 1) {
        val candidatas = partes.map { it.trimJs() }.filter { it.isNotEmpty() }.map(::leer)
        // Solo es múltiple si al menos dos partes traen monto reconocido.
        val conMonto = candidatas.filter {
            it.amount != null && it.amount > 0 && it.signals.amountSource != AmountSource.NONE
        }
        if (conMonto.size >= 2) return conMonto
    }

    // 3. Respaldo: un solo movimiento.
    return listOf(leer(texto).copy(raw = trimmed))
}
