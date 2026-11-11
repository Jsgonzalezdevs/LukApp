package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Origen: src/features/lukapp/lib/vocabulary.test.ts
 *
 * Los tests de más valor de la suite: una palabra clave que choca con un
 * numeral corrompe montos en silencio, y el síntoma aparece meses después.
 */
class VocabularioTest {
    private fun interseccion(a: Iterable<String>, b: Set<String>) = a.filter { it in b }

    @Test fun `ninguna palabra de categoria es numeral`() {
        assertEquals(emptyList<String>(), interseccion(CATEGORY_KEYWORDS.keys, NUMERAL_WORDS))
    }

    @Test fun `ninguna palabra de direccion es numeral`() {
        assertEquals(emptyList<String>(), interseccion(KIND_WORDS, NUMERAL_WORDS))
    }

    @Test fun `ninguna marca es numeral`() {
        assertEquals(emptyList<String>(), interseccion(MERCHANTS.keys, NUMERAL_WORDS))
    }

    @Test fun `ningun sustantivo de cantidad es numeral`() {
        assertEquals(emptyList<String>(), interseccion(COUNT_NOUNS, NUMERAL_WORDS))
    }

    private val todasLasClaves = CATEGORY_KEYWORDS.keys + MERCHANTS.keys + KIND_WORDS +
        COUNT_NOUNS + INCOME_IMPLIED + AMOUNT_CUES

    @Test fun `toda clave viene normalizada`() {
        assertEquals(emptyList<String>(), todasLasClaves.filter { it != normalizeWord(it) })
    }

    @Test fun `ninguna clave tiene varias palabras`() {
        assertEquals(emptyList<String>(), todasLasClaves.filter { js("""\s""").containsMatchIn(it) })
    }

    @Test fun `toda marca apunta a una categoria real`() {
        assertEquals(emptyList<String>(), MERCHANTS.entries.filter { it.value !in ETIQUETAS_CATEGORIA.keys }.map { it.key })
    }

    @Test fun `toda categoria salvo otros puede detectarse`() {
        val detectables = CATEGORY_KEYWORDS.values.toSet() + MERCHANTS.values.toSet()
        assertEquals(emptyList<String>(), ETIQUETAS_CATEGORIA.keys.filter { it != "otros" && it !in detectables })
    }

    @Test fun `solo hay nombres para mostrar de marcas existentes`() {
        assertEquals(emptyList<String>(), MERCHANT_DISPLAY.keys.filter { it !in MERCHANTS })
    }

    @Test fun `toda palabra de ingreso implicito es de la categoria ingreso`() {
        assertEquals(emptyList<String>(), INCOME_IMPLIED.filter { CATEGORY_KEYWORDS[it] != "ingreso" })
    }

    // Si una frase corta se probara antes, «me costó» calzaría como ingreso.
    @Test fun `KIND_PHRASES va de la mas larga a la mas corta`() {
        val largos = KIND_PHRASES.map { it.seq.size }
        assertEquals(largos.sortedDescending(), largos)
    }

    @Test fun `KIND_PHRASES no repite frases`() {
        val claves = KIND_PHRASES.map { it.seq.joinToString(" ") }
        assertEquals(claves.toSet().size, claves.size)
    }

    @Test fun `me costo va antes de toda regla de un token`() {
        val meCosto = KIND_PHRASES.indexOfFirst { it.seq.joinToString(" ") == "me costo" }
        val primeraSuelta = KIND_PHRASES.indexOfFirst { it.seq.size == 1 }
        assertTrue(meCosto >= 0)
        assertTrue(meCosto < primeraSuelta)
    }

    @Test fun `las trampas por pares quedan en lados opuestos`() {
        fun tipoDe(frase: String) = KIND_PHRASES.firstOrNull { it.seq.joinToString(" ") == frase }?.kind
        assertEquals("gasto", tipoDe("me costo"))
        assertEquals("ingreso", tipoDe("me pagaron"))
        assertEquals("gasto", tipoDe("pague"))
        assertEquals("gasto", tipoDe("abone"))
        assertEquals("ingreso", tipoDe("me abonaron"))
        assertEquals("gasto", tipoDe("consigne"))
        assertEquals("ingreso", tipoDe("me consignaron"))
    }
}
