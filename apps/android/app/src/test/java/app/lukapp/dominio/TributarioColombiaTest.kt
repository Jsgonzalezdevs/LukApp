package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `analizarTopesRenta` en `lib/tributarioColombia.test.ts`. */
class TributarioColombiaTest {
    private fun crearTx(id: String, amountCop: Long, kind: String, category: String, description: String, occurredOn: String) =
        Transaccion(id = id, kind = kind, amountCop = amountCop, category = category, description = description, occurredOn = occurredOn, cuentaId = null, rawTranscript = "", createdAt = "2026-08-27T00:00:00Z")

    @Test fun identificaSemaforoVerdeCuandoElUsuarioEstaLejosDelTope() {
        val txs = listOf(
            crearTx("1", 5_000_000, "ingreso", "ingreso", "Sueldo", "2026-03-15"),
            crearTx("2", 2_000_000, "gasto", "mercado", "Mercado", "2026-03-16"),
        )
        val resultado = analizarTopesRenta(txs, 2026)
        assertEquals("verde", resultado.semaforoGeneral)
        assertTrue(resultado.porcentajeConsignaciones < 70)
        assertFalse(resultado.detalles.debeDeclararEstimado)
    }

    @Test fun alertaCuandoLosIngresosSuperan1400Uvt() {
        val tope = TopesRentaUvt.INGRESOS_BRUTOS * 52_374L
        val txs = listOf(crearTx("1", tope + 1_000_000, "ingreso", "ingreso", "Venta de inmueble", "2026-06-10"))
        val resultado = analizarTopesRenta(txs, 2026)
        assertEquals("alerta", resultado.semaforoGeneral)
        assertTrue(resultado.detalles.debeDeclararEstimado)
        assertTrue(resultado.mensajeConsejo.contains("superaron el tope"))
    }
}
