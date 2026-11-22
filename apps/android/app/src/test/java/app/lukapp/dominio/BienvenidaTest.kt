package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BienvenidaTest {
    private fun fuente(n: String) = FUENTES_DINERO.first { it.nombre == n }

    @Test fun efectivoSeReconoceSinTildesNiMayusculasPeroSoloComoPalabra() {
        assertTrue(esNombreEfectivo("EFECTIVO")); assertTrue(esNombreEfectivo("  mi efectivo ")); assertTrue(esNombreEfectivo("Éfectivo".replace("É", "E")))
        assertFalse(esNombreEfectivo("Efectivos")); assertFalse(esNombreEfectivo("Bancolombia"))
    }
    @Test fun unaFuenteConocidaCreaSuCuentaConSuClase() {
        assertEquals(EleccionDinero("Nequi", ClaseCuenta.BILLETERA, false), eleccionDeFuente(fuente("Nequi"), ""))
        assertEquals(EleccionDinero("Bancolombia", ClaseCuenta.BANCO, false), eleccionDeFuente(fuente("Bancolombia"), "ignorado"))
    }
    @Test fun otroUsaElNombreEscritoYComoBanco() {
        assertEquals(EleccionDinero("Banco de Bogotá", ClaseCuenta.BANCO, false), eleccionDeFuente(fuente("Otro"), "  Banco de Bogotá "))
        assertEquals(EleccionDinero(null, null, false), eleccionDeFuente(fuente("Otro"), "   "))
    }
    @Test fun otroConEfectivoNoCreaNadaYAvisa() = assertEquals(EleccionDinero(null, null, true), eleccionDeFuente(fuente("Otro"), "Efectivo"))
    @Test fun sinFuenteNoHayCuenta() { val e = eleccionDeFuente(null, ""); assertNull(e.banco); assertNull(e.claseCuenta) }
    @Test fun elTecladoQuitaCerosYLimitaADoceDigitos() {
        assertEquals("5", agregarDigitos("0", "5")); assertEquals("0", agregarDigitos("", "0")); assertEquals("45000", agregarDigitos("45", "000"))
        assertEquals("123456789012", agregarDigitos("123456789012", "999"))
    }
}
