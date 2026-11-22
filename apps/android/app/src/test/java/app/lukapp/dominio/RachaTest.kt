package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/racha.test.ts`. */
class RachaTest {
    private val HOY = "2026-08-24"
    private fun m(fecha: String) = tx(id = "tx-$fecha", amountCop = 10000, category = "comida", description = "Almuerzo", occurredOn = fecha,
        rawTranscript = "Almuerzo 10 mil", createdAt = "${fecha}T12:00:00.000Z")

    @Test fun sinTransacciones() {
        val r = calcularRacha(emptyList(), HOY)
        assertEquals(0, r.rachaActual); assertEquals(0, r.rachaMaxima); assertFalse(r.anotadoHoy)
        assertEquals(3, r.diasParaProximoHito)
    }

    @Test fun rachaActiva() {
        val r = calcularRacha(listOf(m("2026-08-24"), m("2026-08-23"), m("2026-08-22")), HOY)
        assertEquals(3, r.rachaActual); assertTrue(r.anotadoHoy)
        assertTrue(r.hitosAlcanzados.isNotEmpty()); assertEquals(3, r.hitosAlcanzados[0].dias)
        assertEquals(7, r.proximoHito!!.dias); assertEquals(4, r.diasParaProximoHito)
    }

    @Test fun vivaDesdeAyer() {
        val r = calcularRacha(listOf(m("2026-08-23"), m("2026-08-22")), HOY)
        assertEquals(2, r.rachaActual); assertFalse(r.anotadoHoy)
    }

    @Test fun seReinicia() {
        val r = calcularRacha(listOf(m("2026-08-20"), m("2026-08-19")), HOY)
        assertEquals(0, r.rachaActual); assertEquals(2, r.rachaMaxima)
        assertEquals("2026-08-20", r.ultimoDiaAnotado)
    }

    @Test fun diasDelMes() {
        assertEquals(2, calcularRacha(listOf(m("2026-08-24"), m("2026-08-15"), m("2026-07-30")), HOY).diasAnotadosMes)
    }

    @Test fun bonoSumaExactoAunqueHayaRachasViejasCerca() {
        // Viva de 3 días (22-24), hueco el 21 y una racha vieja de 10 (11-20).
        val txs = (22..24).map { m("2026-08-$it") } + (11..20).map { m("2026-08-$it") }
        val inicio = inicioDeRachaActual(txs.map { it.occurredOn }, HOY)
        assertEquals("2026-08-22", inicio)
        val r = calcularRacha(txs, HOY, listOf(BonoRacha(inicio, 67)))
        assertEquals(70, r.rachaActual); assertEquals(70, r.rachaMaxima); assertTrue(r.anotadoHoy)
    }

    @Test fun bonoSePierdeSiLaRachaSeCorta() {
        val bono = listOf(BonoRacha("2026-08-22", 5))
        val r = calcularRacha(listOf(m("2026-08-30"), m("2026-08-29"), m("2026-08-24"), m("2026-08-23"), m("2026-08-22")), "2026-08-30", bono)
        assertEquals(2, r.rachaActual); assertEquals(8, r.rachaMaxima)
    }

    @Test fun bonoSinRachaVivaQuedaParaHoy() {
        val bono = listOf(BonoRacha(HOY, 4))
        val r = calcularRacha(listOf(m("2026-08-10")), HOY, bono)
        assertEquals(4, r.rachaActual); assertFalse(r.anotadoHoy)
        assertEquals(5, calcularRacha(listOf(m(HOY)), HOY, bono).rachaActual)
    }
}
