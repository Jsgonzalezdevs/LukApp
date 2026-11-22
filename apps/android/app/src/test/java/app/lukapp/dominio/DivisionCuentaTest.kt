package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DivisionCuentaTest {
    @Test fun propinaDelDiezPorCientoYCuotaQueSubeAlPeso() {
        val r = dividirCuenta(100_000, 10, 3)
        assertEquals(10_000L, r.propina)
        assertEquals(110_000L, r.totalConPropina)
        assertEquals(36_667L, r.cuota)
    }

    @Test fun sinPropinaNiTotal() {
        assertEquals(ResultadoDivision(0, 0, 0, 0), dividirCuenta(0, 0, 2))
        assertEquals(50_000L, dividirCuenta(100_000, 0, 2).cuota)
    }

    @Test fun propinaSeRedondeaAlPesoMasCercano() {
        assertEquals(1_008L, dividirCuenta(10_075, 10, 1).propina)
    }

    @Test fun participantesIniciales() {
        assertEquals(listOf("Persona 1", "Persona 2"), participantesIniciales(2).map { it.nombre })
    }

    @Test fun mensajeIncluyeLugarPropinaYEstadoDeCadaUno() {
        val ps = listOf(ParticipanteDivision("Ana", true), ParticipanteDivision(""))
        val m = mensajeDeCobro(" Crepes ", 10, dividirCuenta(100_000, 10, 2), ps)
        assertTrue(m.startsWith("🧾 *División de cuenta en Crepes*\n"))
        assertTrue(m.contains("• Propina (10%): ${formatCop(10_000)}"))
        assertTrue(m.contains("*${formatCop(55_000)} cada uno*"))
        assertTrue(m.contains("• Ana: Pagó\n• Sin nombre: Pendiente"))
        assertTrue(m.endsWith("Creado con LukApp"))
        assertTrue(!mensajeDeCobro("", 0, dividirCuenta(100_000, 0, 2), ps).contains("Propina"))
    }

    @Test fun descripcionDeMiParte() {
        assertEquals("Mi parte en Asado", descripcionMiParte(" Asado ", 4))
        assertEquals("Mi parte de cuenta (4 personas)", descripcionMiParte("", 4))
    }
}
