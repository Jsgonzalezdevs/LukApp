package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InsightsTest {
    private var n = 0
    private fun gasto(monto: Long, cat: String, fecha: String, desc: String = "") =
        Transaccion("t${n++}", TipoTx.GASTO, monto, cat, desc, fecha, null, createdAt = "2026-01-01T00:00:00Z")
    private fun ingreso(monto: Long, fecha: String) =
        Transaccion("t${n++}", TipoTx.INGRESO, monto, "otros", "", fecha, null, createdAt = "2026-01-01T00:00:00Z")
    private val nombre = { c: String -> c.replaceFirstChar { it.uppercase() } }

    @Test fun cifrasCortasComoLaWeb() {
        assertEquals("$850 mil", formatCopCorto(850_000))
        assertEquals("$1.2M", formatCopCorto(1_200_000))
        assertEquals("$2M", formatCopCorto(2_000_000))
        assertEquals("$12M", formatCopCorto(12_340_000))
        assertEquals("$45 mil", formatCopCorto(45_000))
    }

    @Test fun proyeccionNecesitaTresDiasYGasto() {
        val tx = listOf(gasto(300_000, "comida", "2026-11-05"))
        assertNull(insightsDelMes(tx, emptyList(), "2026-11", "2026-11-02", nombre).firstOrNull { it.id == "proyeccion-cierre" })
        val i = insightsDelMes(tx, emptyList(), "2026-11", "2026-11-10", nombre).first { it.id == "proyeccion-cierre" }
        // 300 mil en 10 de 30 días → 900 mil.
        assertEquals("Vas camino a cerrar el mes en $900 mil", i.titulo)
        assertEquals("Llevas $300 mil en 10 de 30 días. Si sigues a este ritmo, así cierra el mes.", i.detalle)
    }

    @Test fun desviacionContraPromedioPropio() {
        val tx = listOf(
            gasto(100_000, "comida", "2026-08-10"), gasto(100_000, "comida", "2026-09-10"), gasto(100_000, "comida", "2026-10-10"),
            gasto(150_000, "comida", "2026-11-04"),
        )
        val i = insightsDelMes(tx, emptyList(), "2026-11", "2026-11-04", nombre).first { it.id == "desviacion-comida" }
        assertEquals("Comida subió 50% este mes", i.titulo)
        assertEquals("atento", i.tono)
        assertEquals("Llevas $150 mil, contra un promedio de $100 mil en los últimos 3 meses.", i.detalle)
    }

    @Test fun sinDosMesesDeHistoriaNoComparaNiInventa() {
        val tx = listOf(gasto(100_000, "comida", "2026-10-10"), gasto(500_000, "comida", "2026-11-04"))
        assertTrue(insightsDelMes(tx, emptyList(), "2026-11", "2026-11-04", nombre).none { it.id.startsWith("desviacion") })
    }

    @Test fun gastoHormigaNecesitaSeisCompras() {
        val cinco = (1..5).map { gasto(8_000, "comida", "2026-11-0$it") }
        assertTrue(insightsDelMes(cinco, emptyList(), "2026-11", "2026-11-06", nombre).none { it.id == "gasto-hormiga" })
        val seis = (1..6).map { gasto(8_000, "comida", "2026-11-0$it") }
        val i = insightsDelMes(seis, emptyList(), "2026-11", "2026-11-06", nombre).first { it.id == "gasto-hormiga" }
        assertEquals("6 compras chiquitas suman $48 mil", i.titulo)
        assertEquals("La mayoría (6) son en Comida. Proyectado al año sumarían $576 mil.", i.detalle)
    }

    @Test fun tasaDeAhorroAltaYBalanceNegativo() {
        val alta = insightsDelMes(listOf(ingreso(1_000_000, "2026-11-01"), gasto(400_000, "comida", "2026-11-02")), emptyList(), "2026-11", "2026-11-02", nombre)
        assertEquals("Tasa de ahorro del 60% este mes", alta.first { it.id == "tasa-ahorro-alta" }.titulo)
        val neg = insightsDelMes(listOf(ingreso(200_000, "2026-11-01"), gasto(300_000, "comida", "2026-11-02")), emptyList(), "2026-11", "2026-11-02", nombre)
        assertEquals("Gastos superan ingresos por $100 mil", neg.first { it.id == "balance-negativo-mes" }.titulo)
    }

    @Test fun presupuestoExcedidoVaPrimeroYMaximoTres() {
        val tx = listOf(gasto(250_000, "comida", "2026-11-03"), ingreso(1_000_000, "2026-11-01"))
        val i = insightsDelMes(tx, listOf(Presupuesto("comida", 200_000, "2026-11-01T00:00:00Z")), "2026-11", "2026-11-03", nombre)
        assertEquals("Te pasaste $50 mil en Comida", i.first().titulo)
        assertEquals("El tope era $200 mil y llevas $250 mil.", i.first().detalle)
        assertTrue(i.size <= 3)
    }

    @Test fun preguntasAlAsesorSonLasDeLaWeb() {
        val i = Insight("x", "T", "D", "neutral", null)
        assertEquals("Hola asesor, sobre este dato de mis finanzas: \"T - D\", ¿qué análisis detallado y recomendaciones prácticas me das al respecto?", promptDeInsight(i))
        assertTrue(promptPulsoPremium(50_000, 12, null).contains("Tengo $50.000 para usar hoy durante los 12 días restantes del período. No hay una alerta adicional prioritaria hoy."))
    }
}
