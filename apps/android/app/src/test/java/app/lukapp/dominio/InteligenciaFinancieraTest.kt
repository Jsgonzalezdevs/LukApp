package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InteligenciaFinancieraTest {
    private var n = 0
    private fun gasto(monto: Long, cat: String) = Transaccion("t${n++}", TipoTx.GASTO, monto, cat, "", "2026-11-01", null, createdAt = "2026-11-01T00:00:00Z")

    @Test fun elGastoMasAltoContraElPromedioDeLosDemas() {
        val a = detectarAnomalias(listOf(gasto(10_000, "comida"), gasto(10_000, "comida"), gasto(40_000, "comida"))).single()
        // 40 mil contra un promedio de 10 mil: 300 % por encima.
        assertEquals("comida", a.categoria); assertEquals(40_000L, a.monto); assertEquals(300.0, a.porcentajeSobrePromedio, 0.001)
    }

    @Test fun pideDosGastosYUmbralDeSetentaYCincoPorCiento() {
        assertTrue(detectarAnomalias(listOf(gasto(500_000, "comida"))).isEmpty())
        assertTrue(detectarAnomalias(listOf(gasto(10_000, "comida"), gasto(17_000, "comida"))).isEmpty())
        assertEquals(1, detectarAnomalias(listOf(gasto(10_000, "comida"), gasto(17_500, "comida"))).size)
    }

    @Test fun siTodosValenLoMismoNoHayAnomaliaNiFalla() {
        assertTrue(detectarAnomalias(listOf(gasto(10_000, "comida"), gasto(10_000, "comida"))).isEmpty())
    }

    @Test fun ignoraIngresos() {
        val ingreso = Transaccion("i", TipoTx.INGRESO, 900_000, "comida", "", "2026-11-01", null, createdAt = "2026-11-01T00:00:00Z")
        assertTrue(detectarAnomalias(listOf(gasto(10_000, "comida"), ingreso)).isEmpty())
    }
}
