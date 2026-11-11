package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/rendimiento.test.ts`. */
class RendimientoTest {
    private fun m(id: String = "m1", cajitaId: String = "c1", kind: String = "deposito", delta: Long = 1_000_000, fecha: String = "2026-01-01", createdAt: String = "2026-01-01T00:00:00.000Z") =
        mov(id = id, cajitaId = cajitaId, kind = kind, deltaCop = delta, occurredOn = fecha, createdAt = createdAt)

    @Test fun tasa() {
        val d = tasaDiaria(13.0)
        assertEquals(0.0003349, d, 5e-8)
        assertTrue(d < 0.13 / 365)
        assertEquals(0.13, Math.pow(1 + tasaDiaria(13.0), 365.0) - 1, 5e-11)
        assertEquals(0.0, tasaDiaria(0.0), 0.0)
        assertEquals(335L, Math.round(rendimientoDiario(1_000_000.0, 13.0)))
    }

    @Test fun estimado() {
        assertNull(rendimientoEstimado(listOf(m()), "c1", null, "2026-06-01"))
        assertNull(rendimientoEstimado(emptyList(), "c1", 13.0, "2026-06-01"))
        val anio = rendimientoEstimado(listOf(m()), "c1", 13.0, "2027-01-01")!!
        assertEquals(130_000L, anio.acumuladoCop); assertEquals(365, anio.dias)
        val dos = rendimientoEstimado(listOf(m(id = "viejo"), m(id = "nuevo", fecha = "2026-12-31", createdAt = "2026-12-31T00:00:00.000Z")), "c1", 13.0, "2027-01-01")!!
        assertTrue(dos.acumuladoCop in 129_001..131_999)
        val compuesto = rendimientoEstimado(listOf(m()), "c1", 13.0, "2028-01-01")!!
        assertTrue(compuesto.acumuladoCop in 276_001..277_999)
        val retiro = rendimientoEstimado(listOf(m(id = "in"), m(id = "out", kind = "retiro", delta = -1_000_000, fecha = "2026-01-31", createdAt = "2026-01-31T00:00:00.000Z")), "c1", 13.0, "2027-01-01")!!
        assertTrue(retiro.acumuladoCop in 1..11_999); assertEquals(0L, retiro.diarioCop)
        val futuro = rendimientoEstimado(listOf(m(delta = 500_000, fecha = "2027-01-01")), "c1", 13.0, "2026-06-01")!!
        assertTrue(futuro.acumuladoCop >= 0); assertTrue(futuro.dias >= 0)
        assertEquals(130_000L, rendimientoEstimado(listOf(m(cajitaId = "otra", delta = 9_000_000), m(id = "mio")), "c1", 13.0, "2027-01-01")!!.acumuladoCop)
    }
}
