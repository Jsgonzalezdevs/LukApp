package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/metas.test.ts`. */
class MetasProgresoTest {
    private fun meta(id: String = "meta-1", nombre: String = "Viaje", objetivoCop: Long = 1_000_000, fechaObjetivo: String? = null, cajitaId: String? = null, ahorradoCop: Long = 0) =
        Meta(id, nombre, "✈️", objetivoCop, fechaObjetivo, cajitaId, ahorradoCop, "2026-08-01T00:00:00.000Z", null)
    private val HOY = "2026-08-06"

    @Test fun progreso() {
        val a = progresoDeMeta(meta(cajitaId = "c1", ahorradoCop = 999), mapOf("c1" to 250_000L), HOY)
        assertEquals(250_000L, a.ahorradoCop); assertEquals(25.0, a.pct, 0.0)
        val b = progresoDeMeta(meta(ahorradoCop = 400_000), emptyMap(), HOY)
        assertEquals(400_000L, b.ahorradoCop); assertEquals(40.0, b.pct, 0.0)
        val c = progresoDeMeta(meta(cajitaId = "ausente"), emptyMap(), HOY)
        assertEquals(0L, c.ahorradoCop); assertEquals(1_000_000L, c.faltaCop)
        val d = progresoDeMeta(meta(ahorradoCop = 1_500_000), emptyMap(), HOY)
        assertTrue(d.completada); assertEquals(0L, d.faltaCop); assertEquals(100.0, d.pct, 0.0)
    }

    @Test fun ritmos() {
        val p = progresoDeMeta(meta(fechaObjetivo = "2026-11-04"), emptyMap(), HOY)
        assertEquals(90, p.diasRestantes)
        assertEquals(338_223L, p.ritmoMensualCop); assertEquals(169_112L, p.ritmoQuincenalCop); assertEquals(11_112L, p.ritmoDiarioCop)
        val abierta = progresoDeMeta(meta(), emptyMap(), HOY)
        assertNull(abierta.diasRestantes); assertNull(abierta.ritmoMensualCop)
        assertNull(progresoDeMeta(meta(fechaObjetivo = "2026-12-31", ahorradoCop = 1_000_000), emptyMap(), HOY).ritmoMensualCop)
        val vencida = progresoDeMeta(meta(fechaObjetivo = "2026-08-01"), emptyMap(), HOY)
        assertEquals(-5, vencida.diasRestantes); assertNull(vencida.ritmoMensualCop)
        val cero = progresoDeMeta(meta(objetivoCop = 0), emptyMap(), HOY)
        assertEquals(0.0, cero.pct, 0.0); assertFalse(cero.completada)
    }

    @Test fun orden() {
        val f = metasConProgreso(listOf(
            meta(id = "lejana", nombre = "Lejana", fechaObjetivo = "2026-12-31"),
            meta(id = "lista", nombre = "Lista", ahorradoCop = 1_000_000, fechaObjetivo = "2026-08-10"),
            meta(id = "cercana", nombre = "Cercana", fechaObjetivo = "2026-09-01"),
        ), emptyMap(), HOY)
        assertEquals(listOf("cercana", "lejana", "lista"), f.map { it.meta.id })
        val g = metasConProgreso(listOf(meta(id = "abierta", nombre = "Abierta"), meta(id = "con-fecha", nombre = "Con fecha", fechaObjetivo = "2027-01-01")), emptyMap(), HOY)
        assertEquals(listOf("con-fecha", "abierta"), g.map { it.meta.id })
    }
}
