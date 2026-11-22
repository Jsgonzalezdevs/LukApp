package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Origen: src/features/lukapp/lib/numerals.test.ts */
class NumeralesTest {

    // normalizeNumericToken
    @Test fun `punto seguido de tres digitos es separador de miles`() {
        assertEquals(listOf("45000"), normalizeNumericToken("45.000"))
        assertEquals(listOf("1250000"), normalizeNumericToken("1.250.000"))
    }

    @Test fun `punto seguido de uno o dos digitos es decimal`() {
        assertEquals(listOf("45.5"), normalizeNumericToken("45.5"))
    }

    @Test fun `la coma decimal es-CO pasa a punto`() {
        assertEquals(listOf("45.5"), normalizeNumericToken("45,5"))
    }

    @Test fun `expande el apostrofo de millones`() {
        assertEquals(listOf("1200000"), normalizeNumericToken("1'200.000"))
    }

    @Test fun `parte un digito pegado a una escala`() {
        assertEquals(listOf("20", "mil"), normalizeNumericToken("20mil"))
        assertEquals(listOf("45", "k"), normalizeNumericToken("45k"))
        assertEquals(listOf("2", "millones"), normalizeNumericToken("2millones"))
    }

    @Test fun `quita el ruido de moneda`() {
        assertEquals(listOf("20"), normalizeNumericToken("\$20"))
        assertEquals(emptyList<String>(), normalizeNumericToken("cop"))
    }

    @Test fun `deja intactas las palabras normales`() {
        assertEquals(listOf("almuerzo"), normalizeNumericToken("almuerzo"))
    }

    // normalizeWord
    @Test fun `minusculas y sin tildes`() {
        assertEquals("exito", normalizeWord("Éxito"))
        assertEquals("millon", normalizeWord("MILLÓN"))
        assertEquals("olimpica", normalizeWord("Olímpica"))
    }

    // parseAmount — dígitos y escalas
    @Test fun `digito con escala`() {
        assertEquals(20000L, parseAmount("20 mil"))
        assertEquals(20000L, parseAmount("20mil"))
        assertEquals(20000L, parseAmount("20 MIL"))
    }

    @Test fun `sufijo k`() {
        assertEquals(45000L, parseAmount("45k"))
        assertEquals(45000L, parseAmount("45 k"))
        assertEquals(45000L, parseAmount("45K"))
    }

    @Test fun `puntuacion es-CO`() {
        assertEquals(45000L, parseAmount("45.000"))
        assertEquals(1250000L, parseAmount("1.250.000"))
        assertEquals(1200000L, parseAmount("1'200.000"))
    }

    // parseAmount — palabras
    @Test fun `unidades, decenas irregulares y veintes`() {
        assertEquals(15L, parseAmount("quince"))
        assertEquals(21L, parseAmount("veintiuno"))
        assertEquals(23L, parseAmount("veintitrés"))
    }

    @Test fun `decenas unidas por y`() {
        assertEquals(35L, parseAmount("treinta y cinco"))
        assertEquals(99L, parseAmount("noventa y nueve"))
    }

    @Test fun centenas() {
        assertEquals(100L, parseAmount("cien"))
        assertEquals(120L, parseAmount("ciento veinte"))
        assertEquals(500L, parseAmount("quinientos"))
        assertEquals(999L, parseAmount("novecientos noventa y nueve"))
    }

    @Test fun femeninos() {
        assertEquals(200000L, parseAmount("doscientas mil"))
        assertEquals(500L, parseAmount("quinientas"))
        assertEquals(1L, parseAmount("una"))
    }

    @Test fun `no le importan las tildes`() {
        assertEquals(parseAmount("millón"), parseAmount("millon"))
        assertEquals(parseAmount("veintitrés mil"), parseAmount("veintitres mil"))
    }

    // la máquina de tres registros
    @Test fun `una escala sola vale uno de ella`() {
        assertEquals(1000L, parseAmount("mil"))
        assertEquals(1000000L, parseAmount("un millón"))
    }

