package app.lukapp.dominio

import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/contextoProductoIA.test.ts`. */
class ContextoProductoIATest {
    @Test fun dejaQueElAsesorPrepareUnaPropuestaCuandoLaPersonaDaUnaInstruccion() {
        assertNull(responderAyudaLukApp("Quiero poner un presupuesto de 300 mil para comida"))
    }

    @Test fun explicaDondeEstanLosTopesCuandoLaPreguntaEsDeNavegacion() {
        assertTrue(responderAyudaLukApp("¿Dónde veo los topes?")!!.contains("sección **Mes**"))
    }

    @Test fun dejaQueElMotorFinancieroReviseLasSuscripcionesRegistradas() {
        assertNull(responderAyudaLukApp("Mis suscripciones"))
    }

    @Test fun explicaDondeRevisarPagosFijosCuandoLaPreguntaEsDeNavegacion() {
        assertTrue(responderAyudaLukApp("¿Dónde puedo administrar los pagos fijos?")!!.contains("**Pagos fijos**"))
    }
}
