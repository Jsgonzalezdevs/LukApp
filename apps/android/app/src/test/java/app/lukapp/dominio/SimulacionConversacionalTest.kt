package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/simulacionConversacional.test.ts`. */
class SimulacionConversacionalTest {
    private val entrada = EntradaMotorFinanciero(Libro(), "2026-09-05", PERIODO_POR_DEFECTO)

    @Test fun respetaUnidadesYDejaLasComparacionesDeVariosMontosAlAsesor() {
        assertEquals(100_000L, simularPregunta("Qué pasa si gasto 100 mil", entrada)?.escenario?.montoCop)
        assertEquals(1_500_000L, simularPregunta("Qué pasa si gasto 1,5 millones", entrada)?.escenario?.montoCop)
        assertNull(simularPregunta("Qué pasa si pago 70000 o si ahorro 50000", entrada))
        assertNull(simularPregunta("Me recomiendas pagar mi tarjeta o si pago 70000", entrada))
    }

    @Test fun detectaGastoYDelegaElResultadoAlSimulador() {
        val solicitud = simularPregunta("¿Qué pasa si gasto \$300.000?", entrada)
        assertEquals("simulacion", solicitud?.tipo)
        assertEquals(ModificadorSimulacion.GastoExtraordinario(300_000), solicitud?.escenario)
        assertNotNull(solicitud?.resultado?.base)
        assertTrue(solicitud!!.respuesta.contains("simulación temporal"))
    }

    @Test fun distingueAhorroYAbonoYNoInventaEscenariosSinMonto() {
        assertTrue(simularPregunta("¿Qué pasa si ahorro \$200.000?", entrada)?.escenario is ModificadorSimulacion.AhorroAdicional)
        assertTrue(simularPregunta("¿Qué pasa si pago \$500.000 de mi deuda?", entrada)?.escenario is ModificadorSimulacion.AbonoExtraordinario)
        assertNull(simularPregunta("¿Qué pasa si pago una deuda?", entrada))
    }
}
