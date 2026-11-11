package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Casos de `lib/tarjetas.test.ts` y `lib/cuotasTarjeta.test.ts`. */
class TarjetasTest {
    private fun tarjeta(diaCorte: Int? = null, diaPago: Int? = null, limite: Long? = null) =
        caj(id = "t1", nombre = "Visa", icon = "credit-card", tipo = "tarjeta", createdAt = "2026-01-01", diaCorte = diaCorte, diaPago = diaPago, limiteCreditoCop = limite)

    @Test fun corteYPagoConRollover() {
        val f = fechasTarjeta(tarjeta(15, 5), "2026-01-20")
        assertEquals("2026-02-15", f.corte); assertEquals("2026-03-05", f.pago)
    }

    @Test fun noInventaCupoNiFechas() {
        val r = resumenTarjeta(tarjeta(), 100_000, emptyList(), emptyList(), "2026-09", "2026-09-05")
        assertNull(r.cupoDisponibleCop); assertNull(r.fechaCorteSiguiente); assertNull(r.fechaPagoSiguiente)
        assertEquals(0L, resumenTarjeta(tarjeta(limite = 50_000), 100_000, emptyList(), emptyList(), "2026-09", "2026-09-05").cupoDisponibleCop)
    }

    @Test fun extractos() {
        val casos = listOf(
            listOf("2026-09-04", "2026-09-04", "antes-del-corte", "2026-09", "actual"),
            listOf("2026-09-05", "2026-09-04", "en-el-corte", "2026-09", "actual"),
            listOf("2026-09-06", "2026-09-06", "despues-del-corte", "2026-10", "actual"),
            listOf("2026-12-06", "2026-12-06", "despues-del-corte", "2027-01", "actual"),
        )
        for ((compra, ref, pos, ext, posExt) in casos) {
            assertEquals(ClasificacionCompraTarjeta(pos, ext, posExt), clasificarCompraTarjeta(tarjeta(5), compra, ref))
        }
        val t31 = tarjeta(31, 20)
        assertEquals("2026-02", clasificarCompraTarjeta(t31, "2026-02-28", "2026-02-15").extracto)
        assertEquals("2026-02-28", fechasTarjeta(t31, "2026-02-01").corte)
        assertEquals("2026-04-30", fechasTarjeta(t31, "2026-04-01").corte)
        assertNull(clasificarCompraTarjeta(tarjeta(), "2026-09-01", "2026-09-01").extracto)
        assertEquals("desconocida", clasificarCompraTarjeta(tarjeta(5), "2026-09", "2026-09-01").posicion)
        assertEquals("desconocida", clasificarCompraTarjeta(tarjeta(5), "2026-02-31", "2026-09-01").posicion)
    }

    @Test fun fechaPagoDelPeriodo() {
        assertEquals("2026-10-05", fechaPagoDePeriodo(tarjeta(15, 5), "2026-09"))
        assertEquals("2026-09-25", fechaPagoDePeriodo(tarjeta(15, 25), "2026-09"))
        assertNull(fechaPagoDePeriodo(tarjeta(15), "2026-09"))
    }

    private val compra = tx(id = "platzi", amountCop = 899_259, category = "educacion", description = "Platzi", occurredOn = "2026-08-29",
        cuentaId = "tarjeta", cuotasTotal = 12, cuotaCop = 74_938, createdAt = "2026-08-29T00:00:00Z")
    private fun abono(delta: Long) = mov(id = "abono", cajitaId = "tarjeta", kind = "abono", deltaCop = delta, occurredOn = "2026-08-30", createdAt = "2026-08-30T00:00:00Z")

    @Test fun cuotas() {
        val c = cuotasDeTarjeta(listOf(compra), "tarjeta")
        assertEquals(12, c.size)
        assertEquals(1, c[0].numero); assertEquals("2026-08-29", c[0].venceEn); assertEquals(74_938L, c[0].montoCop)
        assertEquals(12, c[11].numero); assertEquals("2027-07-29", c[11].venceEn)
        assertEquals("2027-02-28", cuotasDeTarjeta(listOf(compra.copy(occurredOn = "2026-08-31")), "tarjeta")[6].venceEn)
        assertEquals(74_938L, pagoMensualTarjeta(listOf(compra), "tarjeta", "2026-08"))
        assertEquals(0L, pagoMensualTarjeta(listOf(compra), "tarjeta", "2027-08"))
        assertEquals(34_938L, pagoPendienteTarjeta(listOf(compra), listOf(abono(-40_000)), "tarjeta", "2026-08", "2026-08-30"))
        assertEquals(0L, pagoPendienteTarjeta(listOf(compra), listOf(abono(-74_938)), "tarjeta", "2026-08", "2026-08-30"))
        assertEquals(74_938L, pagoPendienteTarjeta(listOf(compra), listOf(abono(-74_938)), "tarjeta", "2026-09", "2026-09-30"))
    }
}
