package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Casos de lib/detalle.test.ts y lib/resumenMes.test.ts (esResumenMesHabilitado).
class DetalleMesTest {
    private fun tx(
        id: String = "t1", kind: String = "gasto", amountCop: Long = 10000,
        description: String = "", occurredOn: String = "2026-07-10",
    ) = Transaccion(id, kind, amountCop, "transferencia", description, occurredOn, null, true, "", null, null, "2026-07-10T00:00:00.000Z")

    @Test fun topContrapartesSumaPorPersonaYOrdena() {
        val filas = topContrapartes(listOf(
            tx("a", description = "Para ANA MARIA GOMEZ", amountCop = 50000),
            tx("b", description = "Para ANA MARIA GOMEZ", amountCop = 30000),
            tx("c", description = "Para LUIS PEREZ", amountCop = 60000),
        ), "gasto")
        assertEquals(FilaContraparte("Ana Maria Gomez", 80000, 2), filas[0])
        assertEquals(FilaContraparte("Luis Perez", 60000, 1), filas[1])
    }

    @Test fun topContrapartesSeparaDirecciones() {
        val m = listOf(tx("a", "gasto", description = "Para ANA MARIA GOMEZ"), tx("b", "ingreso", description = "De LUIS PEREZ"))
        assertEquals(listOf("Ana Maria Gomez"), topContrapartes(m, "gasto").map { it.nombre })
        assertEquals(listOf("Luis Perez"), topContrapartes(m, "ingreso").map { it.nombre })
    }

    @Test fun topContrapartesOmiteSinContraparteYRespetaLimite() {
        assertEquals(1, topContrapartes(listOf(tx(description = "COMPRA PAQUETE PTM"), tx("b", description = "Para ANA GOMEZ")), "gasto").size)
        val muchos = (0 until 12).map { tx("t$it", description = "Para PERSONA NUMERO$it", amountCop = (it + 1) * 1000L) }
        assertEquals(3, topContrapartes(muchos, "gasto", 3).size)
    }

    @Test fun mayoresMovimientosDeLaDireccionPedida() {
        val r = mayoresMovimientos(listOf(tx("chico", amountCop = 5000), tx("grande", amountCop = 900000), tx("ingreso", "ingreso", 5000000)), "gasto", 2)
        assertEquals(listOf("grande", "chico"), r.map { it.id })
    }

    @Test fun porDiaDelMesDevuelveTodosLosDias() {
        val dias = porDiaDelMes(listOf(tx(occurredOn = "2026-07-10", amountCop = 25000)), "2026-07")
        assertEquals(31, dias.size)
        assertEquals(10, dias[9].dia); assertEquals(25000L, dias[9].gastoCop)
        assertEquals(0L, dias[0].gastoCop)
        assertEquals(28, porDiaDelMes(emptyList(), "2026-02").size)
        assertEquals(29, porDiaDelMes(emptyList(), "2024-02").size)
        assertEquals(30, porDiaDelMes(emptyList(), "2026-04").size)
    }

    @Test fun porDiaDelMesSeparaYFiltraElMes() {
        val dias = porDiaDelMes(listOf(tx("g", "gasto", 10000, occurredOn = "2026-07-05"), tx("i", "ingreso", 90000, occurredOn = "2026-07-05")), "2026-07")
        assertEquals(10000L, dias[4].gastoCop); assertEquals(90000L, dias[4].ingresoCop)
        assertTrue(porDiaDelMes(listOf(tx(occurredOn = "2026-06-10", amountCop = 99999)), "2026-07").all { it.gastoCop == 0L })
    }

    @Test fun resumenPromediaSobreDiasConGasto() {
        val r = resumenDetalleMes(listOf(tx("a", amountCop = 30000, occurredOn = "2026-07-01"), tx("b", amountCop = 60000, occurredOn = "2026-07-15")), "2026-07")
        assertEquals(2, r.diasConGasto); assertEquals(45000L, r.promedioPorDiaActivoCop); assertEquals(15, r.diaMasCaro?.dia)
        val vacio = resumenDetalleMes(emptyList(), "2026-07")
        assertEquals(0, vacio.diasConGasto); assertEquals(0L, vacio.promedioPorDiaActivoCop); assertNull(vacio.diaMasCaro)
    }

    @Test fun resumenMesSeHabilitaDosDiasAntes() {
        assertTrue(esResumenMesHabilitado("2026-07", "2026-08-15"))
        assertTrue(esResumenMesHabilitado("2026-01", "2026-08-24"))
        assertFalse(esResumenMesHabilitado("2026-09", "2026-08-24"))
        assertEquals(29, diaDesbloqueoResumen("2026-08"))
        assertFalse(esResumenMesHabilitado("2026-08", "2026-08-28"))
        assertTrue(esResumenMesHabilitado("2026-08", "2026-08-29"))
        assertEquals(28, diaDesbloqueoResumen("2026-09"))
        assertFalse(esResumenMesHabilitado("2026-09", "2026-09-27"))
        assertTrue(esResumenMesHabilitado("2026-09", "2026-09-28"))
        assertEquals(26, diaDesbloqueoResumen("2026-02"))
        assertFalse(esResumenMesHabilitado("2026-02", "2026-02-25"))
        assertTrue(esResumenMesHabilitado("2026-02", "2026-02-26"))
    }
}
