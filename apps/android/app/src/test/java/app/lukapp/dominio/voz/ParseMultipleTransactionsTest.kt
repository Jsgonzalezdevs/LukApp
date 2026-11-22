package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Origen: src/features/lukapp/lib/parseMultipleTransactions.test.ts */
class ParseMultipleTransactionsTest {

    @Test fun `separa 2 gastos unidos por y`() {
        val res = parseMultipleTransactions("15 mil de taxi y 30 mil de almuerzo")
        assertEquals(2, res.size)
        assertEquals(15000L, res[0].amount)
        assertEquals("transporte", res[0].category)
        assertEquals(30000L, res[1].amount)
        assertEquals("comida", res[1].category)
    }

    @Test fun `separa 3 gastos con comas y conectores`() {
        val res = parseMultipleTransactions("Gasté 50 mil en mercado, 20 mil en farmacia y 10 mil de recarga")
        assertTrue(res.size >= 2)
        assertEquals(50000L, res[0].amount)
    }

    @Test fun `mantiene una sola transaccion si no hay conectores multiples`() {
        val res = parseMultipleTransactions("Almuerzo 18 mil en El Corral")
        assertEquals(1, res.size)
        assertEquals(18000L, res[0].amount)
        assertEquals("comida", res[0].category)
    }

    @Test fun `separa por saltos de linea`() {
        val res = parseMultipleTransactions("20 mil de gasolina\n50 mil de mercado\n100 mil de arriendo")
        assertEquals(listOf(20000L, 50000L, 100000L), res.map { it.amount })
    }

    @Test fun `no confunde nombres de comidas con conectores falsos`() {
        val res = parseMultipleTransactions("15 mil de arroz con pollo y papa")
        assertEquals(1, res.size)
        assertEquals(15000L, res[0].amount)
    }

    @Test fun `no divide frases subordinadas de precio`() {
        val res = parseMultipleTransactions("Me compré un café en el Oxxo que me valió 10000")
        assertEquals(1, res.size)
        assertEquals(10000L, res[0].amount)
        assertEquals("gasto", res[0].kind)
    }

    @Test fun `no divide frases con comas antes de me valio`() {
        val res = parseMultipleTransactions("Me compré un café en el Oxxo, me valió 10000")
        assertEquals(1, res.size)
        assertEquals(10000L, res[0].amount)
    }

    @Test fun `conserva una compra con cantidad y una clausula de precio como un solo gasto`() {
        val res = parseMultipleTransactions("Me gasté 3 cafés con leche que me costó 7500")
        assertEquals(1, res.size)
        assertEquals("gasto", res[0].kind)
        assertEquals(7500L, res[0].amount)
        assertEquals("comida", res[0].category)
        assertEquals("3 cafés con leche", res[0].description)
    }

    @Test fun `no separa productos ni confunde sus cantidades cuando dicen un unico total`() {
        for (texto in listOf(
            "Me gasté tres cafés con leche y dos panes que me costaron siete mil quinientos",
            "Compré 2 pizzas y una gaseosa por 45 mil",
        )) {
            assertEquals(texto, 1, parseMultipleTransactions(texto).size)
        }
        val r = parseMultipleTransactions("Compré 2 pizzas y una gaseosa por 45 mil")[0]
        assertEquals("gasto", r.kind)
        assertEquals(45_000L, r.amount)
        assertEquals("comida", r.category)
    }

    @Test fun `si conserva separados los montos que expresan dos movimientos distintos`() {
        val res = parseMultipleTransactions("Pagué 20 mil de taxi y 30 mil de almuerzo")
        assertEquals(listOf(20_000L, 30_000L), res.map { it.amount })
    }

    @Test fun `no parte un unico monto que la transcripcion escribio como 1 y 500 pesos`() {
        val res = parseMultipleTransactions("Me gasté 1 y 500 pesos en Amparo")
        assertEquals(1, res.size)
        assertEquals(1_500L, res[0].amount)
        assertEquals("Amparo", res[0].description)
        assertEquals("Me gasté 1 y 500 pesos en Amparo", res[0].raw)
    }
}
