package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/cajitas.test.ts` y `lib/totalVisible.test.ts`. */
class SaldosTest {
    @Test fun sumaDeltasPorCajita() {
        val s = saldosPorCajita(listOf(
            mov(id = "a", cajitaId = "c1", deltaCop = 100000),
            mov(id = "b", cajitaId = "c1", deltaCop = 50000),
            mov(id = "c", cajitaId = "c2", deltaCop = 30000),
        ))
        assertEquals(150000L, s["c1"])
        assertEquals(30000L, s["c2"])
        assertEquals(120000L, saldosPorCajita(listOf(mov(id = "a", deltaCop = 200000), mov(id = "b", kind = "retiro", deltaCop = -80000)))["c1"])
        assertEquals(0L, saldoDeCajita(emptyList(), "c1"))
    }

    @Test fun historicasNoTocanElSaldo() {
        val historica = tx(id = "historica", amountCop = 25_000, category = "comida", description = "Café",
            occurredOn = "2025-01-01", rawTranscript = "extracto", createdAt = "2025-01-01T00:00:00.000Z", afectaSaldo = false)
        val actual = historica.copy(id = "actual", afectaSaldo = true)
        assertEquals(100_000L, saldosPorCajita(listOf(mov(deltaCop = 100_000)), listOf(historica))["c1"])
        assertEquals(75_000L, saldosPorCajita(listOf(mov(deltaCop = 100_000)), listOf(actual))["c1"])
    }

    @Test fun ajuste() {
        assertEquals(50000L, ajusteHacia(150000, 200000))
        assertEquals(-50000L, ajusteHacia(200000, 150000))
        assertEquals(0L, ajusteHacia(150000, 150000))
        val movs = listOf(mov(deltaCop = 137_500))
        val delta = ajusteHacia(saldoDeCajita(movs, "c1"), 300_000)
        assertEquals(300_000L, saldoDeCajita(movs + mov(id = "x", deltaCop = delta), "c1"))
    }

    @Test fun historial() {
        val f = historialDeCajita(listOf(
            mov(id = "a", occurredOn = "2026-08-01", deltaCop = 100000),
            mov(id = "b", occurredOn = "2026-08-05", deltaCop = 50000),
            mov(id = "c", occurredOn = "2026-08-10", kind = "retiro", deltaCop = -20000),
        ), "c1")
        assertEquals(listOf("c", "b", "a"), f.map { it.movimiento.id })
        assertEquals(listOf(130000L, 150000L, 100000L), f.map { it.saldoDespues })
        val g = historialDeCajita(listOf(
            mov(id = "segundo", occurredOn = "2026-08-01", deltaCop = 10000, createdAt = "2026-08-01T12:00:00.000Z"),
            mov(id = "primero", occurredOn = "2026-08-01", deltaCop = 90000, createdAt = "2026-08-01T09:00:00.000Z"),
        ), "c1")
        assertEquals(listOf("segundo", "primero"), g.map { it.movimiento.id })
        assertEquals(listOf(100000L, 90000L), g.map { it.saldoDespues })
        val h = historialDeCajita(listOf(mov(id = "mio", cajitaId = "c1"), mov(id = "ajeno", cajitaId = "c2")), "c1")
        assertEquals(1, h.size)
        assertEquals("mio", h[0].movimiento.id)
    }

    @Test fun totales() {
        val movs = listOf(mov(id = "a", cajitaId = "c1", deltaCop = 100000), mov(id = "b", cajitaId = "c2", deltaCop = 250000))
        assertEquals(350000L, totalEnCajitas(listOf(caj(id = "c1"), caj(id = "c2")), movs))
        assertEquals(100000L, totalEnCajitas(listOf(caj(id = "c1"), caj(id = "c2", archivedAt = "2026-08-01T00:00:00.000Z")), movs))
    }

    @Test fun resumen() {
        val r = resumenDeCajitas(listOf(caj(id = "c1", nombre = "Chica"), caj(id = "c2", nombre = "Grande")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 10000), mov(id = "b", cajitaId = "c2", deltaCop = 500000)))
        assertEquals(listOf("Grande", "Chica"), r.map { it.cajita.nombre })
        assertEquals(25.0, resumenDeCajitas(listOf(caj(metaCop = 400000)), listOf(mov(deltaCop = 100000)))[0].pct!!, 0.0)
        val tope = resumenDeCajitas(listOf(caj(metaCop = 100000)), listOf(mov(deltaCop = 250000)))[0]
        assertEquals(100.0, tope.pct!!, 0.0)
        assertEquals(250000L, tope.saldoCop)
        assertNull(resumenDeCajitas(listOf(caj(metaCop = null)), listOf(mov(deltaCop = 100000)))[0].pct)
    }

    @Test fun patrimonioSeparaYResta() {
        val r = patrimonio(listOf(caj(id = "c1", tipo = "cuenta"), caj(id = "c2"), caj(id = "c3")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 600_000), mov(id = "b", cajitaId = "c2", deltaCop = 300_000), mov(id = "c", cajitaId = "c3", deltaCop = 100_000)))
        assertEquals(600_000L, r.cuentasCop); assertEquals(400_000L, r.cajitasCop); assertEquals(1_000_000L, r.totalCop)
        assertEquals(500_000L, patrimonio(listOf(caj(id = "c1", tipo = "cuenta"), caj(id = "c2", tipo = "cuenta", archivedAt = "2026-01-01T00:00:00.000Z")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 500_000), mov(id = "b", cajitaId = "c2", deltaCop = 900_000))).cuentasCop)
        assertEquals(Patrimonio(0, 0, 0, 0, 0), patrimonio(emptyList(), emptyList()))
        val d = patrimonio(listOf(caj(id = "c1", tipo = "cuenta"), caj(id = "d1", tipo = "deuda"), caj(id = "t1", tipo = "tarjeta")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 1_000_000), mov(id = "b", cajitaId = "d1", deltaCop = 300_000), mov(id = "c", cajitaId = "t1", deltaCop = 200_000)))
        assertEquals(500_000L, d.deudasCop); assertEquals(1_000_000L, d.totalCop); assertEquals(500_000L, d.netoCop)
        assertEquals(-800_000L, patrimonio(listOf(caj(id = "c1", tipo = "cuenta"), caj(id = "d1", tipo = "deuda")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 100_000), mov(id = "b", cajitaId = "d1", deltaCop = 900_000))).netoCop)
        val n = patrimonio(listOf(caj(id = "c1", tipo = "cuenta"), caj(id = "t1", tipo = "tarjeta")),
            listOf(mov(id = "a", cajitaId = "c1", deltaCop = 137_690), mov(id = "b", cajitaId = "t1", deltaCop = -41_000)))
        assertEquals(41_000L, n.deudasCop); assertEquals(96_690L, n.netoCop)
    }

    @Test fun atribuidos() {
        assertEquals(455_000L, saldoDeCajita(listOf(mov(deltaCop = 500_000)), "c1", listOf(tx(amountCop = 45_000))))
        assertEquals(1_400_000L, saldoDeCajita(listOf(mov(deltaCop = 500_000)), "c1", listOf(tx(kind = "ingreso", amountCop = 900_000))))
        assertEquals(500_000L, saldoDeCajita(listOf(mov(deltaCop = 500_000)), "c1", listOf(tx(cuentaId = null))))
        assertEquals(500_000L, saldoDeCajita(listOf(mov(deltaCop = 500_000)), "c1", listOf(tx(cuentaId = "c2"))))
        val movs = listOf(mov(deltaCop = 500_000)); val txs = listOf(tx(amountCop = 45_000))
        val delta = ajusteHacia(saldoDeCajita(movs, "c1", txs), 450_000)
        assertEquals(-5_000L, delta)
        assertEquals(450_000L, saldoDeCajita(movs + mov(id = "ajuste", deltaCop = delta), "c1", txs))
        assertEquals(800_000L, patrimonio(listOf(caj(id = "c1", tipo = "cuenta")), listOf(mov(cajitaId = "c1", deltaCop = 1_000_000)),
            listOf(tx(cuentaId = "c1", amountCop = 200_000))).cuentasCop)
        assertEquals(500_000L, saldoDeCajita(listOf(mov(deltaCop = 500_000)), "c1"))
    }

    private val tarjeta = caj(id = "tar", nombre = "Credito NU", tipo = "tarjeta")
    private val cuenta = caj(id = "cta", nombre = "Nequi", tipo = "cuenta")
    private fun t2(id: String = "t1", cuentaId: String? = "c1", kind: String = "gasto", amountCop: Long = 45_000) =
        tx(id = id, kind = kind, amountCop = amountCop, category = "comida", description = "Almuerzo", cuentaId = cuentaId)

    @Test fun signoDelAtribuido() {
        val p = idsPasivos(listOf(cuenta, tarjeta))
        assertEquals(455_000L, saldosPorCajita(listOf(mov(cajitaId = "cta", deltaCop = 500_000)), listOf(t2(cuentaId = "cta")), p)["cta"])
        assertEquals(245_000L, saldosPorCajita(listOf(mov(cajitaId = "tar", deltaCop = 200_000)), listOf(t2(cuentaId = "tar")), p)["tar"])
        val compra = t2(id = "operacion-1", cuentaId = "tar", amountCop = 80_000)
        val m = mov(id = "operacion-1", cajitaId = "tar", kind = "compra", deltaCop = 80_000, occurredOn = compra.occurredOn)
        assertEquals(80_000L, saldosPorCajita(listOf(m), listOf(compra), p)["tar"])
        val editada = t2(id = "operacion-1", cuentaId = "tar", amountCop = 95_000)
        assertEquals("operacion-1", emparejarComprasTarjeta(listOf(m), listOf(editada), p)["operacion-1"])
        val txs = listOf(t2(id = "tx-a", cuentaId = "tar", amountCop = 40_000), t2(id = "tx-b", cuentaId = "tar", amountCop = 40_000))
        val movs = listOf(
            mov(id = "mov-a", cajitaId = "tar", kind = "compra", deltaCop = 40_000, occurredOn = "2026-08-10"),
            mov(id = "mov-b", cajitaId = "tar", kind = "compra", deltaCop = 40_000, occurredOn = "2026-08-10"),
        )
        assertEquals(2, emparejarComprasTarjeta(movs, txs, p).size)
        assertEquals(80_000L, saldosPorCajita(movs, txs, p)["tar"])
        assertEquals(150_000L, saldosPorCajita(listOf(mov(cajitaId = "tar", deltaCop = 200_000)), listOf(t2(cuentaId = "tar", kind = "ingreso", amountCop = 50_000)), p)["tar"])
        val ms = listOf(mov(cajitaId = "tar", deltaCop = 200_000)); val ts = listOf(t2(cuentaId = "tar"))
        assertEquals(saldosPorCajita(ms, ts, p)["tar"], saldoDeCajita(ms, "tar", ts, p))
        assertEquals(-45_000L, saldosPorCajita(emptyList(), listOf(t2(cuentaId = "tar")))["tar"])
        assertEquals(listOf("deu", "tar"), idsPasivos(listOf(cuenta, tarjeta, caj(id = "deu", tipo = "deuda"), caj(id = "caj"))).sorted())
    }

    @Test fun efectivoCreadoAMano() {
        val efectivo = caj(id = "a3f1c2d4-0000-4000-8000-000000000001", nombre = "Efectivo", tipo = "cuenta")
        val nequi = caj(id = "n1", nombre = "Nequi", tipo = "cuenta")
        val movs = listOf(mov(id = "m1", cajitaId = efectivo.id, deltaCop = 231300), mov(id = "m2", cajitaId = "n1", deltaCop = 100198))
        assertEquals(231300L, saldoEfectivo(listOf(efectivo, nequi), movs))
        assertEquals(100198L, saldoCuentasSinEfectivo(listOf(efectivo, nequi), movs))
        val segunda = caj(id = "a3f1c2d4-0000-4000-8000-000000000002", nombre = "efectivo casa", tipo = "cuenta")
        assertEquals(281300L, saldoEfectivo(listOf(efectivo, segunda, nequi), movs + mov(id = "m3", cajitaId = segunda.id, deltaCop = 50000)))
        assertEquals(0L, saldoEfectivo(listOf(efectivo.copy(archivedAt = "2026-08-10T00:00:00.000Z"), nequi), movs))
    }

    @Test fun comprasDeTarjetaYSaldo() {
        val t = caj(id = "tarjeta", tipo = "tarjeta")
        val compra = mov(id = "compra", cajitaId = t.id, kind = "compra", deltaCop = 899259, occurredOn = "2026-09-07")
        val registro = tx(id = "registro", cuentaId = t.id, amountCop = 899259, occurredOn = "2026-09-07")
        assertEquals(899259L, saldoDeCajita(listOf(compra), t.id, listOf(registro), idsPasivos(listOf(t))))
        val t2 = caj(id = "tarjeta-2", tipo = "tarjeta"); val d = caj(id = "deuda-2", tipo = "deuda")
        assertEquals(800000L, patrimonio(listOf(t2, d), listOf(mov(id = "tarjeta-mov", cajitaId = t2.id, deltaCop = 500000), mov(id = "deuda-mov", cajitaId = d.id, deltaCop = -300000))).deudasCop)
    }

    // ── lib/totalVisible.test.ts ──
    private fun c(id: String, tipo: String) = caj(id = id, nombre = id, tipo = tipo, icon = "wallet")
    private fun m(cajitaId: String, delta: Long) = mov(id = "m_${cajitaId}_$delta", cajitaId = cajitaId, kind = "ajuste", deltaCop = delta, occurredOn = "2026-01-01")
    private val CAJITAS = listOf(c("banco", "cuenta"), c("ahorro", "cajita"), c("tarjeta", "tarjeta"))
    private val MOVS = listOf(m("banco", 1_000_000), m("ahorro", 500_000), m("tarjeta", 300_000))

    @Test fun totalVisibleReglas() {
        assertEquals(1_500_000L, totalVisible(CAJITAS, MOVS, emptyList(), true))
        assertEquals(1_000_000L, totalVisible(CAJITAS, MOVS, emptyList(), false))
        val conDeuda = CAJITAS + c("prestamo", "deuda"); val movs = MOVS + m("prestamo", 200_000)
        assertEquals(1_300_000L, totalVisible(conDeuda, movs, emptyList(), true))
        assertEquals(800_000L, totalVisible(conDeuda, movs, emptyList(), false))
        assertEquals(0L, totalVisible(emptyList(), emptyList(), emptyList(), true))
        assertEquals(0L, totalVisible(emptyList(), emptyList(), emptyList(), false))
    }

    // ── data/modelos.ts y lib/id.ts (sin test web; se fija el comportamiento) ──
    @Test fun claseDeCuentaPorNombre() {
        assertEquals("efectivo", claseDeCuenta(caj(tipo = "cuenta", nombre = "Éfectivo casa")))
        assertEquals("billetera", claseDeCuenta(caj(tipo = "cuenta", nombre = "Mi Nequi")))
        assertEquals("banco", claseDeCuenta(caj(tipo = "cuenta", nombre = "Bancolombia")))
        assertEquals("banco", claseDeCuenta(caj(tipo = "cuenta", nombre = "Nequi", claseCuenta = "banco")))
        assertNull(claseDeCuenta(caj(tipo = "cajita")))
        assertEquals("Billetera digital", etiquetaTipoCajita(caj(tipo = "cuenta", nombre = "daviplata")))
        assertEquals("Tarjeta de crédito", etiquetaTipoCajita(caj(tipo = "tarjeta")))
        assertTrue(esCuentaEfectivo(caj(id = ID_EFECTIVO_VIEJO, tipo = "cuenta", nombre = "x")))
        assertFalse(esCuentaEfectivo(caj(id = ID_EFECTIVO, tipo = "cajita")))
    }

    @Test fun idEfectivoEsDeterministaYV8() {
        val id = idEfectivoParaUsuario("usuario-1")
        assertEquals(id, idEfectivoParaUsuario("usuario-1"))
        assertTrue(Regex("^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$").matches(id))
        assertFalse(id == idEfectivoParaUsuario("usuario-2"))
    }
}
