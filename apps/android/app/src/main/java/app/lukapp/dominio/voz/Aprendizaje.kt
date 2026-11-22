package app.lukapp.dominio.voz

import app.lukapp.dominio.Transaccion

/*
 * Lo que el intérprete aprende del propio libro del usuario.
 * Origen: src/features/lukapp/lib/aprendizaje.ts
 *
 * Cada movimiento guarda el texto dictado y la categoría confirmada. De ese par
 * sale, sin listas a mano, qué categoría suele tener cada palabra PARA ESTA
 * PERSONA. Es completamente local: sale de datos que ya tiene.
 */

interface LexicoAprendido {
    /** La categoría que esta palabra suele tener para ti, o null si no hay señal. */
    fun categoriaDe(norm: String): String?

    /** Cuántas palabras alcanzaron evidencia suficiente. Para inspección. */
    val tamano: Int
}

/** Palabras demasiado cortas no distinguen nada; se ignoran. */
private const val LARGO_MIN = 3

/** En cuántos movimientos distintos hay que haber visto la palabra para fiarse. */
private const val MIN_EVIDENCIA = 2

/** A 0.6 un empate (0.5) nunca gana: hace falta que una categoría predomine. */
private const val CUOTA_DOMINANTE = 0.6

private val RE_ESPACIOS_LEX = js("""\s+""")
private val RE_BORDE_INICIO = js("""^[^\p{L}\p{N}$]+""", "u")
private val RE_BORDE_FIN = js("""[^\p{L}\p{N}]+$""", "u")
private val RE_SOLO_DIGITOS = js("""^\d+$""")

/**
 * Las palabras con contenido: fuera el monto, la dirección, los conectores y
 * los numerales. Lo que queda es lo que dice de qué fue el movimiento.
 */
private fun palabrasContenido(raw: String): List<String> {
    val out = mutableListOf<String>()
    for (piece in raw.split(RE_ESPACIOS_LEX)) {
        val trimmed = piece.reemplazarPrimero(RE_BORDE_INICIO, "").reemplazarPrimero(RE_BORDE_FIN, "")
        if (trimmed.isEmpty()) continue
        val norm = normalizeWord(trimmed)
        if (norm.length < LARGO_MIN) continue
        if (norm in STOPWORDS || norm in KIND_WORDS || norm in NUMERAL_WORDS) continue
        if (RE_SOLO_DIGITOS.containsMatchIn(norm)) continue
        out.add(norm)
    }
    return out
}

/**
 * Arma el léxico a partir del historial.
 *
 * Se cuenta en cuántos MOVIMIENTOS aparece cada palabra por categoría, no
 * cuántas veces se dijo: «café café café» en una frase no pesa como tres días.
 */
fun aprenderDe(transacciones: List<Transaccion>): LexicoAprendido {
    val conteo = LinkedHashMap<String, LinkedHashMap<String, Int>>()
    for (tx in transacciones) {
        if (tx.rawTranscript.isEmpty()) continue
        for (palabra in LinkedHashSet(palabrasContenido(tx.rawTranscript))) {
            val porCat = conteo.getOrPut(palabra) { LinkedHashMap() }
            porCat[tx.category] = (porCat[tx.category] ?: 0) + 1
        }
    }

    val resuelto = HashMap<String, String>()
    for ((palabra, porCat) in conteo) {
        var total = 0
        var mejor = ""
        var mejorN = 0
        for ((cat, n) in porCat) {
            total += n
            if (n > mejorN) {
                mejorN = n
                mejor = cat
            }
        }
        if (mejorN >= MIN_EVIDENCIA && mejorN.toDouble() / total >= CUOTA_DOMINANTE) {
            resuelto[palabra] = mejor
        }
    }

    return object : LexicoAprendido {
        override fun categoriaDe(norm: String): String? = resuelto[norm]
        override val tamano: Int = resuelto.size
    }
}

/** Un léxico vacío, para cuando todavía no hay historia de la cual aprender. */
val LEXICO_VACIO: LexicoAprendido = object : LexicoAprendido {
    override fun categoriaDe(norm: String): String? = null
    override val tamano: Int = 0
}
