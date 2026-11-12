package app.lukapp.datos

import app.lukapp.dominio.Cajita
import app.lukapp.dominio.CajitaMovimiento
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Transaccion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OperacionesLibroTest {
    private fun tx(id: String, cuenta: String?, monto: Long = 50_000, kind: String = "gasto", cat: String = "comida") =
        Transaccion(id, kind, monto, cat, "Almuerzo", "2026-11-10", cuenta, true, "", null, null, "2026-11-10T12:00:00.000Z")
    private fun cajita(id: String, tipo: String) = Cajita(id, id, "Wallet", tipo, createdAt = "2026-01-01T00:00:00.000Z")
    private fun compra(id: String, tarjeta: String, monto: Long = 50_000) =
        CajitaMovimiento(id, tarjeta, "compra", monto, "comida", "2026-11-10", "Almuerzo", "2026-11-10T12:00:00.000Z")

    private val cuentas = listOf(cajita("banco", "cuenta"), cajita("visa", "tarjeta"))

    @Test fun borrarUnMovimientoDeCuentaSoloBorraLaTransaccion() {
        val libro = Libro(transacciones = listOf(tx("t1", "banco")), cajitas = cuentas)
        assertEquals(mapOf("transacciones" to listOf("t1")), OperacionesLibro.borrarTransaccion(libro, "t1").borrar)
    }

    @Test fun borrarUnaCompraDeTarjetaBorraTambienSuMovimiento() {
        // La web guarda la compra con el mismo id en los dos sitios.
        val libro = Libro(transacciones = listOf(tx("t1", "visa")), cajitas = cuentas, movimientos = listOf(compra("t1", "visa")))
        val c = OperacionesLibro.borrarTransaccion(libro, "t1")
        assertEquals(listOf("t1"), c.borrar["transacciones"])
        assertEquals(listOf("t1"), c.borrar["cajitaMovimientos"])
    }

    @Test fun editarUnaCompraDeTarjetaActualizaLosDosLados() {
        val libro = Libro(transacciones = listOf(tx("t1", "visa")), cajitas = cuentas, movimientos = listOf(compra("t1", "visa")))
        val c = OperacionesLibro.actualizarTransaccion(libro, tx("t1", "visa", monto = 80_000).copy(description = "Cena"))
        assertEquals(80_000L, c.guardar.transacciones.single().amountCop)
        val mov = c.guardar.movimientos.single()
        assertEquals(80_000L, mov.deltaCop); assertEquals("Cena", mov.nota); assertTrue(c.borrar.isEmpty())
    }

    @Test fun pasarUnaCompraDeTarjetaAUnaCuentaBorraElMovimientoDeLaTarjeta() {
        val libro = Libro(transacciones = listOf(tx("t1", "visa")), cajitas = cuentas, movimientos = listOf(compra("t1", "visa")))
        val c = OperacionesLibro.actualizarTransaccion(libro, tx("t1", "banco"))
        assertTrue(c.guardar.movimientos.isEmpty())
        assertEquals(listOf("t1"), c.borrar["cajitaMovimientos"])
    }

    @Test fun editarUnMovimientoNormalSoloGuardaLaTransaccion() {
        val libro = Libro(transacciones = listOf(tx("t1", "banco")), cajitas = cuentas)
        val c = OperacionesLibro.actualizarTransaccion(libro, tx("t1", "banco", monto = 1))
        assertEquals(1, c.guardar.transacciones.size); assertTrue(c.guardar.movimientos.isEmpty()); assertTrue(c.borrar.isEmpty())
    }

    @Test fun anomaliaFueraDeDosDesviaciones() {
        val historial = listOf(10_000L, 11_000L, 9_000L, 10_500L, 9_500L).mapIndexed { i, m -> tx("h$i", "banco", m) }
        assertTrue(analizarAnomalias(historial, "comida", 100_000).esAnomalia)
        assertFalse(analizarAnomalias(historial, "comida", 10_200).esAnomalia)
        assertFalse(analizarAnomalias(emptyList(), "comida", 10_200).esAnomalia)
        assertEquals(10_000.0, analizarAnomalias(historial, "comida", 1).promedio, 0.001)
    }
}
