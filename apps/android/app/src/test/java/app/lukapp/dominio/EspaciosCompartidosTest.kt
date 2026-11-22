package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EspaciosCompartidosTest {
    private val yoId = "u-yo"
    private fun esp(vararg g: GastoCompartido, pareja: Boolean = true) = EspacioCompartido(
        "e1", "Casa", "🏠",
        listOf(Integrante(YO, "Tú", "🙂")) + if (pareja) listOf(Integrante("u-ana", "Ana", "💖")) else emptyList(), g.toList(), "2026-11-01T00:00:00Z",
    )
    private fun g(monto: Long, por: String) = GastoCompartido("g$monto$por", "x", monto, "2026-11-18", por, "otros")

    @Test fun armarEspaciosTraduceQuienSoyYo() {
        val r = armarEspacios(
            yoId, listOf(FilaEspacio("e1", "Casa", "🏠", createdAt = "2026-11-01")),
            listOf(FilaIntegrante("e1", yoId, "Tú", "🙂"), FilaIntegrante("e1", "u-ana", "", "")),
            listOf(FilaGasto("g1", "e1", "Mercado", 80_000, "2026-11-18", yoId), FilaGasto("g2", "e1", "Cena", 20_000, "2026-11-17", "u-ana"), FilaGasto("g3", "otro", "x", 1, "2026-11-17", yoId)),
        ).single()
        assertEquals(listOf(Integrante(YO, "Tú", "🙂"), Integrante("u-ana", "Pareja", "🙂")), r.integrantes)
        assertEquals(listOf(YO, "u-ana"), r.gastos.map { it.pagadoPorId })
        assertEquals(2, r.gastos.size)
    }

    @Test fun espaciosMasNuevosPrimero() {
        val r = armarEspacios(yoId, listOf(FilaEspacio("a", "A", createdAt = "2026-01-01"), FilaEspacio("b", "B", createdAt = "2026-02-01")), emptyList(), emptyList())
        assertEquals(listOf("b", "a"), r.map { it.id })
    }

    @Test fun pagarMasDeLaMitadMeLosDeben() {
        val b = balanceDe(esp(g(100_000, YO), g(20_000, "u-ana")))
        assertEquals(120_000L, b.total)
        assertEquals(40_000L, b.balanceMio)
        assertEquals("Ana", b.nombreOtro)
    }

    @Test fun pagarMenosDeLaMitadDebo() {
        assertEquals(-30_000L, balanceDe(esp(g(10_000, YO), g(70_000, "u-ana"))).balanceMio)
    }

    @Test fun mitadEnMedioPesoSeRedondeaHaciaAfuera() {
        assertEquals(1L, balanceDe(esp(g(1, YO))).balanceMio)
        assertEquals(-1L, balanceDe(esp(g(1, "u-ana"))).balanceMio)
    }

    @Test fun sinParejaNoHayBalance() {
        val b = balanceDe(esp(g(50_000, YO), pareja = false))
        assertEquals(0L, b.balanceMio)
        assertEquals(false, b.hayPareja)
        assertEquals("Tu pareja", b.nombreOtro)
    }

    @Test fun yoPrimeroEnLaLista() {
        assertEquals(YO, integrantesConYoPrimero(esp().copy(integrantes = listOf(Integrante("u-ana", "Ana", "x"), Integrante(YO, "Tú", "y")))).first().id)
    }

    @Test fun mensajeEnPrimeraPersona() {
        val m = mensajeDeCuentas("Casa", balanceDe(esp(g(100_000, YO), g(20_000, "u-ana"))))
        assertTrue(m.contains("• Pagué yo: ${formatCop(100_000)}"))
        assertTrue(m.contains("👉 *Ana me debe: ${formatCop(40_000)}*"))
        assertTrue(mensajeDeCuentas("Casa", balanceDe(esp(g(10_000, YO), g(70_000, "u-ana")))).contains("Le debo a Ana: ${formatCop(30_000)}"))
        assertTrue(mensajeDeCuentas("Casa", balanceDe(esp())).contains("a mano"))
    }

    @Test fun miMitadRedondeaHaciaArriba() {
        assertEquals(90_000L, miMitad(180_000))
        assertEquals(51L, miMitad(101))
        assertEquals("Mi mitad: Mercado (Casa)", descripcionMiMitad(" Mercado ", "Casa"))
    }

    @Test fun tokenSaleDelEnlaceODelTokenSolo() {
        val t = "123e4567-e89b-12d3-a456-426614174000"
        assertEquals(t, tokenDeInvitacion("https://mi.lukapp.app/?invitacion=$t"))
        assertEquals(t, tokenDeInvitacion("  ${t.uppercase()} "))
        assertNull(tokenDeInvitacion("hola"))
        assertEquals("https://mi.lukapp.app/?invitacion=$t", enlaceDeInvitacion(t))
    }

    @Test fun iconosViejosSeConvierten() {
        assertEquals("🏠", emojiDeEspacio("Home"))
        assertEquals("✈️", emojiDeEspacio("✈️"))
        assertEquals("Algo", emojiDeEspacio("Algo"))
    }
}