    @Test fun `grupos de miles`() {
        assertEquals(15000L, parseAmount("quince mil"))
        assertEquals(2500L, parseAmount("dos mil quinientos"))
        assertEquals(120000L, parseAmount("ciento veinte mil"))
        assertEquals(35000L, parseAmount("treinta y cinco mil"))
        assertEquals(999999L, parseAmount("novecientos noventa y nueve mil novecientos noventa y nueve"))
    }

    // El caso que dos registros no pueden representar.
    @Test fun `grupo de millones con grupo de miles`() {
        assertEquals(1200000L, parseAmount("un millón doscientos mil"))
        assertEquals(3500000L, parseAmount("tres millones quinientos mil"))
        assertEquals(1000000000L, parseAmount("mil millones"))
    }

    @Test fun `mezcla digitos y palabras`() {
        assertEquals(1200000L, parseAmount("1 millón 200 mil"))
    }

    // jerga
    @Test fun `luca palo y melon son escalas`() {
        assertEquals(20000L, parseAmount("20 lucas"))
        assertEquals(20000L, parseAmount("veinte lucas"))
        assertEquals(50000L, parseAmount("50 luquitas"))
        assertEquals(2000000L, parseAmount("2 palos"))
        assertEquals(1000000L, parseAmount("un melón"))
    }

    @Test fun `miles implicitos despues de millones`() {
        assertEquals(2400000L, parseAmount("dos millones cuatrocientos"))
        assertEquals(3500000L, parseAmount("tres palos quinientos"))
        assertEquals(1200000L, parseAmount("un palo doscientos"))
        assertEquals(2100000L, parseAmount("dos millones cien"))
    }

    @Test fun `abreviatura m de millones`() {
        assertEquals(2500000L, parseAmount("2.5m"))
        assertEquals(2500000L, parseAmount("2,5m"))
        assertEquals(1200000L, parseAmount("1.2m"))
        assertEquals(3000000L, parseAmount("3m"))
    }

    // mitades y decimales
    @Test fun `medio y cuarto aplicados a una escala`() {
        assertEquals(500000L, parseAmount("medio millón"))
        assertEquals(250000L, parseAmount("cuarto de millón"))
        assertEquals(500L, parseAmount("media luca"))
    }

    @Test fun `decimal por su escala`() {
        assertEquals(45500L, parseAmount("45,5 mil"))
        assertEquals(1500000L, parseAmount("1,5 millones"))
    }

    @Test fun `y medio final divide la escala anterior`() {
        assertEquals(2500000L, parseAmount("dos millones y medio"))
        assertEquals(2500L, parseAmount("dos mil y medio"))
    }

    // rechazos
    @Test fun `null sin numeral`() {
        assertNull(parseAmount(""))
        assertNull(parseAmount("hola"))
        assertNull(parseAmount("plata"))
        assertNull(parseAmount("y"))
    }

    @Test fun `null para cero y para una mitad suelta`() {
        assertNull(parseAmount("0"))
        assertNull(parseAmount("cero"))
        assertNull(parseAmount("medio"))
    }

    @Test fun `null por encima del tope`() {
        assertNull(parseAmount("99999999999999"))
    }

    @Test fun `para en un segundo numeral en vez de unirlos`() {
        assertEquals(20000L, parseAmount("20 mil 30 mil"))
        assertEquals(2000000L, parseAmount("2 millones 3 millones"))
    }

    @Test fun `lee unidades que siguen a una escala`() {
        assertEquals(2500L, parseAmount("2 mil 500"))
        assertEquals(1500L, parseAmount("mil quinientos"))
    }

    // pureza
    @Test fun `mismo resultado para la misma entrada`() {
        val input = "un millón doscientos mil"
        assertEquals(parseAmount(input), parseAmount(input))
    }

    // NUMERAL_WORDS
    @Test fun `cubre toda palabra que el lector consume`() {
        for (w in listOf("mil", "millon", "lucas", "palo", "medio", "quince", "veinte", "cien", "y", "k")) {
            assertTrue(w, w in NUMERAL_WORDS)
        }
    }

    @Test fun `ya viene normalizado`() {
        for (w in NUMERAL_WORDS) assertEquals(normalizeWord(w), w)
    }
}
