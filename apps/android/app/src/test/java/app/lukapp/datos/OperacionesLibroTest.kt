package app.lukapp.datos

import app.lukapp.dominio.Cajita
import app.lukapp.dominio.CajitaMovimiento
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Transaccion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    private fun mov(id: String, caja: String, delta: Long, kind: String = "deposito", nota: String = "") =
        CajitaMovimiento(id, caja, kind, delta, null, "2026-11-01", nota, "2026-11-01T00:00:00.000Z")

    @Test fun fijarSaldoRegistraElAjusteSobreElSaldoEfectivo() {
        // 100.000 de movimientos − 30.000 de un gasto atribuido = 70.000 efectivos; objetivo 90.000 → ajuste +20.000.
        val libro = Libro(cajitas = cuentas, movimientos = listOf(mov("m1", "banco", 100_000)), transacciones = listOf(tx("t1", "banco", 30_000)))
        val c = OperacionesLibro.fijarSaldo(libro, "banco", 90_000)!!
        val m = c.guardar.movimientos.single()
        assertEquals("ajuste", m.kind); assertEquals(20_000L, m.deltaCop); assertEquals("Saldo actualizado", m.nota)
    }

    @Test fun fijarSaldoSinCambioNoHaceNadaSalvoElPrimerCeroDeUnaCuenta() {
        val ya = Libro(cajitas = cuentas, movimientos = listOf(mov("m1", "banco", 0, "ajuste")))
        assertTrue(OperacionesLibro.fijarSaldo(ya, "banco", 0) == null)
        // Una cuenta que nunca confirmó su saldo: escribir 0 sí es información.
        val sinConfirmar = Libro(cajitas = cuentas)
        assertEquals(0L, OperacionesLibro.fijarSaldo(sinConfirmar, "banco", 0)!!.guardar.movimientos.single().deltaCop)
        // Una cajita de ahorro sin cambio: nada.
        assertTrue(OperacionesLibro.fijarSaldo(Libro(cajitas = listOf(cajita("ahorro", "cajita"))), "ahorro", 0) == null)
    }

    @Test fun borrarCuentaConservaLoDemasSinVinculo() {
        val libro = Libro(
            cajitas = cuentas, movimientos = listOf(mov("m1", "banco", 100), mov("m2", "visa", 5)),
            transacciones = listOf(tx("t1", "banco"), tx("t2", "visa")),
            metas = listOf(app.lukapp.dominio.Meta("g1", "Viaje", "Plane", 1000, null, "banco", 0, "2026-01-01T00:00:00.000Z", null)),
        )
        val c = OperacionesLibro.borrarCajita(libro, "banco")
        assertEquals(listOf("banco"), c.borrar["cajitas"]); assertEquals(listOf("m1"), c.borrar["cajitaMovimientos"])
        assertEquals(listOf("t1"), c.guardar.transacciones.map { it.id }); assertEquals(null, c.guardar.transacciones.single().cuentaId)
        assertEquals(null, c.guardar.metas.single().cajitaId)
        val despues = aplicarLocal(libro, c)
        assertEquals(listOf("visa"), despues.cajitas.map { it.id }); assertEquals(listOf("m2"), despues.movimientos.map { it.id })
        assertEquals(2, despues.transacciones.size); assertEquals(null, despues.transacciones.first { it.id == "t1" }.cuentaId)
    }

    @Test fun abonarBajaLaDeudaYLaCuentaSinCrearUnGasto() {
        val libro = Libro(cajitas = listOf(cajita("banco", "cuenta").copy(nombre = "Bancolombia"), cajita("visa", "tarjeta").copy(nombre = "Visa")))
        val c = OperacionesLibro.abonarDeuda(libro, "visa", "banco", 40_000)!!
        assertTrue(c.guardar.transacciones.isEmpty())
        val (enDeuda, enCuenta) = c.guardar.movimientos
        assertEquals("visa", enDeuda.cajitaId); assertEquals("abono", enDeuda.kind); assertEquals(-40_000L, enDeuda.deltaCop); assertEquals("Pagado desde Bancolombia", enDeuda.nota)
        assertEquals("banco", enCuenta.cajitaId); assertEquals("retiro", enCuenta.kind); assertEquals(-40_000L, enCuenta.deltaCop); assertEquals("Abono a Visa", enCuenta.nota)
        assertTrue(OperacionesLibro.abonarDeuda(libro, "visa", "banco", 0) == null)
    }

    @Test fun compraConTarjetaGuardaElMovimientoYElGastoConElMismoId() {
        val libro = Libro(cajitas = cuentas)
        val c = OperacionesLibro.registrarCompra(libro, "visa", 90_000, "ropa", "Zapatos", cuotasTotal = 3, cuotaCop = 30_000)
        val m = c.guardar.movimientos.single(); val g = c.guardar.transacciones.single()
        assertEquals(m.id, g.id); assertEquals("compra", m.kind); assertEquals(90_000L, m.deltaCop)
        assertEquals("gasto", g.kind); assertEquals("visa", g.cuentaId); assertEquals(3, g.cuotasTotal); assertEquals(30_000L, g.cuotaCop)
        // Con el libro armado, la compra queda emparejada: una sola vez en el saldo de la tarjeta.
        val despues = aplicarLocal(libro, c)
        assertEquals(90_000L, app.lukapp.dominio.saldoDeCajita(despues.movimientos, "visa", despues.transacciones, setOf("visa")))
    }

    @Test fun unaSolaCuotaNoEsFinanciada() {
        val c = OperacionesLibro.registrarCompra(Libro(cajitas = cuentas), "visa", 10_000, "comida", cuotasTotal = 1, cuotaCop = 10_000)
        assertEquals(null, c.guardar.transacciones.single().cuotasTotal); assertEquals(null, c.guardar.movimientos.single().cuotaCop)
    }

    @Test fun fijarPresupuestoConservaLaFechaOriginalYRechazaCero() {
        val libro = Libro(presupuestos = listOf(app.lukapp.dominio.Presupuesto("comida", 100_000, "2026-01-01T00:00:00.000Z")))
        val c = OperacionesLibro.fijarPresupuesto(libro, "comida", 300_000)!!
        assertEquals(listOf(app.lukapp.dominio.Presupuesto("comida", 300_000, "2026-01-01T00:00:00.000Z")), c.guardar.presupuestos)
        assertEquals(null, OperacionesLibro.fijarPresupuesto(libro, "comida", 0))
    }

    @Test fun crearMetaEmpiezaSinCompletarYSinAhorro() {
        val m = OperacionesLibro.crearMeta(Libro(), "Viaje", 2_000_000, null).guardar.metas.single()
        assertEquals("Viaje", m.nombre); assertEquals("Target", m.icon); assertEquals(0L, m.ahorradoCop); assertEquals(null, m.completedAt)
    }

    @Test fun quitarPresupuestoBorraPorCategoriaYNoTocaNadaMas() {
        val c = OperacionesLibro.quitarPresupuesto("comida")
        assertEquals(mapOf("presupuestos" to listOf("comida")), c.borrar)
        assertEquals(Libro(), c.guardar)
    }

    @Test fun crearRecurrenteEmpiezaActivoYConfirmarLoVuelveMovimientoConSuFecha() {
        val r = OperacionesLibro.crearRecurrente("Arriendo", app.lukapp.dominio.TipoTx.GASTO, 900_000, "vivienda", null, 5).guardar.recurrentes.single()
        assertEquals("Arriendo", r.nombre); assertEquals(5, r.diaDelMes); assertEquals(null, r.archivedAt)
        val tx = OperacionesLibro.confirmarRecurrente(app.lukapp.dominio.Pendiente(r, "2026-11-05", true)).guardar.transacciones.single()
        // Lleva la fecha que le tocaba, no la de hoy, y dice de dónde salió.
        assertEquals("2026-11-05", tx.occurredOn); assertEquals(900_000L, tx.amountCop); assertEquals("Recurrente: Arriendo", tx.rawTranscript)
    }

    @Test fun borrarRecurrenteBorraPorId() {
        assertEquals(mapOf("recurrentes" to listOf("x")), OperacionesLibro.borrarRecurrente("x").borrar)
    }

    private fun cuentaDe(id: String, nombre: String) = app.lukapp.dominio.Cajita(id, nombre, "Wallet", app.lukapp.dominio.TipoCajita.CUENTA, createdAt = "2026-01-01T00:00:00Z")

    @Test fun crearCajitaVuelveUnicoElNombreSinImportarMayusculas() {
        val libro = Libro(cajitas = listOf(cuentaDe("a", "Nequi")))
        val c = OperacionesLibro.crearCajita(libro, "  nequi ", "Wallet", app.lukapp.dominio.TipoCajita.CUENTA, null, null, null, false, "COP", null)
        assertEquals("nequi (2)", c.guardar.cajitas.single().nombre)
    }

    @Test fun crearCuentaInfiereLaClasePorNombreYElSaldoEnBlancoQuedaPendiente() {
        val c = OperacionesLibro.crearCajita(Libro(), "Nequi", "Wallet", app.lukapp.dominio.TipoCajita.CUENTA, null, null, null, false, "COP", null)
        assertEquals("billetera", c.guardar.cajitas.single().claseCuenta)
        assertTrue(c.guardar.movimientos.isEmpty())
        // Escribir 0 es un saldo confirmado: sí abre movimiento.
        val cero = OperacionesLibro.crearCajita(Libro(), "Nequi", "Wallet", app.lukapp.dominio.TipoCajita.CUENTA, null, null, null, false, "COP", 0)
        assertEquals(0L, cero.guardar.movimientos.single().deltaCop)
    }

    @Test fun crearAhorroSoloAbreMovimientoSiEmpiezaConPlata() {
        val sin = OperacionesLibro.crearCajita(Libro(), "Viaje", "Plane", app.lukapp.dominio.TipoCajita.CAJITA, null, 2_000_000, 9.5, false, "COP", 0)
        assertTrue(sin.guardar.movimientos.isEmpty()); assertEquals(null, sin.guardar.cajitas.single().claseCuenta); assertEquals(9.5, sin.guardar.cajitas.single().tasaEaPct!!, 0.0)
        val con = OperacionesLibro.crearCajita(Libro(), "Viaje", "Plane", app.lukapp.dominio.TipoCajita.CAJITA, null, null, null, true, "USD", 150_000)
        assertEquals("Saldo inicial", con.guardar.movimientos.single().nota); assertEquals("USD", con.guardar.cajitas.single().moneda)
    }

    @Test fun transferirEsUnParDeMovimientosYUnaFilaNeutral() {
        val libro = Libro(cajitas = listOf(cuentaDe("a", "Nequi"), cuentaDe("b", "Bancolombia")))
        val c = OperacionesLibro.transferir(libro, "a", "b", 50_000, "2026-11-17")!!
        assertEquals(listOf(-50_000L, 50_000L), c.guardar.movimientos.map { it.deltaCop })
        assertEquals("Enviado a Bancolombia", c.guardar.movimientos[0].nota); assertEquals("Recibido de Nequi", c.guardar.movimientos[1].nota)
        val tx = c.guardar.transacciones.single()
        // Ni gasto ni ingreso: si lo fuera, inflaría los dos lados del mes.
        assertEquals(app.lukapp.dominio.TipoTx.TRANSFERENCIA, tx.kind); assertEquals(null, tx.cuentaId)
    }

    @Test fun transferirANadaOASiMismaNoHaceNada() {
        val libro = Libro(cajitas = listOf(cuentaDe("a", "Nequi"), cuentaDe("b", "Bancolombia")))
        assertNull(OperacionesLibro.transferir(libro, "a", "a", 100))
        assertNull(OperacionesLibro.transferir(libro, "a", "b", 0))
    }
}
