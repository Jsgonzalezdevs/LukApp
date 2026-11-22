package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/aggregate.test.ts`. */
class AgregadosTest {
    private var seq = 0
    private fun t(kind: String, monto: Long, cat: String, fecha: String = "2026-07-15"): Transaccion {
        seq += 1
        return tx(id = "tx-$seq", kind = kind, amountCop = monto, category = cat, description = cat, occurredOn = fecha,
            cuentaId = null, createdAt = "2026-07-15T00:00:${seq.toString().padStart(2, '0')}Z")
    }

    @Test fun totales() {
        val a = monthTotals(listOf(t("ingreso", 2_000_000, "ingreso"), t("gasto", 45_000, "mercado"), t("gasto", 15_000, "comida")))
        assertEquals(2_000_000L, a.ingresos); assertEquals(60_000L, a.gastos); assertEquals(1_940_000L, a.balance)
        assertEquals(75.0, monthTotals(listOf(t("ingreso", 1_000_000, "ingreso"), t("gasto", 250_000, "mercado"))).tasaAhorro!!, 0.0)
        assertEquals(-50.0, monthTotals(listOf(t("ingreso", 100_000, "ingreso"), t("gasto", 150_000, "mercado"))).tasaAhorro!!, 0.0)
        assertNull(monthTotals(listOf(t("gasto", 45_000, "mercado"))).tasaAhorro)
        assertEquals(MonthTotals(0, 0, 0, null), monthTotals(emptyList()))
        val b = monthTotals(listOf(t("ingreso", 500_000, "ingreso"), t("gasto", 120_000, "comida"), t("transferencia", 80_000, "transferencia")))
        assertEquals(500_000L, b.ingresos); assertEquals(120_000L, b.gastos); assertEquals(380_000L, b.balance)
    }

    @Test fun porCategoria() {
        val s = byCategory(listOf(t("gasto", 30_000, "comida"), t("gasto", 60_000, "mercado"), t("gasto", 10_000, "comida"), t("ingreso", 900_000, "ingreso")), "gasto")
        assertEquals(listOf("mercado", "comida"), s.map { it.category })
        assertEquals(CategorySlice("mercado", 60_000, 60.0), s[0])
        assertEquals(CategorySlice("comida", 40_000, 40.0), s[1])
        val suma = byCategory(listOf(t("gasto", 33_333, "mercado"), t("gasto", 33_333, "comida"), t("gasto", 33_334, "transporte"), t("ingreso", 5_000_000, "ingreso")), "gasto").sumOf { it.pct }
        assertTrue(Math.abs(suma - 100) <= 0.3)
        assertEquals(100.0, byCategory(listOf(t("ingreso", 10_000, "ingreso"), t("gasto", 900_000, "mercado")), "gasto")[0].pct, 0.0)
        val x = byCategory(listOf(t("gasto", 1_000, "mercado"), t("gasto", 1_000, "comida")), "gasto")
        val y = byCategory(listOf(t("gasto", 1_000, "comida"), t("gasto", 1_000, "mercado")), "gasto")
        assertEquals(x.map { it.category }, y.map { it.category })
        assertEquals(emptyList<CategorySlice>(), byCategory(listOf(t("ingreso", 100, "ingreso")), "gasto"))
        assertEquals(emptyList<CategorySlice>(), byCategory(emptyList(), "gasto"))
    }

    @Test fun mesesYPeriodos() {
        val all = listOf(t("gasto", 1_000, "mercado", "2026-07-01"), t("gasto", 2_000, "mercado", "2026-07-31"), t("gasto", 3_000, "mercado", "2026-08-01"))
        assertEquals(2, forMonth(all, "2026-07").size)
        assertEquals(1, forMonth(all, "2026-08").size)
        assertEquals(0, forMonth(all, "2026-09").size)
        val m = listOf(t("gasto", 1_000, "mercado", "2026-06-10"), t("gasto", 1_000, "mercado", "2026-08-10"), t("gasto", 1_000, "mercado", "2026-07-10"), t("gasto", 1_000, "mercado", "2026-07-11"))
        assertEquals(listOf("2026-08", "2026-07", "2026-06"), monthsPresent(m))
        assertEquals(emptyList<String>(), monthsPresent(emptyList()))
        assertEquals(forMonth(all, "2026-07"), forPeriod(all, "2026-07", PERIODO_POR_DEFECTO))
        assertEquals(2, forPeriod(all, "2026-07-27", ConfigPeriodo("semanal")).size)
        assertEquals(3, forPeriod(all, CLAVE_TODO_EL_TIEMPO, ConfigPeriodo("todo-el-tiempo")).size)
    }
}
