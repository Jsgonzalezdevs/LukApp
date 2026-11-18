package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VaquitasTest {
    private fun p(n: String, cuota: Long, aporte: Long = 0) = ParticipanteVaquita(n, cuota, aporte)
    private fun v(vararg ps: ParticipanteVaquita, meta: Long = 0, gastos: List<GastoVaquita> = emptyList()) = Vaquita("v", "Paseo", "🐮", meta, ps.toList(), gastos, "2026-11-18")

    @Test fun repartirCuotaNoPierdeNiCreaPesos() {
        assertEquals(listOf(34L, 33L, 33L), repartirCuota(100, 3))
        assertEquals(100L, repartirCuota(100, 3).sum())
        assertEquals(emptyList<Long>(), repartirCuota(100, 0))
        assertEquals(emptyList<Long>(), repartirCuota(-1, 2))
    }

    @Test fun resumenSumaAportesYGastos() {
        val r = calcularResumenVaquita(v(p("Yo", 50, 50), p("Ana", 50, 20), meta = 100, gastos = listOf(GastoVaquita("g", "Bus", 30, "Yo", "2026-11-18"))))
        assertEquals(70L, r.totalRecolectado)
        assertEquals(30L, r.totalGastado)
        assertEquals(40L, r.saldoDisponible)
        assertEquals(70, r.porcentajeRecoleccion)
        assertEquals(false, r.estaCompleta)
        assertEquals(listOf(PendienteVaquita("Ana", 30)), r.pendientesPorPagar)
    }

    @Test fun sinMetaUsaLaSumaDeCuotasYSinNadaEsCien() {
        assertEquals(50, calcularResumenVaquita(v(p("Yo", 50, 25), p("Ana", 50, 25))).porcentajeRecoleccion)
        assertEquals(100, calcularResumenVaquita(v()).porcentajeRecoleccion)
        assertEquals(100, calcularResumenVaquita(v(p("Yo", 10, 99), meta = 10)).porcentajeRecoleccion)
    }

    @Test fun liquidacionLePagaAQuienPusoDeMas() {
        // Yo puso 100 de su bolsillo en gastos y aportó su cuota; Ana y Beto no han aportado.
        val r = calcularResumenVaquita(v(p("Yo", 100, 100), p("Ana", 100), p("Beto", 100), gastos = listOf(GastoVaquita("g", "Cabaña", 300, "Yo", "2026-11-18"))))
        assertEquals(listOf(DeudaLiquidacion("Ana", "Yo", 100), DeudaLiquidacion("Beto", "Yo", 100)), r.liquidacionesSugeridas)
    }

    @Test fun quedarAManoNoGeneraLiquidaciones() {
        assertTrue(calcularResumenVaquita(v(p("Yo", 50, 50), p("Ana", 50, 50))).liquidacionesSugeridas.isEmpty())
    }

    @Test fun gastoPagadoPorQuienNoExisteNoCuentaEnBalances() {
        val r = calcularResumenVaquita(v(p("Yo", 10, 0), gastos = listOf(GastoVaquita("g", "x", 99, "Fantasma", "2026-11-18"))))
        assertTrue(r.liquidacionesSugeridas.isEmpty())
    }

    @Test fun nuevaVaquitaPoneAYoPrimeroYReparteLaMeta() {
        val n = nuevaVaquita("Asado", 100, " Carlos, ,María ", "vaca-1", "2026-11-18")!!
        assertEquals(listOf("Yo", "Carlos", "María"), n.participantes.map { it.nombre })
        assertEquals(listOf(34L, 33L, 33L), n.participantes.map { it.cuotaComprometida })
        assertEquals("🐮", n.emoji)
        assertNull(nuevaVaquita(" ", 100, "A", "x", "h"))
        assertNull(nuevaVaquita("A", 0, "A", "x", "h"))
    }

    @Test fun guardarYLeerEsIdaYVuelta() {
        val l = listOf(nuevaVaquita("Asado", 100, "Ana", "vaca-1", "2026-11-18")!!)
        assertEquals(l, vaquitasDeTexto(vaquitasATexto(l)))
        assertEquals(emptyList<Vaquita>(), vaquitasDeTexto("{roto"))
        assertEquals(emptyList<Vaquita>(), vaquitasDeTexto(null))
    }
}
