package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Test

class CuentaTest {
    @Test fun idDeCuentaEsSha256RecortadoYEstable() {
        // sha256("abc") = ba7816bf8f01cfea414140de5dae2223...
        assertEquals("ba7816bf8f01cfea4141", idDeCuenta("abc"))
        assertEquals(20, idDeCuenta("e3b0c442-98fc-4c14-9afb-f4c8996fb924").length)
        assertEquals(idDeCuenta("x"), idDeCuenta("x"))
    }
    @Test fun fechaCortaUsaLaHoraDeBogota() {
        assertEquals("17 nov 2026", fechaCorta("2026-11-17T15:00:00.000Z"))
        // 03:00 UTC del día 18 todavía es el 17 en Bogotá (UTC-5).
        assertEquals("17 nov 2026", fechaCorta("2026-11-18T03:00:00.000Z"))
        assertEquals("1 ene 2027", fechaCorta("2027-01-01T05:00:00.000Z"))
    }
    @Test fun estadoDeSincronizacion() {
        assertEquals("Todo bien" to NivelSync.BIEN, estadoSync(false, 0))
        assertEquals("1 cambio por subir" to NivelSync.PENDIENTE, estadoSync(false, 1))
        assertEquals("3 cambios por subir" to NivelSync.PENDIENTE, estadoSync(false, 3))
        // El error manda aunque haya cambios pendientes.
        assertEquals("Hubo un problema al sincronizar" to NivelSync.ERROR, estadoSync(true, 3))
    }
}
