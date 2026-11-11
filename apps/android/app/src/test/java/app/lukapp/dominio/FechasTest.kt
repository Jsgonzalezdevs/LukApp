package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** Casos de `lib/localDate.test.ts`. */
class FechasTest {
    private fun i(s: String) = Instant.parse(s)

    @Test fun bogotaDateUsaElDiaDeBogota() {
        assertEquals("2026-07-28", bogotaDate(i("2026-07-29T02:00:00Z")))
        assertEquals("2026-07-29", bogotaDate(i("2026-07-29T18:00:00Z")))
        assertEquals("2026-07-29", bogotaDate(i("2026-07-30T04:59:00Z")))
        assertEquals("2026-07-30", bogotaDate(i("2026-07-30T05:00:00Z")))
    }

    @Test fun shiftDaysCruzaLimites() {
        assertEquals("2026-07-28", shiftDays("2026-07-29", -1))
        assertEquals("2026-07-30", shiftDays("2026-07-29", 1))
        assertEquals("2026-07-31", shiftDays("2026-08-01", -1))
        assertEquals("2025-12-31", shiftDays("2026-01-01", -1))
        assertEquals("2027-01-01", shiftDays("2026-12-31", 1))
        assertEquals("2028-02-29", shiftDays("2028-02-28", 1))
    }

    @Test fun normalizaComoDateUtc() {
        assertEquals("2026-03-03", shiftDays("2026-02-31", 0))
        assertEquals(3, daysBetween("2026-02-28", "2026-03-03"))
    }

    @Test fun dayLabelNombraHoyYAyer() {
        assertEquals("Hoy", dayLabel("2026-07-29", "2026-07-29"))
        assertEquals("Ayer", dayLabel("2026-07-28", "2026-07-29"))
        assertEquals("20 jul", dayLabel("2026-07-20", "2026-07-29"))
        assertEquals("5 ene", dayLabel("2026-01-05", "2026-07-29"))
    }

    @Test fun shiftMonthGiraElAnio() {
        assertEquals("2026-06", shiftMonth("2026-07", -1))
        assertEquals("2026-08", shiftMonth("2026-07", 1))
        assertEquals("2025-12", shiftMonth("2026-01", -1))
        assertEquals("2027-01", shiftMonth("2026-12", 1))
        assertEquals("2025-07", shiftMonth("2026-07", -12))
        assertEquals("2028-01", shiftMonth("2026-07", 18))
        for (m in listOf("2026-01", "2026-07", "2026-12")) assertEquals(m, shiftMonth(shiftMonth(m, 5), -5))
    }

    @Test fun etiquetasDeMes() {
        assertEquals("julio 2026", monthKeyLabel("2026-07"))
        assertEquals("enero 2026", monthKeyLabel("2026-01"))
        assertEquals("julio 2026", monthLabel("2026-07-29"))
        assertEquals("diciembre 2026", monthLabel("2026-12-01"))
        assertEquals("2026-07", monthKey("2026-07-29"))
        assertEquals("jul", monthKeyShort("2026-07"))
    }

    @Test fun asesorEnHorarioRespetaLimites() {
        assertTrue(asesorEnHorario(i("2026-08-18T12:00:00Z")))
        assertTrue(asesorEnHorario(i("2026-08-19T02:00:00Z")))
        assertFalse(asesorEnHorario(i("2026-08-18T11:59:00Z")))
        assertFalse(asesorEnHorario(i("2026-08-19T03:00:00Z")))
        assertEquals(0, bogotaHora(i("2026-08-19T05:00:00Z")))
        assertFalse(asesorEnHorario(i("2026-08-19T05:00:00Z")))
    }
}
