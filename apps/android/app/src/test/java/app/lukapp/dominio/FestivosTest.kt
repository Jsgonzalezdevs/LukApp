package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/festivosColombia.test.ts`, más fechas conocidas de 2026. */
class FestivosTest {
    @Test fun festivosFijos() {
        val f = obtenerFestivosColombia(2026)
        for (d in listOf("2026-01-01", "2026-05-01", "2026-07-20", "2026-08-07", "2026-12-25")) assertTrue(d in f)
    }

    @Test fun noHabiles() {
        assertFalse(esDiaHabilColombia("2026-01-01"))
        assertFalse(esDiaHabilColombia("2026-01-04"))
        assertTrue(esDiaHabilColombia("2026-01-13"))
    }

    @Test fun adelantaElPago() {
        val q1 = calcularFechaPagoColombia(2026, 2, "quincena_1", true)
        assertEquals("2026-02-13", q1)
        assertTrue(esDiaHabilColombia(q1))
    }

    @Test fun pascuaYEmiliani2026() {
        assertEquals("2026-04-05", calcularDomingoPascua(2026).toString())
        val f = obtenerFestivosColombia(2026)
        assertEquals(18, f.size)
        for (d in listOf("2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16")) {
            assertTrue(d, d in f)
        }
        assertEquals("2026-05-29", calcularFechaPagoColombia(2026, 5, "fin_mes"))
    }
}
