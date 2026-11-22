package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZonedDateTime

class RecordatorioTest {
    private fun bogota(s: String) = ZonedDateTime.parse("$s[America/Bogota]")

    @Test fun horaValidaOCaeEnLaPorDefecto() {
        assertEquals(7 to 5, horaDeRecordatorio("07:05")); assertEquals(20 to 30, horaDeRecordatorio(null))
        assertEquals(20 to 30, horaDeRecordatorio("25:00")); assertEquals(20 to 30, horaDeRecordatorio("basura")); assertEquals(9 to 0, horaDeRecordatorio("9:00"))
    }
    @Test fun elProximoAvisoEsHoyOMananaSegunLaHora() {
        assertEquals(bogota("2026-11-17T20:30:00-05:00"), proximoAviso("20:30", bogota("2026-11-17T09:00:00-05:00")))
        assertEquals(bogota("2026-11-18T20:30:00-05:00"), proximoAviso("20:30", bogota("2026-11-17T21:00:00-05:00")))
        // A la hora exacta ya pasó: no se reprograma en el mismo instante.
        assertEquals(bogota("2026-11-18T20:30:00-05:00"), proximoAviso("20:30", bogota("2026-11-17T20:30:00-05:00")))
    }
    @Test fun soloAvisaActivoYSinAnotarHoy() {
        assertTrue(debeAvisar(true, "2026-11-16", "2026-11-17")); assertTrue(debeAvisar(true, null, "2026-11-17"))
        assertFalse(debeAvisar(true, "2026-11-17", "2026-11-17")); assertFalse(debeAvisar(false, null, "2026-11-17"))
    }
}
