package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/presupuestos.test.ts`. */
class PresupuestosTest {
    private val M = ConfigPeriodo("mensual", 0)
    private val TODO = ConfigPeriodo("todo-el-tiempo", 0)
    private fun t(id: String = "t1", kind: String = "gasto", amountCop: Long = 100_000, category: String = "comida", occurredOn: String = "2026-08-05") =
        tx(id = id, kind = kind, amountCop = amountCop, category = category, description = "Almuerzo", occurredOn = occurredOn, cuentaId = null, createdAt = "2026-08-05T00:00:00.000Z")
    private fun pre(categoria: String = "comida", montoCop: Long = 400_000) = Presupuesto(categoria, montoCop, "2026-08-01T00:00:00.000Z")

    @Test fun gastado() {
        assertEquals(50_000L, gastadoEnCategoria(listOf(t("a", amountCop = 50_000), t("b", amountCop = 30_000, category = "transporte"), t("c", amountCop = 90_000, occurredOn = "2026-07-20")), "2026-08", M, "comida"))
        assertEquals(50_000L, gastadoEnCategoria(listOf(t(amountCop = 50_000), t("b", kind = "ingreso", amountCop = 200_000)), "2026-08", M, "comida"))
    }

    @Test fun estado() {
        val e = estadoDePresupuesto(pre(), listOf(t(amountCop = 100_000)), "2026-08", "2026-08-10", M)
        assertEquals(100_000L, e.gastadoCop); assertEquals(300_000L, e.disponibleCop); assertEquals(25.0, e.pctUsado, 0.0); assertEquals(0L, e.excedidoCop)
        assertEquals(310_000L, e.proyectadoCop); assertFalse(e.vaARebasar)
        val r = estadoDePresupuesto(pre(), listOf(t(amountCop = 200_000)), "2026-08", "2026-08-10", M)
        assertEquals(0L, r.excedidoCop); assertEquals(620_000L, r.proyectadoCop); assertTrue(r.vaARebasar)
        assertEquals(0L, estadoDePresupuesto(pre(), emptyList(), "2026-09", "2026-08-10", M).proyectadoCop)
        val c = estadoDePresupuesto(pre(), listOf(t(occurredOn = "2026-07-05")), "2026-07", "2026-08-10", M)
        assertEquals(c.gastadoCop, c.proyectadoCop)
        val x = estadoDePresupuesto(pre(), listOf(t(amountCop = 500_000)), "2026-08", "2026-08-20", M)
        assertEquals(100_000L, x.excedidoCop); assertEquals(0L, x.disponibleCop)
        assertEquals(0.0, estadoDePresupuesto(pre(montoCop = 0), listOf(t()), "2026-08", "2026-08-10", M).pctUsado, 0.0)
        assertTrue(estadoDePresupuesto(pre(montoCop = 1_000), listOf(t(amountCop = 90_000_000)), "2026-08", "2026-08-10", M).pctUsado <= 999)
        assertEquals(200_000L, estadoDePresupuesto(pre(), listOf(t(amountCop = 100_000, occurredOn = "2026-02-14")), "2026-02", "2026-02-14", M).proyectadoCop)
        val todo = estadoDePresupuesto(pre(), listOf(t(amountCop = 500_000)), "todo", "2026-08-10", TODO)
        assertNull(todo.proyectadoCop); assertFalse(todo.vaARebasar); assertEquals(100_000L, todo.excedidoCop)
    }

    @Test fun todos() {
        val e = estadoDeTodos(listOf(pre("comida"), pre("transporte", 100_000)), listOf(t("a", category = "comida", amountCop = 40_000), t("b", category = "transporte", amountCop = 95_000)), "2026-08", "2026-08-10", M)
        assertEquals("transporte", e[0].categoria)
        assertEquals(emptyList<EstadoPresupuesto>(), estadoDeTodos(emptyList(), listOf(t()), "2026-08", "2026-08-10", M))
    }

    @Test fun tonos() {
        fun estadoCon(g: Long, tope: Long = 400_000, hoy: String = "2026-08-10") = estadoDePresupuesto(pre(montoCop = tope), listOf(t(amountCop = g)), "2026-08", hoy, M)
        assertEquals("excedido", tonoDe(estadoCon(500_000)))
        assertEquals("atento", tonoDe(estadoCon(200_000)))
        assertEquals("atento", tonoDe(estadoCon(340_000, 400_000, "2026-08-30")))
        assertEquals("bien", tonoDe(estadoCon(50_000, 400_000, "2026-08-25")))
        val e = estadoCon(200_000, 400_000, "2026-08-16")
        assertEquals("bien", tonoDe(e, 80.0)); assertEquals("atento", tonoDe(e, 40.0))
    }

    @Test fun promedio() {
        assertEquals(80_000L, promedioPorPeriodoCategoria(listOf(t("a", amountCop = 100_000, occurredOn = "2026-07-05"), t("b", amountCop = 60_000, occurredOn = "2026-06-10"), t("c", amountCop = 900_000, occurredOn = "2026-08-15")), "comida", "2026-08", M))
        assertNull(promedioPorPeriodoCategoria(emptyList(), "comida", "2026-08", M))
        assertNull(promedioPorPeriodoCategoria(listOf(t(category = "transporte", occurredOn = "2026-07-05")), "comida", "2026-08", M))
        assertNull(promedioPorPeriodoCategoria(listOf(t(occurredOn = "2026-07-05")), "comida", "todo", TODO))
    }
}
