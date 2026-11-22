package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Origen: src/features/lukapp/lib/parseTransferenciaVoz.test.ts */
class ParseTransferenciaVozTest {
    private val cuentas = listOf(
        CuentaConocida("nequi", "Nequi"),
        CuentaConocida("banco", "Bancolombia"),
        CuentaConocida("efectivo", "Efectivo"),
    )

    @Test fun `extrae monto, origen y destino de una transferencia dictada`() {
        val r = parseTransferenciaVoz("Transfiere 50 mil de Nequi a Bancolombia", cuentas)!!
        assertEquals("nequi", r.origenId)
        assertEquals("banco", r.destinoId)
        assertEquals(50000L, r.montoCop)
    }

    @Test fun `no convierte un gasto o una transferencia incompleta en movimiento interno`() {
        assertNull(parseTransferenciaVoz("pagué 50 mil desde Nequi", cuentas))
        assertNull(parseTransferenciaVoz("transfiere 50 mil de Nequi", cuentas))
    }

    @Test fun `recupera la transcripcion fonetica degradada sin convertirla en gasto`() {
        val r = parseTransferenciaVoz("Me de Neki o Colombia 18000", cuentas)!!
        assertEquals("nequi", r.origenId)
        assertEquals("banco", r.destinoId)
        assertEquals(18000L, r.montoCop)
    }
}
