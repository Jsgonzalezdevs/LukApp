package app.lukapp.dominio

import app.lukapp.dominio.voz.parseMultipleTransactions
import app.lukapp.dominio.voz.parseTransaction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MultiplesTest {
    @Test fun unDictadoConDosCosasDaDosMovimientosConSusTotales() {
        val items = parseMultipleTransactions("gasté 45 mil en almuerzo y 12 mil en transporte")
        assertEquals(2, items.size)
        val (gastos, ingresos) = totalesMultiples(items)
        assertEquals(57_000L, gastos); assertEquals(0L, ingresos)
    }
    @Test fun sinDescripcionSeGuardaLoDichoYSinCuentaLaFavorita() {
        val base = parseTransaction("gasté 20 mil en pan")
        val sinTexto = base.copy(description = "", cuentaId = null)
        val m = movimientosDeMultiples(listOf(sinTexto, base.copy(cuentaId = "nequi")), "efectivo")
        assertEquals(sinTexto.raw, m[0].description); assertEquals("efectivo", m[0].cuentaId); assertEquals("nequi", m[1].cuentaId)
        assertTrue(m.all { it.amountCop == 20_000L })
    }
    @Test fun unMontoSinLeerSeGuardaEnCeroYNoSuma() {
        val sinMonto = parseTransaction("gasté en pan").copy(amount = null)
        assertEquals(0L, movimientosDeMultiples(listOf(sinMonto), null)[0].amountCop)
        assertEquals(0L to 0L, totalesMultiples(listOf(sinMonto)))
    }
}
