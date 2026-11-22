package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Test

class TandasTest {
    private fun t(id: String, fecha: String) = tx(id = id, occurredOn = fecha)

    @Test fun conPocosMovimientosSeMuestraTodo() = assertEquals(2, primerasTandas(listOf(t("a", "2026-11-10"), t("b", "2026-11-09")), 60).size)

    @Test fun nuncaPartePorLaMitadUnDia() {
        val l = listOf(t("1", "2026-11-10"), t("2", "2026-11-10"), t("3", "2026-11-09"), t("4", "2026-11-09"), t("5", "2026-11-09"), t("6", "2026-11-08"))
        // El corte caería en el segundo del día 09: se completa el día.
        assertEquals(listOf("1", "2", "3", "4", "5"), primerasTandas(l, 3).map { it.id })
        // Si el corte cae justo al final de un día, no se agrega nada más.
        assertEquals(listOf("1", "2"), primerasTandas(l, 2).map { it.id })
    }

    @Test fun unSoloDiaGigantePasaCompleto() {
        val l = (1..100).map { t("$it", "2026-11-10") } + t("x", "2026-11-09")
        assertEquals(100, primerasTandas(l, 60).size)
    }
}
