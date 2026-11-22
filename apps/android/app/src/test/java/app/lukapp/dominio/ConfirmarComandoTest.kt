package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ConfirmarComandoTest {
    private val saldos = mapOf("nequi" to 100_000L, "visa" to -300_000L)
    private fun v(tipo: String, monto: String, o: String = "", d: String = "", deuda: String = "", cuenta: String = "", cajita: String = "") =
        validarComando(tipo, monto, o, d, deuda, cuenta, cajita, saldos)

    @Test fun transferenciaCompletaYSinAvisos() {
        val r = v("transferencia", "50.000", o = "nequi", d = "ahorro")
        assertEquals(50_000L, r.monto); assertTrue(r.camposCompletos); assertFalse(r.saldoInsuficiente); assertFalse(r.mismaCuenta)
    }
    @Test fun mismaCuentaBloqueaPeroSaldoCortoSoloAvisa() {
        assertFalse(v("transferencia", "1.000", o = "nequi", d = "nequi").camposCompletos)
        val corto = v("transferencia", "500.000", o = "nequi", d = "ahorro")
        assertTrue(corto.saldoInsuficiente); assertTrue(corto.camposCompletos); assertEquals(100_000L, corto.saldoOrigenCop)
    }
    @Test fun elAbonoNoPuedePasarDeLaDeudaYUsaLaCuentaDePago() {
        val r = v("abono", "400.000", deuda = "visa", cuenta = "nequi")
        assertTrue(r.abonoExcedeDeuda); assertFalse(r.camposCompletos); assertEquals(300_000L, r.deudaActualCop)
        val ok = v("abono", "80.000", deuda = "visa", cuenta = "nequi")
        assertTrue(ok.camposCompletos); assertFalse(ok.saldoInsuficiente)
        assertTrue(v("abono", "150.000", deuda = "visa", cuenta = "nequi").saldoInsuficiente)
    }
    @Test fun saldoYRendimientoSoloPidenLaCajita() {
        assertTrue(v("saldo", "2.500.000", cajita = "nequi").camposCompletos)
        assertFalse(v("rendimiento", "10.000").camposCompletos)
        assertTrue(v("rendimiento", "10.000", cajita = "ahorro").camposCompletos)
    }
    @Test fun sinMontoValidoNadaSeCompleta() {
        val r = v("transferencia", "", o = "nequi", d = "ahorro")
        assertNull(r.monto); assertFalse(r.camposCompletos)
    }
}
