package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/bandejaRevision.test.ts` y de las señales «duplicado» e «inusual» de `senales.test.ts`. */
class BandejaRevisionTest {
    private val catalogo = hacerCatalogo(emptyList())
    private fun t(id: String, monto: Long = 12_000, fecha: String = "2026-10-20", cat: String = "comida", desc: String = "Café Parque") =
        tx(id = id, amountCop = monto, category = cat, description = desc, occurredOn = fecha, cuentaId = null, createdAt = "${fecha}T12:00:00.000Z")

    @Test fun cobrosIgualesQuedanPendientesYLaDecisionNoVuelve() {
        val txs = listOf(t("uno"), t("dos"))
        val inicial = construirBandejaRevision(txs, emptyList(), catalogo)
        assertEquals(2, inicial.size)
        assertTrue(inicial.all { it.estado == "pendiente" && it.tipo == "movimiento" })
        val resuelta = inicial[0].copy(estado = "resuelta", resolucion = "Revisado por la persona usuaria.", updatedAt = "2026-10-21T12:00:00.000Z")
        val despues = construirBandejaRevision(txs, listOf(resuelta), catalogo)
        assertEquals(1, despues.count { it.estado == "pendiente" })
        assertEquals("resuelta", despues.first { it.id == resuelta.id }.estado)
        // Lo resuelto se va al final.
        assertEquals("resuelta", despues.last().estado)
    }

    @Test fun incluyeLasRevisionesDeExtractoGuardadas() {
        val doc = RevisionDudosa("documento:tx", "documento", "pendiente", "tx", "Confirma la lectura de esta fila", "Revisa la cifra.", "extracto.pdf", null, "2026-10-20T12:00:00.000Z", "2026-10-20T12:00:00.000Z")
        val b = construirBandejaRevision(listOf(t("tx", desc = "Otro", fecha = "2026-10-20")), listOf(doc), catalogo)
        assertEquals("documento", b.single().tipo)
    }

    @Test fun inusualNecesitaCincoMuestrasYTresVecesLaMediana() {
        val base = listOf(18_000L, 20_000, 22_000, 19_000).mapIndexed { i, m -> t("b$i", m, "2026-07-0${i + 1}", desc = "Almuerzo $i") }
        val grande = t("grande", 150_000, desc = "Restaurante")
        val b = construirBandejaRevision(base + grande, emptyList(), catalogo)
        val aviso = b.single { it.referenciaId == "grande" }
        assertEquals("El monto fue mayor de lo normal", aviso.titulo)
        assertTrue(aviso.detalle.startsWith("En Comida, suele rondar "))
        // Sin historia suficiente no hay aviso.
        assertTrue(construirBandejaRevision(base.take(2) + grande, emptyList(), catalogo).none { it.referenciaId == "grande" })
    }

    @Test fun laMedianaNoSeDejaArrastrarPorUnGastoEnorme() {
        val base = listOf(18_000L, 20_000, 22_000, 19_000, 2_000_000).mapIndexed { i, m -> t("b$i", m, "2026-07-0${i + 1}", desc = "Cosa $i") }
        assertTrue(construirBandejaRevision(base + t("grande", 150_000, desc = "Restaurante"), emptyList(), catalogo).any { it.referenciaId == "grande" })
    }

    @Test fun sinContraparteNiDescripcionNoHayDuplicado() {
        val b = construirBandejaRevision(listOf(t("a", desc = ""), t("b", desc = "")), emptyList(), catalogo)
        assertTrue(b.isEmpty())
    }
}
