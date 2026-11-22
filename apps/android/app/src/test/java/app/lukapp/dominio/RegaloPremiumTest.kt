package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RegaloPremiumTest {
    @Test fun leeUnRegaloValido() {
        val texto = """{"regalo":{"id":42,"dias":30,"venceEn":"2026-12-23T04:59:00+00:00"}}"""
        assertEquals(RegaloPremium(42, 30, "2026-12-23T04:59:00+00:00"), leerRegaloPremium(texto))
    }

    @Test fun aceptaElFormatoIsoConZ() {
        assertEquals(7, leerRegaloPremium("""{"regalo":{"id":1,"dias":7,"venceEn":"2026-11-30T04:59:59.999Z"}}""")?.dias)
    }

    @Test fun sinRegaloNoHayPopUp() {
        assertNull(leerRegaloPremium("""{"regalo":null}"""))
        assertNull(leerRegaloPremium("{}"))
        assertNull(leerRegaloPremium(""))
        assertNull(leerRegaloPremium("no es json"))
        assertNull(leerRegaloPremium("[]"))
    }

    @Test fun rechazaCamposRaros() {
        val base = """"venceEn":"2026-12-23T04:59:00Z""""
        assertNull(leerRegaloPremium("""{"regalo":{"id":0,"dias":30,$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":-3,"dias":30,$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":"42","dias":30,$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":4.5,"dias":30,$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":42,"dias":0,$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":42,"dias":"30",$base}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":42,"dias":30,"venceEn":"mañana"}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":42,"dias":30,"venceEn":20261223}}"""))
        assertNull(leerRegaloPremium("""{"regalo":{"id":42,"dias":30}}"""))
    }

    @Test fun laFechaSaleEnHoraDeBogota() {
        // 04:59 UTC del 23 son las 23:59 del 22 en Bogotá.
        assertEquals("22 de diciembre de 2026", fechaVencimientoRegalo("2026-12-23T04:59:00+00:00"))
        assertEquals("1 de enero de 2027", fechaVencimientoRegalo("2027-01-01T15:00:00Z"))
    }

    @Test fun laPalabraConcuerdaConElNumero() {
        assertEquals("día", palabraDias(1))
        assertEquals("días", palabraDias(30))
    }
}
