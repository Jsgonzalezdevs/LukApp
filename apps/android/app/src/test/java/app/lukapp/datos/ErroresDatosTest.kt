package app.lukapp.datos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ErroresDatosTest {
    private val crudo = "No puedes aceptar tu propia invitación.\nCode: P0001\nHint: null\nDetails: null\nURL: https://x/rest/v1/rpc/aceptar\nHeaders: {Authorization=[Bearer ey… (len=1356)]}\nHttp Method: POST"

    @Test fun quedaSoloElMensajeDelServidor() {
        assertEquals("No puedes aceptar tu propia invitación.", mensajeDelServidor(crudo))
        assertEquals("Sin más", mensajeDelServidor("Sin más"))
        assertEquals("Hola", mensajeDelServidor("\n  Hola\nCode: 1"))
    }

    @Test fun traducirErrorNoFiltraCabecerasNiToken() {
        val e = traducirError("No se pudo aceptar la invitación", RuntimeException(crudo))
        assertEquals("No se pudo aceptar la invitación: No puedes aceptar tu propia invitación.", e.message)
        assertTrue(!e.message!!.contains("Bearer") && !e.message!!.contains("URL"))
    }
}
