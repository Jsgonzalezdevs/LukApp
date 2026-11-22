package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/recurrentes.test.ts` (y `lib/contraparte.ts`). */
class RecurrentesTest {
    private fun rec(id: String = "r1", nombre: String = "Arriendo", kind: String = "gasto", amountCop: Long = 1_200_000, diaDelMes: Int = 5, archivedAt: String? = null) =
        Recurrente(id, nombre, kind, amountCop, "hogar", "nequi", diaDelMes, "2026-01-01T00:00:00.000Z", archivedAt)
    private fun t(id: String = "t1", kind: String = "gasto", amountCop: Long = 1_200_000, category: String = "hogar", description: String = "Arriendo", occurredOn: String = "2026-08-05", afectaSaldo: Boolean = true) =
        tx(id = id, kind = kind, amountCop = amountCop, category = category, description = description, occurredOn = occurredOn, cuentaId = null, afectaSaldo = afectaSaldo, createdAt = "2026-08-05T00:00:00.000Z")

    @Test fun fechaEnMesAcomoda() {
        assertEquals("2026-08-05", fechaEnMes(rec(diaDelMes = 5), "2026-08"))
        assertEquals("2026-02-28", fechaEnMes(rec(diaDelMes = 31), "2026-02"))
        assertEquals("2026-04-30", fechaEnMes(rec(diaDelMes = 31), "2026-04"))
        assertEquals("2026-08-01", fechaEnMes(rec(diaDelMes = 0), "2026-08"))
        assertEquals("2026-08-31", fechaEnMes(rec(diaDelMes = 99), "2026-08"))
    }

    @Test fun yaRegistradoCompara() {
        assertTrue(yaRegistrado(rec(), listOf(t(description = "pago apto agosto")), "2026-08"))
        assertFalse(yaRegistrado(rec(), listOf(t(occurredOn = "2026-07-05")), "2026-08"))
        assertFalse(yaRegistrado(rec(), listOf(t(amountCop = 900_000)), "2026-08"))
        assertFalse(yaRegistrado(rec(), listOf(t(kind = "ingreso")), "2026-08"))
    }

    @Test fun pendientes() {
        val p = pendientesDelMes(listOf(rec()), emptyList(), "2026-08", "2026-08-10")
        assertEquals(1, p.size); assertEquals("2026-08-05", p[0].fecha); assertTrue(p[0].vencido)
        assertEquals(emptyList<Pendiente>(), pendientesDelMes(listOf(rec(diaDelMes = 30)), emptyList(), "2026-08", "2026-08-03"))
        assertEquals(1, pendientesDelMes(listOf(rec(diaDelMes = 10)), emptyList(), "2026-08", "2026-08-10").size)
        assertEquals(emptyList<Pendiente>(), pendientesDelMes(listOf(rec()), listOf(t()), "2026-08", "2026-08-10"))
        assertEquals(emptyList<Pendiente>(), pendientesDelMes(listOf(rec(archivedAt = "2026-07-01T00:00:00.000Z")), emptyList(), "2026-08", "2026-08-10"))
        assertEquals(listOf("b", "a"), pendientesDelMes(listOf(rec(id = "a", diaDelMes = 15), rec(id = "b", diaDelMes = 2, amountCop = 50_000)), emptyList(), "2026-08", "2026-08-20").map { it.recurrente.id })
    }

    @Test fun comoTransaccionCopia() {
        val p = pendientesDelMes(listOf(rec()), emptyList(), "2026-08", "2026-08-20")[0]
        val x = comoTransaccion(p, "nuevo", "2026-08-20T10:00:00.000Z")
        assertEquals("2026-08-05", x.occurredOn); assertEquals("2026-08-20T10:00:00.000Z", x.createdAt)
        assertEquals("gasto", x.kind); assertEquals(1_200_000L, x.amountCop); assertEquals("hogar", x.category)
        assertEquals("nequi", x.cuentaId); assertEquals("Arriendo", x.description)
        assertTrue(comoTransaccion(p, "n", "x").rawTranscript.contains("Recurrente"))
    }

    @Test fun totalMensualSepara() {
        assertEquals(TotalMensual(1_240_000, 3_000_000), totalMensual(listOf(rec(id = "a"), rec(id = "b", amountCop = 40_000), rec(id = "c", kind = "ingreso", amountCop = 3_000_000))))
        assertEquals(TotalMensual(0, 0), totalMensual(listOf(rec(archivedAt = "2026-07-01T00:00:00.000Z"))))
    }

    private val tresMeses = listOf(
        t(id = "t1", description = "NETFLIX.COM", occurredOn = "2026-07-08", amountCop = 29_900, category = "entretenimiento"),
        t(id = "t2", description = "NETFLIX.COM", occurredOn = "2026-08-08", amountCop = 29_900, category = "entretenimiento"),
        t(id = "t3", description = "NETFLIX.COM", occurredOn = "2026-09-08", amountCop = 31_900, category = "entretenimiento"),
    )

    @Test fun suscripciones() {
        val s = detectarSuscripciones(tresMeses, emptyList(), "2026-09-10")
        assertEquals(1, s.size)
        assertEquals("NETFLIX.COM", s[0].nombre); assertEquals(31_900L, s[0].amountCop); assertEquals(30_567L, s[0].promedioCop)
        assertEquals(8, s[0].diaDelMes); assertEquals(3, s[0].meses); assertFalse(s[0].cambioPrecio); assertNull(s[0].recurrenteExistente)
        val c = detectarSuscripciones(tresMeses, listOf(rec(nombre = "NETFLIX.COM", amountCop = 25_000)), "2026-09-10")
        assertEquals(1, c.size); assertTrue(c[0].cambioPrecio); assertEquals(25_000L, c[0].recurrenteExistente!!.amountCop); assertEquals(31_900L, c[0].amountCop)
        assertEquals(emptyList<SugerenciaSuscripcion>(), detectarSuscripciones(tresMeses.map { it.copy(kind = "transferencia") }, emptyList(), "2026-09-10"))
        assertEquals(emptyList<SugerenciaSuscripcion>(), detectarSuscripciones(tresMeses.map { it.copy(afectaSaldo = false) }, emptyList(), "2026-09-10"))
        assertEquals(emptyList<SugerenciaSuscripcion>(), detectarSuscripciones(listOf(tresMeses[0], tresMeses[2], tresMeses[2].copy(id = "t4", occurredOn = "2026-09-08")), emptyList(), "2026-09-10"))
        assertEquals(emptyList<SugerenciaSuscripcion>(), detectarSuscripciones(tresMeses, listOf(rec(nombre = "NETFLIX.COM", amountCop = 31_900)), "2026-09-10"))
    }

    @Test fun proximos() {
        val r = proximosRecurrentes(listOf(rec(id = "hoy", diaDelMes = 10), rec(id = "siguiente", diaDelMes = 5, amountCop = 40_000), rec(id = "ingreso", kind = "ingreso"), rec(id = "archivo", archivedAt = "2026-01-01")), "2026-09-10")
        assertEquals(listOf("hoy" to "2026-09-10", "siguiente" to "2026-10-05", "hoy" to "2026-10-10", "siguiente" to "2026-11-05"), r.map { it.recurrente.id to it.fecha })
    }

    @Test fun contraparte() {
        assertEquals("Juan Perez", extraerContraparte("ENVIO CON BRE-B A: JUAN PEREZ"))
        assertEquals("Maria de Lopez", extraerContraparte("Transferencia de maria de lopez 123456"))
        assertNull(extraerContraparte("Compra paquete"))
        assertNull(extraerContraparte("Recibi por bre-b de: otra entidad"))
        assertNull(extraerContraparte("de AB"))
    }
}
