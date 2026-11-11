package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Casos de `lib/motorFinanciero.test.ts`, `lib/proyeccionFinanciera.test.ts`,
 * `lib/proyeccionE2E.test.ts`; los de preparacionInicio y señales salen del código.
 */
class MotorFinancieroTest {
    private val HOY = "2026-09-05"
    private fun cajita(id: String, tipo: String, clase: String? = "banco", diaCorte: Int? = null, diaPago: Int? = null) =
        caj(id = id, nombre = id, icon = "wallet", tipo = tipo, claseCuenta = clase, createdAt = "2026-01-01", diaCorte = diaCorte, diaPago = diaPago)
    private fun movimiento(id: String, cajitaId: String, delta: Long) =
        mov(id = id, cajitaId = cajitaId, kind = "ajuste", deltaCop = delta, occurredOn = "2026-09-01", createdAt = "2026-09-01")
    private fun compra(id: String, tarjetaId: String, cuotas: Int? = null, cuota: Long? = null) =
        tx(id = id, amountCop = 1_200_000, category = "comida", description = id, occurredOn = "2026-09-02", cuentaId = tarjetaId, createdAt = "2026-09-02", cuotasTotal = cuotas, cuotaCop = cuota)
    private fun rec(id: String, nombre: String, kind: String, monto: Long, dia: Int, cuentaId: String? = null) =
        Recurrente(id, nombre, kind, monto, "hogar", cuentaId, dia, "2026-01-01", null)
    private fun contexto(libro: Libro) = construirContextoFinanciero(libro, HOY, PERIODO_POR_DEFECTO)

    @Test fun separaTarjetasDeDeudas() {
        val r = contexto(Libro(
            cajitas = listOf(cajita("banco", "cuenta"), cajita("tarjeta", "tarjeta"), cajita("prestamo", "deuda")),
            movimientos = listOf(movimiento("a", "banco", 1_000_000), movimiento("b", "tarjeta", 300_000), movimiento("c", "prestamo", 200_000)),
        ))
        assertEquals(1_000_000L, r.saldo.saldoCuentasCop); assertEquals(300_000L, r.saldo.saldoTarjetasCop)
        assertEquals(200_000L, r.saldo.saldoDeudasCop); assertEquals(500_000L, r.saldo.patrimonioCop)
        assertEquals(0L, r.saldo.saldoEfectivoCop); assertEquals(1_000_000L, r.saldo.saldoBancosCop)
    }

    @Test fun recurrentesYCuotasSinRegistrar() {
        val txs = listOf(compra("compra", "tarjeta", 3, 400_000))
        val r = contexto(Libro(cajitas = listOf(cajita("tarjeta", "tarjeta")), transacciones = txs, recurrentes = listOf(rec("r", "Arriendo", "gasto", 800_000, 15))))
        assertTrue(r.obligaciones.any { it.concepto == "Arriendo" && it.estado == "programada" })
        assertTrue(r.obligaciones.any { it.origen == "tarjeta" })
        assertEquals(1, txs.size)
    }

    @Test fun metasEnlazadasYProyeccionLimitada() {
        val meta = Meta("m", "Viaje", "plane", 500_000, "2026-12-01", "ahorro", 0, "2026-01-01", null)
        val r = contexto(Libro(cajitas = listOf(cajita("ahorro", "cajita")), movimientos = listOf(movimiento("a", "ahorro", 250_000)), metas = listOf(meta)))
        assertEquals(250_000L, r.metas[0].progreso.ahorradoCop)
        assertTrue(r.proyeccion.limitada)
        assertTrue(r.compromisos.datosIncompletos)
        assertEquals("baja", r.liquidez.confianza)
        assertEquals("en_riesgo", r.metasInteligentes[0].viabilidad)
    }

    @Test fun deficitBruto() {
        val r = contexto(Libro(cajitas = listOf(cajita("banco", "cuenta")), movimientos = listOf(movimiento("saldo", "banco", 100_000)),
            recurrentes = listOf(rec("r", "Arriendo", "gasto", 500_000, 10, "banco"))))
        assertTrue(r.liquidez.disponibleDiarioBrutoCop < 0)
        assertEquals(0L, r.liquidez.disponibleDiarioCop)
        assertTrue(r.liquidez.dineroLibreBrutoCop < 0)
        assertEquals("riesgo", r.liquidez.nivel)
        assertEquals("Arriendo", r.liquidez.factores[0].concepto)
        // Mensual puro: igual que la web, cuentan todas las obligaciones fechadas del horizonte (sep, oct, nov).
        assertEquals(3, r.liquidez.factores.size)
        assertEquals(100_000L - 1_500_000L, r.liquidez.dineroLibreBrutoCop)
        assertEquals(26, r.liquidez.diasRestantesPeriodo)
        assertTrue(r.anomalias.any { it.id == "liquidez-deficit-proyectado" })
    }

    @Test fun compraConTarjetaNoVaciaElDisponible() {
        val r = contexto(Libro(cajitas = listOf(cajita("banco", "cuenta"), cajita("tarjeta", "tarjeta", diaCorte = 10, diaPago = 15)),
            movimientos = listOf(movimiento("saldo", "banco", 72_000)), transacciones = listOf(compra("compra-tarjeta", "tarjeta"))))
        assertEquals(1_200_000L, r.saldo.saldoTarjetasCop)
        assertEquals(72_000L, r.liquidez.dineroLibreCop)
    }

