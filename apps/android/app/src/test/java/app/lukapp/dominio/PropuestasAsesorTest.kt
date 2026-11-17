package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Paridad con `propuestasAsesor.test.ts`. */
class PropuestasAsesorTest {
    @Test fun proponeUnTopeSoloSiIdentificaCategoriaYMonto() {
        assertEquals(PropuestaAsesor.Presupuesto("comida", 300_000), detectarPropuestaAsesor("Quiero poner un presupuesto de 300 mil para comida"))
        assertNull(detectarPropuestaAsesor("Quiero poner un presupuesto de 300 mil"))
    }

    @Test fun proponeUnaMetaEditableYConservaSuNombre() {
        assertEquals(PropuestaAsesor.Meta("Viajar a Europa", 2_000_000, null), detectarPropuestaAsesor("Quiero crear una meta de 2 millones para viajar a Europa"))
    }

    @Test fun noConvierteUnaConsultaOUnMontoAmbiguoEnAccion() {
        assertNull(detectarPropuestaAsesor("¿Qué es un presupuesto de 300 mil para comida?"))
        assertNull(detectarPropuestaAsesor("Quiero una meta para viajar"))
    }
}
