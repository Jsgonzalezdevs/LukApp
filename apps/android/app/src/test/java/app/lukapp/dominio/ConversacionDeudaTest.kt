package app.lukapp.dominio

import app.lukapp.dominio.voz.LEXICO_VACIO
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/conversacionDeuda.test.ts`; los `it.each` van en un solo test cada uno, con la misma lista de entradas. */
class ConversacionDeudaTest {
    private val AHORA = Instant.parse("2026-08-20T15:00:00Z")
    private val cajita = Cajita(id = "mac", nombre = "MacBook Air M5", icon = "Wallet", tipo = "cajita", metaCop = 5_000_000, createdAt = "")

    private fun responder(texto: String, balances: Map<String, Long>, cajitas: List<Cajita>, contexto: AsesorContext) =
        responderAsesor(texto, emptyList(), cajitas, balances, emptyList(), LEXICO_VACIO, contexto, ahora = AHORA)

    @Test fun usaElSaldoDeLaCajitaIndicadaSinConfundirM5ConUnMonto() {
        val r = responder(
            "Lo que tengo de ahorro en la cajita de la MacBook Air M5", mapOf("mac" to 1_500_000L), listOf(cajita),
            AsesorContext(conversacionDeuda = ConversacionDeuda(deuda = 900_000, pendiente = CampoDeuda.AHORROS)),
        )
        assertEquals(1_500_000L, r.newContext.conversacionDeuda?.ahorros)
        assertEquals(CampoDeuda.RESERVA, r.newContext.conversacionDeuda?.pendiente)
        assertTrue(r.text.contains("MacBook Air M5"))
        assertNull(r.action)
    }

    @Test fun distingueSaldoCeroSaldoAusenteYNombresDuplicados() {
        val estado = ConversacionDeuda(deuda = 900_000, pendiente = CampoDeuda.AHORROS)
        val pregunta = "Mi ahorro en la cajita MacBook Air M5"
        assertEquals(0L, continuarDeuda(pregunta, estado, listOf(cajita), mapOf("mac" to 0L)).estado?.ahorros)
        assertNull(continuarDeuda(pregunta, estado, listOf(cajita), emptyMap()).estado?.ahorros)
        assertTrue(continuarDeuda(pregunta, estado, listOf(cajita, cajita.copy(id = "otra")), mapOf("mac" to 500L)).respuesta!!.contains("varias cajitas"))
        assertNull(continuarDeuda(pregunta, estado, listOf(cajita.copy(archivedAt = "2026-01-01")), mapOf("mac" to 500L)).estado?.ahorros)
    }

    @Test fun corrigeElDatoAnteriorSinResponderLaPreguntaSiguiente() {
        for (texto in listOf("No perdón, eran 900.000", "Perdón, son 900 mil", "Eran 900000", "Corrijo: 900000", "Me equivoqué, eran 900000")) {
            val inicial = continuarDeuda("90000", ConversacionDeuda(pendiente = CampoDeuda.DEUDA))
            val r = continuarDeuda(texto, inicial.estado)
            assertEquals(texto, 900_000L, r.estado?.deuda)
            assertNull(texto, r.estado?.ahorros)
            assertEquals(texto, CampoDeuda.AHORROS, r.estado?.pendiente)
            assertTrue(texto, r.respuesta!!.contains("corregí"))
        }
    }

    @Test fun corrigeAhorrosYReservaPeroUnMontoSimpleResponde() {
        val deuda = continuarDeuda("900000", ConversacionDeuda(pendiente = CampoDeuda.DEUDA))
        val ahorros = continuarDeuda("1000000", deuda.estado)
        val corregido = continuarDeuda("No perdón, eran 2000000", ahorros.estado)
        assertEquals(900_000L, corregido.estado?.deuda)
        assertEquals(2_000_000L, corregido.estado?.ahorros)
        assertEquals(CampoDeuda.RESERVA, corregido.estado?.pendiente)
        val reserva = continuarDeuda("500000", corregido.estado)
        assertEquals(700_000L, continuarDeuda("Eran 700000", reserva.estado).estado?.reserva)
    }

    @Test fun noAdivinaQueCorregirCuandoNoHayUnDatoAnterior() {
        assertNull(continuarDeuda("No perdón, eran 900000", ConversacionDeuda(pendiente = CampoDeuda.DEUDA)).estado?.deuda)
    }

    @Test fun aceptaUnaRespuestaNatural() {
        for (texto in listOf("El saldo total es 900000", "Mi deuda es 900 mil pesos.", "El saldo pendiente es $900.000", "Son 900000", "En total son 900 mil")) {
            val r = continuarDeuda(texto, ConversacionDeuda(pendiente = CampoDeuda.DEUDA, ingresosInciertos = true))
            assertEquals(texto, 900_000L, r.estado?.deuda)
            assertEquals(texto, CampoDeuda.AHORROS, r.estado?.pendiente)
            assertFalse(texto, r.respuesta!!.contains("Cuál es el saldo total"))
            assertFalse(texto, r.respuesta!!.contains("situación laboral"))
        }
    }

    @Test fun avanzaConAhorrosYReservaExpresadosEnFrases() {
        val ahorro = continuarDeuda("Tengo ahorrado 1,5 millones", ConversacionDeuda(deuda = 900_000, pendiente = CampoDeuda.AHORROS))
        assertEquals(1_500_000L, ahorro.estado?.ahorros)
        val reserva = continuarDeuda("Necesito conservar 500 mil pesos.", ahorro.estado)
        assertEquals(500_000L, reserva.estado?.reserva)
        assertNull(reserva.estado?.pendiente)
    }

    @Test fun noSustituyeElSaldoConDatosAmbiguos() {
        for (texto in listOf("La cuota es 70000", "No sé, entre 500000 y 900000", "La tasa es 2%", "No debo 900000")) {
            val r = continuarDeuda(texto, ConversacionDeuda(pendiente = CampoDeuda.DEUDA))
            assertNull(texto, r.estado?.deuda)
            assertTrue(texto, r.respuesta!!.contains("No pude identificar"))
        }
    }

    @Test fun interpretaMontos() {
        val casos = listOf("70000" to 70_000L, "\$700.000" to 700_000L, "1,5 millones" to 1_500_000L, "70 mil" to 70_000L, "0" to 0L)
        for ((texto, esperado) in casos) assertEquals(texto, esperado, leerMontoConversacion(texto))
    }

    @Test fun noInventaUnMonto() {
        for (texto in listOf("enero 2027", "2% mensual", "70000 y 50000", "-50", "1.5", "no sé")) {
            assertNull(texto, leerMontoConversacion(texto))
        }
    }

    @Test fun recuerdaTresTurnosComparaYPermiteCorregirSinRegistrar() {
        var contexto = AsesorContext()
        fun enviar(texto: String): AsesorResponse {
            assertNull(detectarMovimiento(texto, emptyList(), emptyList(), emptyList(), LEXICO_VACIO, contexto, AHORA).propuesta)
            val r = responder(texto, emptyMap(), emptyList(), contexto)
            contexto = r.newContext
            assertNull(r.action)
            assertNull(r.actions)
            return r
        }
        enviar("Me recomiendas pagar mi deuda con ahorros, mi contrato termina en enero")
        assertEquals(CampoDeuda.AHORROS, enviar("700 mil").newContext.conversacionDeuda?.pendiente)
        assertEquals(CampoDeuda.RESERVA, enviar("1 millón").newContext.conversacionDeuda?.pendiente)
        val comparacion = enviar("500 mil")
        assertTrue(comparacion.text.contains("\$200.000"))
        assertTrue(comparacion.text.contains("por debajo de la reserva"))
        assertEquals(true, contexto.conversacionDeuda?.ingresosInciertos)
        assertTrue(enviar("reserva: 800 mil").text.contains("\$800.000"))
        enviar("Cancelar")
        assertNull(contexto.conversacionDeuda)
        assertEquals(70_000L, responder("Pagué 70 mil en comida", emptyMap(), emptyList(), contexto).action?.amount)
    }

    @Test fun aceptaDatosEtiquetadosJuntosYNoOfreceUsarUnaReservaInexistente() {
        val r = continuarDeuda("deuda: 700 mil; ahorros: 200 mil; reserva: 500 mil")
        assertEquals(700_000L, r.estado?.deuda)
        assertEquals(200_000L, r.estado?.ahorros)
        assertEquals(500_000L, r.estado?.reserva)
        assertTrue(r.respuesta!!.contains("máximo **\$0**"))
        assertTrue(r.respuesta!!.contains("supera tus ahorros"))
    }

    @Test fun noTrataCuotasAmbiguasComoSaldoTotalYPermiteCambiarAUnGasto() {
        val r = continuarDeuda("Mi deuda tiene una cuota de 70000")
        assertNull(r.estado?.deuda)
        val siguiente = continuarDeuda("Pagué 70000 en comida", r.estado)
        assertNull(siguiente.estado)
        assertNull(siguiente.respuesta)
    }

    @Test fun noProponeRegistrarMontosDeSituacion() {
        for (texto in listOf("No pagué 70000", "Mi sueldo es 1500000", "Tengo ahorrado 200000", "No registres 70000 en comida")) {
            assertNull(texto, detectarMovimiento(texto, emptyList(), emptyList(), emptyList(), LEXICO_VACIO, AsesorContext(), AHORA).propuesta)
        }
    }

    @Test fun esConsultaDeudaYRegistroExplicito() {
        assertTrue(esConsultaDeuda("Me recomiendas pagar la tarjeta"))
        assertFalse(esConsultaDeuda("Pagué la tarjeta de crédito"))
        assertTrue(esRegistroExplicito("Ayer gasté 20 mil"))
        assertNotNull(continuarDeuda("Me recomiendas pagar la tarjeta").estado)
    }
}
