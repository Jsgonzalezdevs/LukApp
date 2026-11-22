package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

/** Casos de `lib/composicionCuentas.test.ts` (y de paso `entidadesFinancieras.ts`). */
class ComposicionCuentasTest {
    private fun cuenta(nombre: String) = caj(id = nombre, nombre = nombre, tipo = "cuenta", icon = "PiggyBank", createdAt = "2026-10-21")
    private val nombres = listOf("NuBank", "Nequi", "Efectivo", "Bancolombia", "Davivienda", "Rapi", "Daviplata")
    private val cuentas = nombres.map(::cuenta)

    @Test fun separaLosRojos() {
        val orden = componerCuentas(cuentas, null)
        assertSame(cuentas[0], orden[0])
        for (i in orden.indices) {
            if (entidadDeCuenta(orden[i])?.familiaColor != "rojo") continue
            for (vecina in listOfNotNull(orden.getOrNull(i - 1), orden.getOrNull(i + 1))) {
                assertFalse(entidadDeCuenta(vecina)?.familiaColor in listOf("rojo", "amarillo", "naranja"))
            }
        }
    }

    @Test fun favoritaPrimero() {
        assertSame(cuentas[1], componerCuentas(cuentas, "Nequi")[0])
    }

    @Test fun estableYSinPerderNada() {
        val orden = componerCuentas(cuentas, null)
        assertEquals(componerCuentas(cuentas, null), orden)
        assertEquals(cuentas.size, orden.size)
        assertEquals(cuentas.toSet(), orden.toSet())
        assertEquals(nombres, cuentas.map { it.nombre })
    }

    @Test fun genericasConservanOrden() {
        val g = listOf(cuenta("Personal"), cuenta("Familia"), cuenta("Trabajo"))
        assertEquals(g, componerCuentas(g, null))
    }

    @Test fun vaciasYRepetidas() {
        assertEquals(emptyList<Cajita>(), componerCuentas(emptyList(), null))
        val rojas = listOf("Davivienda personal", "Davivienda trabajo", "Daviplata").map(::cuenta)
        assertEquals(rojas, componerCuentas(rojas, null))
    }

    @Test fun reconocimientoDeEntidades() {
        assertEquals("Nu", reconocerEntidad("NuBank")?.nombre)
        assertEquals("Rappi", reconocerEntidad("Rapi")?.nombre)
        assertEquals("Bancolombia", reconocerEntidad("Bancolombai")?.nombre)
        assertNull(reconocerEntidad("Efectivo"))
        assertNull(reconocerEntidad("Mi banco"))
        assertNull(reconocerEntidad("Nequi y Daviplata"))
        assertEquals("Rappi ahorro", nombreVisibleCuenta(cuenta("rapi ahorro")))
    }
}