    @Test fun disponibleDiarioYEfectivo() {
        val r = contexto(Libro(
            cajitas = listOf(cajita("efe", "cuenta", clase = null).copy(nombre = "Efectivo"), cajita("banco", "cuenta")),
            movimientos = listOf(movimiento("a", "efe", 50_000), movimiento("b", "banco", 210_000)),
        ))
        assertEquals(50_000L, r.saldo.saldoEfectivoCop); assertEquals(210_000L, r.saldo.saldoBancosCop)
        assertEquals(260_000L, r.liquidez.dineroLibreCop)
        assertEquals(10_000L, r.liquidez.disponibleDiarioCop)
        assertEquals("incompleto", r.liquidez.nivel)
        assertEquals(3, r.forecast!!.horizontes.size)
        assertEquals(260_000L, r.forecast!!.horizontes[0].base.liquidezCop)
        assertNull(r.forecast!!.horizontes[0].conservador.liquidezCop)
    }

    @Test fun semanalAcotaLasObligacionesAlPeriodo() {
        val libro = Libro(cajitas = listOf(cajita("banco", "cuenta")), movimientos = listOf(movimiento("s", "banco", 1_000_000)),
            recurrentes = listOf(rec("r", "Gym", "gasto", 100_000, 6, "banco"), rec("q", "Luz", "gasto", 50_000, 20, "banco")))
        val r = construirContextoFinanciero(libro, HOY, ConfigPeriodo("semanal"))
        // 2026-09-05 es sábado: la semana termina el domingo 6 y solo entra el Gym.
        assertEquals(listOf("Gym"), r.liquidez.factores.map { it.concepto })
        assertEquals(2, r.liquidez.diasRestantesPeriodo)
        assertEquals(450_000L, r.liquidez.disponibleDiarioCop)
    }

    // ── proyeccionFinanciera.test.ts ──
    private val cuenta = caj(id = "c", nombre = "Banco", icon = "wallet", tipo = "cuenta", createdAt = "2026-01-01")
    private fun base(recurrentes: List<Recurrente>) = Libro(cajitas = listOf(cuenta),
        movimientos = listOf(mov(id = "saldo", cajitaId = "c", kind = "ajuste", deltaCop = 1_000, occurredOn = "2026-09-01", createdAt = "2026-09-01")),
        recurrentes = recurrentes)
    private fun r2(kind: String, dia: Int = 10) = Recurrente(kind, kind, kind, if (kind == "gasto") 100 else 500, "hogar", "c", dia, "2026-01-01", null)

    @Test fun proyeccionDeterminista() {
        val e = base(listOf(r2("gasto")))
        val o = construirObligacionesFuturas(e, HOY, 90)
        val f = construirEntradasFuturas(e, HOY, 90)
        assertEquals(8, proyectarFinanzas(e, HOY, o, f, 7).size)
        assertEquals(31, proyectarFinanzas(e, HOY, o, f, 30).size)
        assertEquals(91, proyectarFinanzas(e, HOY, o, f, 90).size)
        assertEquals(proyectarFinanzas(e, HOY, o, f, 30), proyectarFinanzas(e, HOY, o, f, 30))
    }

    @Test fun cadaRecurrenteUnaVez() {
        val e = base(listOf(r2("gasto", 10), r2("ingreso", 20)))
        val o = construirObligacionesFuturas(e, HOY, 30)
        assertEquals(1, o.count { it.concepto == "gasto" })
        assertFalse(o.any { it.concepto == "ingreso" })
        val f = construirEntradasFuturas(e, HOY, 30)
        val punto = proyectarFinanzas(e, HOY, o, f, 30).first { it.fecha == "2026-09-20" }
        assertEquals(500L, punto.entradasCop)
        assertEquals(1_400L, punto.saldoLiquidoCop)
    }

    @Test fun e2eDeudaSinFechaEIngresos() {
        val libro = Libro(cajitas = listOf(caj(id = "cuenta", nombre = "cuenta", tipo = "cuenta"), caj(id = "deuda", nombre = "deuda", tipo = "deuda")),
            movimientos = listOf(movimiento("saldo", "cuenta", 2_000_000), movimiento("deuda", "deuda", 500_000)),
            recurrentes = listOf(Recurrente("salario", "Salario", "ingreso", 1_000_000, "otros", "cuenta", 15, "2026-01-01", null)))
        val c = contexto(libro)
        val deuda = c.obligaciones.first { it.origen == "deuda" }
        assertEquals(500_000L, deuda.montoCop); assertNull(deuda.fecha); assertEquals("desconocida", deuda.certeza)
        assertEquals(3, c.entradasFuturas.size)
        assertTrue(c.proyeccionCompleta.any { it.entradasCop == 1_000_000L })
    }

    // ── preparacionInicio.ts ──
    @Test fun preparacion() {
        val vacio = preparacionInicio(Libro())
        assertFalse(vacio.saldosCompletos); assertFalse(vacio.primerMovimiento)
        val libro = Libro(
            cajitas = listOf(cajita("a", "cuenta"), cajita("b", "cuenta"), cajita("x", "cuenta").copy(archivedAt = "2026-01-02"), cajita("t", "tarjeta")),
            movimientos = listOf(movimiento("m", "a", 10), mov(id = "n", cajitaId = "b", kind = "deposito", nota = "Saldo inicial")),
            transacciones = listOf(tx()),
        )
        val p = preparacionInicio(libro)
        assertEquals(listOf("a", "b"), p.cuentas.map { it.id })
        assertTrue(p.saldosCompletos); assertTrue(p.primerMovimiento)
        assertEquals(listOf("b"), preparacionInicio(libro.copy(movimientos = libro.movimientos.drop(0).filter { it.cajitaId == "a" })).sinSaldo.map { it.id })
        assertFalse(tieneSaldoConfirmado("a", listOf(mov(cajitaId = "a", kind = "retiro"))))
    }
}
