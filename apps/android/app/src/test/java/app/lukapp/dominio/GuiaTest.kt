package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Test

class GuiaTest {
    @Test fun sinBienvenidaOConUnaPantallaEncimaNoSale() {
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(false, false, emptyList(), "inicio", false))
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(true, false, emptyList(), "inicio", true))
    }
    @Test fun elBasicoSaleUnaVezEnInicioYNoEnOtraSeccion() {
        assertEquals(GuiaPendiente.BASICA, guiaPendiente(true, false, emptyList(), "inicio", false))
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(true, false, emptyList(), "dinero", false))
    }
    @Test fun losGlobosDeSeccionSalenSoloTrasElBasicoYUnaVezCadaUno() {
        assertEquals(GuiaPendiente.SECCION, guiaPendiente(true, true, emptyList(), "dinero", false))
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(true, true, listOf("dinero"), "dinero", false))
        assertEquals(GuiaPendiente.SECCION, guiaPendiente(true, true, listOf("dinero"), "mes", false))
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(true, true, emptyList(), "inicio", false))
        assertEquals(GuiaPendiente.NINGUNA, guiaPendiente(true, true, emptyList(), "calendario", false))
    }
}
