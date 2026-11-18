package app.lukapp.dominio

import app.lukapp.datos.listaOpcionalDe
import app.lukapp.datos.regimenDe
import app.lukapp.datos.uvtDe
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Lo que el panel del 4x1000 lee de la cuenta (`leerUvt`, `leerRegimen`, `leerListaOpcional`) y las cuentas que ofrece. */
class GmfPanelTest {
    private fun cajita(id: String, nombre: String, tipo: String = TipoCajita.CUENTA, clase: String? = null, archivada: Boolean = false, bajoMonto: Boolean = false) =
        Cajita(id = id, nombre = nombre, icon = "Wallet", tipo = tipo, claseCuenta = clase, createdAt = "2026-01-01T00:00:00.000Z", archivedAt = if (archivada) "2026-02-01T00:00:00.000Z" else null, esBajoMonto = bajoMonto)

    @Test fun uvtValidaSeLeeTalCual() {
        val v = uvtDe(JsonObject(mapOf("anio" to JsonPrimitive(2027), "pesos" to JsonPrimitive(55_000), "fuente" to JsonPrimitive("Editado a mano"))))
        assertEquals(ValorUvt(2027, 55_000, "Editado a mano"), v)
    }

    @Test fun uvtRotaOAusenteVuelveALaPorDefecto() {
        assertEquals(UVT_POR_DEFECTO, uvtDe(null))
        assertEquals(UVT_POR_DEFECTO, uvtDe(JsonNull))
        assertEquals(UVT_POR_DEFECTO, uvtDe(JsonObject(mapOf("anio" to JsonPrimitive(2027), "pesos" to JsonPrimitive(0)))))
        assertEquals(UVT_POR_DEFECTO, uvtDe(JsonObject(mapOf("anio" to JsonPrimitive("2027"), "pesos" to JsonPrimitive(50_000)))))
        assertEquals(UVT_POR_DEFECTO, uvtDe(JsonObject(mapOf("pesos" to JsonPrimitive(50_000)))))
    }

    @Test fun uvtSinFuenteQuedaConFuenteVacia() {
        assertEquals("", uvtDe(JsonObject(mapOf("anio" to JsonPrimitive(2026), "pesos" to JsonPrimitive(52_374)))).fuente)
    }

    @Test fun regimenSoloReconoceMarcada() {
        assertEquals(RegimenGmf.MARCADA, regimenDe(JsonPrimitive("marcada")))
        assertEquals(RegimenGmf.DISTRIBUIDO, regimenDe(JsonPrimitive("distribuido")))
        assertEquals(RegimenGmf.DISTRIBUIDO, regimenDe(JsonPrimitive("otra")))
        assertEquals(RegimenGmf.DISTRIBUIDO, regimenDe(null))
    }

    @Test fun listaOpcionalDistingueAusenteDeVacia() {
        assertNull(listaOpcionalDe(null))
        assertNull(listaOpcionalDe(JsonPrimitive("a")))
        assertEquals(emptyList<String>(), listaOpcionalDe(JsonArray(emptyList())))
        assertEquals(listOf("a", "b"), listaOpcionalDe(JsonArray(listOf(JsonPrimitive("a"), JsonPrimitive(3), JsonPrimitive("b")))))
    }

    @Test fun soloCuentasVivasYElEfectivoNoEsFinanciero() {
        val l = cuentasParaGmf(
            listOf(
                cajita("1", "Efectivo", clase = ClaseCuenta.EFECTIVO),
                cajita("2", "Bancolombia", clase = ClaseCuenta.BANCO, bajoMonto = true),
                cajita("3", "Vieja", archivada = true),
                cajita("4", "Viaje", tipo = TipoCajita.CAJITA),
            ),
        )
        assertEquals(listOf("1", "2"), l.map { it.id })
        assertEquals(false, l[0].esFinanciera)
        assertTrue(l[1].esFinanciera && l[1].esBajoMonto)
        assertEquals("Bancolombia · ${ClaseCuenta.ETIQUETAS[ClaseCuenta.BANCO]}", l[1].etiqueta)
    }
}
