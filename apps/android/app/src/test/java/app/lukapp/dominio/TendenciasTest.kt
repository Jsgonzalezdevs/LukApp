package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Casos de lib/tendencias.test.ts.
class TendenciasTest {
    private fun tx(id: String = "t1", kind: String = "gasto", monto: Long = 10000, cat: String = "comida", fecha: String = "2026-08-06") =
        Transaccion(id, kind, monto, cat, "", fecha, null, true, "", null, null, "${fecha}T00:00:00.000Z")

    @Test fun ultimosMesesDelMasViejoAlActual() {
        assertEquals(listOf("2026-06", "2026-07", "2026-08"), ultimosMeses("2026-08", 3))
        assertEquals(listOf("2025-11", "2025-12", "2026-01"), ultimosMeses("2026-01", 3))
    }

    @Test fun serieConservaLosMesesVaciosYSeparaDirecciones() {
        val s = serieMensual(listOf(tx(fecha = "2026-06-10"), tx("t2", fecha = "2026-08-02")), ultimosMeses("2026-08", 3))
        assertEquals(listOf("2026-06", "2026-07", "2026-08"), s.map { it.month })
        assertEquals(PuntoMensual("2026-07", 0, 0, 0), s[1])
        val d = serieMensual(listOf(tx("a", "ingreso", 2_000_000, fecha = "2026-08-01"), tx("b", "gasto", 500_000, fecha = "2026-08-02")), listOf("2026-08"))
        assertEquals(PuntoMensual("2026-08", 2_000_000, 500_000, 1_500_000), d[0])
    }

    @Test fun compararCategoriasOrdenaPorLaQueMasSubio() {
        val c = compararCategorias(listOf(
            tx("a", monto = 300_000, fecha = "2026-08-01"), tx("b", monto = 100_000, fecha = "2026-07-01"),
            tx("c", cat = "transporte", monto = 50_000, fecha = "2026-08-01"), tx("d", cat = "transporte", monto = 90_000, fecha = "2026-07-01"),
        ), "2026-08", "2026-07")
        assertEquals("comida", c[0].category); assertEquals(200_000L, c[0].deltaCop); assertEquals(200.0, c[0].deltaPct)
        assertEquals("transporte", c[1].category); assertEquals(-40_000L, c[1].deltaCop)
    }

    @Test fun categoriaQueDesaparecioYQueNacio() {
        val v = compararCategorias(listOf(tx(cat = "ropa", monto = 80_000, fecha = "2026-07-15")), "2026-08", "2026-07")
        assertEquals(1, v.size); assertEquals(0L, v[0].actualCop); assertEquals(-80_000L, v[0].deltaCop)
        val n = compararCategorias(listOf(tx(cat = "salud", monto = 120_000, fecha = "2026-08-03")), "2026-08", "2026-07")
        assertNull(n[0].deltaPct); assertEquals(120_000L, n[0].deltaCop)
    }

    @Test fun soloLaDireccionPedida() {
        val c = compararCategorias(listOf(tx("a", "ingreso", 900_000, "ingreso", "2026-08-01"), tx("b", "gasto", 10_000, "comida", "2026-08-01")), "2026-08", "2026-07", "ingreso")
        assertEquals(listOf("ingreso"), c.map { it.category })
    }

    @Test fun promedioSoloDeMesesConActividad() {
        val s = serieMensual(listOf(tx("a", monto = 100_000, fecha = "2026-07-01"), tx("b", monto = 300_000, fecha = "2026-08-01")), ultimosMeses("2026-08", 4))
        val p = promedioMensual(s)
        assertEquals(2, p.meses); assertEquals(200_000L, p.gastos)
        assertEquals(PromedioMensual(0, 0, 0, 0), promedioMensual(serieMensual(emptyList(), ultimosMeses("2026-08", 3))))
    }

    @Test fun compararRangosContraLaVentanaAnterior() {
        val r = compararRangos(listOf(tx("a", fecha = "2026-03-10", monto = 100_000), tx("b", fecha = "2026-06-10", monto = 60_000)), "2026-07", 3)
        assertEquals(60_000L, r.actual.gastos); assertEquals(100_000L, r.anterior.gastos)
        assertEquals(-40_000L, r.deltaGastos); assertEquals(-40.0, r.deltaGastosPct); assertTrue(r.hayComparacion)
        val sin = compararRangos(listOf(tx(fecha = "2026-08-10")), "2026-08", 3)
        assertFalse(sin.hayComparacion); assertNull(sin.deltaGastosPct)
        val ing = compararRangos(listOf(tx("a", "ingreso", 200_000, fecha = "2026-03-10"), tx("b", "ingreso", 300_000, fecha = "2026-06-10")), "2026-07", 3)
        assertEquals(100_000L, ing.deltaIngresos); assertEquals(50.0, ing.deltaIngresosPct); assertEquals(0L, ing.actual.gastos)
    }

    @Test fun compararPorMesActivoNoPorHistorialMasLargo() {
        val txs = listOf("04", "05", "06", "07").mapIndexed { i, m -> tx("x$i", monto = 50_000, fecha = "2026-$m-10") }
        val r = compararRangos(txs, "2026-07", 3)
        assertEquals(150_000L, r.actual.gastos); assertEquals(50_000L, r.anterior.gastos)
        assertEquals(50_000L, r.gastoMensualActual); assertEquals(50_000L, r.gastoMensualAnterior)
        assertEquals(0L, r.deltaGastos); assertEquals(0.0, r.deltaGastosPct)
    }
}
