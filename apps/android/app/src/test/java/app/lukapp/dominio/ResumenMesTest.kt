package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Reglas de `lib/resumenMes.ts`. */
class ResumenMesTest {
    private fun g(id: String, fecha: String, monto: Long, cat: String = "comida") =
        tx(id = id, kind = "gasto", amountCop = monto, category = cat, occurredOn = fecha, createdAt = "${fecha}T12:00:00.000Z")
    private fun i(id: String, fecha: String, monto: Long) =
        tx(id = id, kind = "ingreso", amountCop = monto, category = "sueldo", occurredOn = fecha, createdAt = "${fecha}T12:00:00.000Z")

    @Test fun mesVacioSoloTrae_portada_balance_y_cierre() {
        val t = resumenDelMes(emptyList(), "2026-07", "2026-08-15")
        // Como la web: los días activos y la racha aparecen igual (mes pasado), sin categoría ni gasto caro.
        assertTrue(t.first() is TarjetaResumen.Portada)
        assertTrue(t.none { it is TarjetaResumen.CategoriaEstrella || it is TarjetaResumen.GastoMasCaro })
        val cierre = t.last() as TarjetaResumen.Cierre
        assertEquals(Tono.NEUTRAL, cierre.tono)
        assertEquals("Un mes sin movimientos registrados todavía.", cierre.frase)
    }

    @Test fun sinMesAnteriorNoHayCambioDeCategoria() {
        val t = resumenDelMes(listOf(g("a", "2026-07-03", 10_000)), "2026-07", "2026-08-15")
        assertTrue(t.none { it is TarjetaResumen.CambioCategoriaTarjeta })
    }

    @Test fun cambioDeCategoriaConSubidaYBajada() {
        val txs = listOf(
            g("a", "2026-06-03", 10_000, "comida"), g("b", "2026-06-04", 50_000, "transporte"),
            g("c", "2026-07-03", 30_000, "comida"), g("d", "2026-07-04", 20_000, "transporte"),
        )
        val c = resumenDelMes(txs, "2026-07", "2026-08-15").filterIsInstance<TarjetaResumen.CambioCategoriaTarjeta>().single()
        assertEquals("comida", c.subida!!.category)
        assertEquals("transporte", c.bajada!!.category)
    }

    @Test fun gastoMasCaroEnEmpateGanaElPrimero() {
        val txs = listOf(g("a", "2026-07-03", 40_000), g("b", "2026-07-05", 40_000))
        val m = resumenDelMes(txs, "2026-07", "2026-08-15").filterIsInstance<TarjetaResumen.GastoMasCaro>().single()
        assertEquals("a", m.tx.id)
    }

    @Test fun rachaCuentaLosDiasSinGastoYElMesEnCursoSoloHastaHoy() {
        val txs = listOf(g("a", "2026-08-02", 10_000), g("b", "2026-08-09", 10_000))
        val t = resumenDelMes(txs, "2026-08", "2026-08-10")
        assertEquals(TarjetaResumen.DiasActivos(2, 10), t.filterIsInstance<TarjetaResumen.DiasActivos>().single())
        // Días 3..8 sin gasto = 6, y el día 10 cierra una racha de 1.
        assertEquals(6, t.filterIsInstance<TarjetaResumen.Racha>().single().dias)
    }

    @Test fun mesFuturoNoTieneDiasActivosNiRacha() {
        val t = resumenDelMes(emptyList(), "2026-09", "2026-08-10")
        assertTrue(t.none { it is TarjetaResumen.DiasActivos || it is TarjetaResumen.Racha })
    }

    @Test fun comparadoConPromedioUsaLosMesesAnterioresConDatos() {
        val txs = listOf(g("a", "2026-05-03", 100_000), g("b", "2026-06-03", 100_000), g("c", "2026-07-03", 150_000))
        val c = resumenDelMes(txs, "2026-07", "2026-08-15").filterIsInstance<TarjetaResumen.ComparadoConPromedio>().single()
        assertEquals(100_000L, c.promedioCop)
        assertEquals(50.0, c.deltaPct, 0.0)
        assertEquals(2, c.meses)
    }

    @Test fun frasesDeCierre() {
        val bien = resumenDelMes(listOf(i("i", "2026-07-01", 1_000_000), g("g", "2026-07-02", 100_000)), "2026-07", "2026-08-15").last() as TarjetaResumen.Cierre
        assertEquals(Tono.BIEN, bien.tono)
        val mal = resumenDelMes(listOf(i("i", "2026-07-01", 100_000), g("g", "2026-07-02", 300_000)), "2026-07", "2026-08-15").last() as TarjetaResumen.Cierre
        assertEquals(Tono.ATENTO, mal.tono)
        assertEquals("Este mes gastaste más de lo que entró.", mal.frase)
    }

    @Test fun textoParaCompartirNombraLoQueHay() {
        val t = resumenDelMes(listOf(g("g", "2026-07-02", 300_000)), "2026-07", "2026-08-15")
        val texto = textoParaCompartir(t) { "Comida" }
        assertTrue(texto.startsWith("Mi resumen de "))
        assertTrue(texto.contains("Categoría estrella: Comida (${formatCop(300_000)})"))
        assertTrue(texto.contains("días seguidos sin gastar"))
        assertNotNull(texto.lines().firstOrNull { it.startsWith("Balance: ") })
        assertNull(texto.lines().firstOrNull { it.startsWith("Lo que") })
    }
}
