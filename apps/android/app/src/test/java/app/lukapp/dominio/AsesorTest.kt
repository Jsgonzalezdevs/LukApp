package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Test

class AsesorTest {
    @Test fun `la pose sigue los umbrales de la web`() {
        assertEquals(10, elegirIndiceImagenLuki(0.0))
        assertEquals(4, elegirIndiceImagenLuki(0.00005))
        assertEquals(0, elegirIndiceImagenLuki(0.2))
        assertEquals(1, elegirIndiceImagenLuki(0.45))
        assertEquals(7, elegirIndiceImagenLuki(0.80))
        assertEquals(9, elegirIndiceImagenLuki(0.99))
    }

    @Test fun `quita el pensamiento del modelo`() {
        assertEquals("Hola", limpiarTextoChat("<think>mmm</think> Hola "))
        assertEquals("", limpiarTextoChat("<think>sin cerrar"))
        assertEquals("Respuesta", limpiarTextoChat("Here's a thinking process:\nx\n\nRespuesta"))
    }
}
