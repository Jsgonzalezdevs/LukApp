package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/simuladorFinanciero.test.ts`. */
class SimuladorFinancieroTest {
    private fun cuenta(id: String, tipo: String) =
        Cajita(id = id, nombre = id, icon = "wallet", tipo = tipo, claseCuenta = "banco", createdAt = "2026-01-01")

    private fun movimiento(id: String, cajitaId: String, deltaCop: Long, kind: String = "ajuste") =
        CajitaMovimiento(id = id, cajitaId = cajitaId, kind = kind, deltaCop = deltaCop, categoria = null, occurredOn = "2026-09-01", nota = "", createdAt = "2026-09-01")

    private fun entrada(libro: Libro = Libro()) = EntradaMotorFinanciero(libro, "2026-09-05", PERIODO_POR_DEFECTO)

    @Test fun simulaGastoConservaElDeficitYNoTocaLaInstantaneaOriginal() {
        val libro = Libro(cajitas = listOf(cuenta("banco", "cuenta")), movimientos = listOf(movimiento("saldo", "banco", 1_000_000)))
        val e = entrada(libro)
        val r = simularDecisiones(e, listOf(ModificadorSimulacion.GastoExtraordinario(1_500_000)))
        assertEquals(0L, r.diferencia.disponibleDiario.simulado)
        assertTrue(r.simulado.liquidez.disponibleDiarioBrutoCop < 0)
        assertEquals(libro, e.libro)
    }

    @Test fun simulaAhorroAbonoDeDeudaYReduccionDeGastoSinRegistrarMovimientosReales() {
        val libro = Libro(
            cajitas = listOf(cuenta("banco", "cuenta"), cuenta("deuda", "deuda")),
            movimientos = listOf(movimiento("saldo", "banco", 1_000_000), movimiento("deuda", "deuda", 400_000)),
        )
        val r = simularDecisiones(
            entrada(libro),
            listOf(
                ModificadorSimulacion.AhorroAdicional(100_000),
                ModificadorSimulacion.AbonoExtraordinario(100_000),
                ModificadorSimulacion.ReduccionGasto(50_000, "comida"),
            ),
        )
        assertEquals(r.base.saldo.patrimonioCop, r.simulado.saldo.patrimonioCop)
        assertEquals(2, libro.movimientos.size)
        assertEquals(0, libro.transacciones.size)
        assertEquals(0.0, r.diferencia.patrimonio.cambioPct!!, 0.0)
    }

    @Test fun esDeterministaYElEscenarioVacioCoincideConLaBase() {
        val e = entrada()
        val a = simularDecisiones(e, emptyList())
        val b = simularDecisiones(e, emptyList())
        assertEquals(a.simulado, b.simulado)
        assertEquals(0L, a.diferencia.disponibleDiario.cambioCop)
    }

    @Test fun noSimulaSilenciosamenteAhorroSinCajitaYLimitaAbonosImposibles() {
        val sinCajita = entrada(Libro(cajitas = listOf(cuenta("banco", "cuenta"))))
        val ahorro = simularDecisiones(sinCajita, listOf(ModificadorSimulacion.AhorroAdicional(100_000)))
        assertTrue(ahorro.avisos[0].contains("No hay una cajita"))
        assertEquals(ahorro.base.saldo, ahorro.simulado.saldo)
        val e = entrada(Libro(
            cajitas = listOf(cuenta("banco", "cuenta"), cuenta("deuda", "deuda")),
            movimientos = listOf(movimiento("c", "banco", 50_000), movimiento("d", "deuda", 20_000)),
        ))
        val abono = simularDecisiones(e, listOf(ModificadorSimulacion.AbonoExtraordinario(100_000)))
        assertTrue(abono.avisos[0].contains("limitó"))
        assertEquals(0L, abono.simulado.saldo.saldoDeudasCop)
        assertEquals(30_000L, abono.simulado.saldo.saldoCuentasCop)
    }
}
