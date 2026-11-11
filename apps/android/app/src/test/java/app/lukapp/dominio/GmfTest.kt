package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/gmf.test.ts`. */
class GmfTest {
    private val CUBIERTAS = setOf("nequi", "banco")
    private fun t(id: String = "t1", kind: String = "gasto", amountCop: Long = 1_000_000, occurredOn: String = "2026-08-10", cuentaId: String? = "nequi") =
        tx(id = id, kind = kind, amountCop = amountCop, category = "otros", description = "Retiro", occurredOn = occurredOn, cuentaId = cuentaId)
    private fun mt(id: String = "m1", cajitaId: String = "nequi", kind: String = "retiro", deltaCop: Long = -2_000_000, nota: String = "Enviado a Daviplata") =
        mov(id = id, cajitaId = cajitaId, kind = kind, deltaCop = deltaCop, occurredOn = "2026-08-10", nota = nota, createdAt = "2026-08-10T00:00:00.000Z")
    private val U = UVT_POR_DEFECTO

    @Test fun tarifaYTope() {
        assertEquals(0.004, TARIFA_GMF, 0.0)
        assertEquals(4_000L, gmfDe(1_000_000))
        assertEquals(1_000L, gmfDe(250_000))
        assertEquals(49L, gmfDe(12_345))
        assertEquals(gmfDe(500_000), gmfDe(-500_000))
        assertEquals(350, TOPE_EXENTO_UVT)
        assertEquals(350 * U.pesos, topeExentoCop(U))
        assertEquals(350L * 49_799, topeExentoCop(ValorUvt(2025, 49_799, "")))
    }

    @Test fun uvt() {
        assertEquals(2026, U.anio)
        assertEquals(52_374L, U.pesos)
        assertTrue(U.fuente.contains("DIAN"))
        assertFalse(uvtDesactualizada(U, 2026))
        assertTrue(uvtDesactualizada(U, 2027))
    }

    @Test fun consumo() {
        val c = consumoDelMes(listOf(t(amountCop = 2_000_000)), "2026-08", U, CUBIERTAS)
        assertEquals(2_000_000L, c.baseCop); assertEquals(18_330_900L, c.topeCop); assertEquals(16_330_900L, c.disponibleCop)
        assertEquals(0L, c.gravadoCop); assertEquals(0L, c.gmfEstimadoCop)
        assertEquals(2_000_000L, consumoDelMes(emptyList(), "2026-08", U, CUBIERTAS,
            movimientosTransferencia = listOf(mt(), mt(id = "m2", cajitaId = "banco", kind = "deposito", deltaCop = 2_000_000, nota = "Recibido de Nequi"))).baseCop)
        assertEquals(0L, consumoDelMes(listOf(t(kind = "ingreso", amountCop = 5_000_000)), "2026-08", U, CUBIERTAS).baseCop)
        assertEquals(0L, consumoDelMes(listOf(t(cuentaId = null)), "2026-08", U, CUBIERTAS).baseCop)
        assertEquals(0L, consumoDelMes(listOf(t(cuentaId = "otra")), "2026-08", U, CUBIERTAS).baseCop)
        val vacio = consumoDelMes(listOf(t()), "2026-08", U, emptySet())
        assertEquals(0L, vacio.baseCop); assertEquals(0L, vacio.gmfEstimadoCop)
        assertEquals(0L, consumoDelMes(listOf(t(occurredOn = "2026-07-31"), t(id = "t2", occurredOn = "2026-09-01")), "2026-08", U, CUBIERTAS).baseCop)
        val tope = topeExentoCop(U)
        val exceso = consumoDelMes(listOf(t(amountCop = tope + 1_000_000)), "2026-08", U, CUBIERTAS)
        assertEquals(1_000_000L, exceso.gravadoCop); assertEquals(4_000L, exceso.gmfEstimadoCop)
        val justo = consumoDelMes(listOf(t(amountCop = tope)), "2026-08", U, CUBIERTAS)
        assertEquals(0L, justo.gravadoCop); assertEquals(0L, justo.disponibleCop); assertEquals(100.0, justo.pctUsado, 0.0)
        val triple = consumoDelMes(listOf(t(amountCop = tope * 3)), "2026-08", U, CUBIERTAS)
        assertEquals(100.0, triple.pctUsado, 0.0); assertEquals(0L, triple.disponibleCop)
        assertEquals(5_000_000L, consumoDelMes(listOf(t(id = "a", cuentaId = "nequi", amountCop = 3_000_000), t(id = "b", cuentaId = "banco", amountCop = 2_000_000)), "2026-08", U, CUBIERTAS).baseCop)
        val nada = consumoDelMes(emptyList(), "2026-08", U, CUBIERTAS)
        assertEquals(0L, nada.baseCop); assertEquals(0L, nada.gravadoCop); assertEquals(0L, nada.gmfEstimadoCop); assertEquals(0.0, nada.pctUsado, 0.0)
    }

    @Test fun notas() {
        assertTrue(NOTAS_GMF.size > 3)
        for (n in NOTAS_GMF) {
            assertTrue(n.fundamento.isNotBlank())
            assertTrue(Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(n.verificado))
            assertTrue(n.cuerpo.length > 40)
        }
        assertTrue(ADVERTENCIA_GMF.contains("banco", ignoreCase = true))
        assertTrue(ADVERTENCIA_GMF.contains("estimaci", ignoreCase = true))
        val nota = NOTAS_GMF.find { it.id == "ya-no-se-marca" }
        assertNotNull(nota)
        assertTrue(nota!!.cuerpo.contains("13 de diciembre de 2024"))
        assertTrue(nota.fundamento.contains("881-1"))
    }

    @Test fun regimenes() {
        val tope = 18_330_900L
        val MOVS = listOf(t(id = "a", cuentaId = "nequi", amountCop = 2_000_000), t(id = "b", cuentaId = "banco", amountCop = 3_000_000))
        val d = consumoDelMes(MOVS, "2026-08", U, CUBIERTAS, regimen = "distribuido")
        assertEquals(5_000_000L, d.baseCop); assertEquals(0L, d.sinCupoCop); assertEquals(0L, d.gmfEstimadoCop)
        val m = consumoDelMes(MOVS, "2026-08", U, CUBIERTAS, regimen = "marcada", cuentaExentaId = "nequi")
        assertEquals(2_000_000L, m.baseCop); assertEquals(3_000_000L, m.sinCupoCop); assertEquals(gmfDe(3_000_000), m.gmfEstimadoCop)
        assertEquals(tope - 2_000_000, m.disponibleCop)
        val sin = consumoDelMes(MOVS, "2026-08", U, CUBIERTAS, regimen = "marcada", cuentaExentaId = null)
        assertEquals(0L, sin.baseCop); assertEquals(5_000_000L, sin.sinCupoCop)
        assertEquals(500_000L, consumoDelMes(listOf(t(cuentaId = "nequi", amountCop = tope + 500_000)), "2026-08", U, CUBIERTAS, regimen = "marcada", cuentaExentaId = "nequi").gravadoCop)
        assertEquals(d, consumoDelMes(MOVS, "2026-08", U, CUBIERTAS))
        assertTrue(m.gmfEstimadoCop >= d.gmfEstimadoCop)
    }

    @Test fun bajoMontoGravaSoloLoQuePasaDe65Uvt() {
        val topeBajo = topeBajoMontoCop(U)
        val c = consumoDelMes(listOf(t(cuentaId = "nequi", amountCop = topeBajo + 100_000)), "2026-08", U, CUBIERTAS, bajoMontoIds = setOf("nequi"))
        assertEquals(0L, c.baseCop)
        assertEquals(100_000L, c.bajoMontoGravadoCop)
        assertEquals(100_000L, c.gravadoCop)
    }
}
