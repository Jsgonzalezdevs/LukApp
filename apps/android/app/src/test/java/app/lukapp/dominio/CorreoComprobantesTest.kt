package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

/** Contrato de la bandeja de comprobantes por correo (AnalistaView.tsx y server.ts). */
class CorreoComprobantesTest {
    private val bogota = ZoneId.of("America/Bogota")

    @Test fun fechaEnLaZonaDelDispositivoSinCeroALaIzquierda() {
        // 03:00 UTC del día 6 todavía es el 5 en Bogotá (UTC-5).
        assertEquals("5/3/2026", fechaDeComprobante("2026-03-06T03:00:00+00:00", bogota))
        assertEquals("19/11/2026", fechaDeComprobante("2026-11-19T15:30:00.123Z", bogota))
    }

    @Test fun fechaIlegibleNoRompeLaLista() {
        assertEquals("ilegible", fechaDeComprobante("ilegible", bogota))
        // Sin zona no es un instante válido: se deja la parte de fecha tal como llegó.
        assertEquals("2026-11-19", fechaDeComprobante("2026-11-19 15:00", bogota))
    }

    @Test fun destinoCorrecto() {
        val r = leerDestino(200, """{"direccion":"ab12@correo.lukapp.app"}""")
        assertEquals(ResultadoCorreo.Ok("ab12@correo.lukapp.app"), r)
    }

    @Test fun destinoSinConfigurarDiceElMotivoDelServidor() {
        val r = leerDestino(503, """{"error":"La recepción por correo todavía no está configurada."}""")
        assertEquals(ResultadoCorreo.Falla("La recepción por correo todavía no está configurada."), r)
    }

    @Test fun destinoConCuerpoRaroUsaElMensajeDeLaWeb() {
        assertEquals(ResultadoCorreo.Falla("No se pudo preparar la dirección."), leerDestino(502, "<html>"))
        assertEquals(ResultadoCorreo.Falla("No se pudo preparar la dirección."), leerDestino(200, """{"direccion":""}"""))
    }

    @Test fun adjuntoSoloAceptaElCdnDeResendPorHttps() {
        val bueno = "https://inbound-cdn.resend.com/abc?firma=1"
        assertEquals(ResultadoCorreo.Ok(bueno), leerUrlAdjunto(200, """{"url":"$bueno","nombre":"f.pdf"}"""))
        for (malo in listOf("http://inbound-cdn.resend.com/a", "https://evil.com/a", "https://inbound-cdn.resend.com.evil.com/a", "javascript:alert(1)")) {
            val r = leerUrlAdjunto(200, """{"url":"$malo"}""")
            assertTrue(malo, r is ResultadoCorreo.Falla)
        }
    }

    @Test fun adjuntoConErrorMuestraElDelServidor() {
        assertEquals(
            ResultadoCorreo.Falla("El adjunto supera el límite de 4 MB del importador."),
            leerUrlAdjunto(413, """{"error":"El adjunto supera el límite de 4 MB del importador."}"""),
        )
    }

    @Test fun filasDeLaBaseSeLeenConAdjuntos() {
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
        val filas = json.decodeFromString<List<FilaComprobanteCorreo>>(
            """[{"id":"1","remitente":"a@b.co","asunto":"","recibido_en":"2026-11-19T15:00:00Z","adjuntos":[{"id":"x","nombre":"f.pdf","tipo":"application/pdf"}]},
               {"id":"2","remitente":"c@d.co","asunto":"Factura","recibido_en":"2026-11-18T15:00:00Z","adjuntos":[]}]""",
        )
        val l = aComprobantes(filas, bogota)
        assertEquals(2, l.size)
        assertEquals("19/11/2026", l[0].fechaLegible)
        assertEquals("f.pdf", l[0].adjuntos.single().nombre)
        assertTrue(l[1].adjuntos.isEmpty())
    }
}
