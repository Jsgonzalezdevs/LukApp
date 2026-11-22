package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Casos de `lib/formatCop.test.ts`. */
class FormatoCopTest {
    @Test fun agrupaMilesConPuntos() {
        assertEquals("$1.234.567", formatCop(1234567L))
        assertEquals("$45.000", formatCop(45000L))
        assertEquals("$500", formatCop(500L))
        assertEquals("$0", formatCop(0L))
    }

    @Test fun redondeaAPesos() {
        assertEquals("$45.000", formatCop(45000.4))
        assertEquals("$45.001", formatCop(45000.6))
    }

    @Test fun signoFueraDelSimbolo() {
        assertEquals("-$45.000", formatCop(-45000L))
    }

    @Test fun ocultoEnmascara() {
        assertEquals("$ ••••••", formatCopOculto(1234567, true))
        assertEquals("$1.234.567", formatCopOculto(1234567, false))
    }

    @Test fun formatSignedMarcaDireccion() {
        assertEquals("−$45.000", formatSigned(45000, "gasto"))
        assertEquals("+$45.000", formatSigned(45000, "ingreso"))
        assertEquals("↔$45.000", formatSigned(45000, "transferencia"))
    }

    @Test fun entradaDeMontos() {
        assertEquals("1.234.567", formatAmountInput(1234567))
        assertEquals("", formatAmountInput(null))
        assertEquals(1234567L, parseAmountInput("1.234.567"))
        assertEquals(1234567L, parseAmountInput("1234567"))
        assertEquals(45000L, parseAmountInput("$45.000"))
        assertNull(parseAmountInput(""))
        assertNull(parseAmountInput("abc"))
        assertNull(parseAmountInput("0"))
        for (v in listOf(500L, 45000L, 1234567L)) assertEquals(v, parseAmountInput(formatAmountInput(v)))
    }

    @Test fun saldoYPuntos() {
        assertEquals(0L, parseSaldoInput("0"))
        assertNull(parseSaldoInput(""))
        assertEquals("1.234.567", conPuntos("12a34567"))
        assertEquals("", conPuntos("abc"))
    }
}
