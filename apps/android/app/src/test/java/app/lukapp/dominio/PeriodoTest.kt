package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/periodo.test.ts`. */
class PeriodoTest {
    private val MENSUAL_PURO = ConfigPeriodo("mensual", 0)
    private val SEMANAL = ConfigPeriodo("semanal", 0)
    private val QUINCENAL = ConfigPeriodo("quincenal", 0)
    private val QUINCENAS_MES = ConfigPeriodo("quincenas-mes", 0)
    private val MENSUAL_DESFASE_4 = ConfigPeriodo("mensual", 4)
    private val TODO = ConfigPeriodo("todo-el-tiempo", 0)

    @Test fun mensualPuroIgualAlDeSiempre() {
        for (f in listOf("2026-08-01", "2026-08-15", "2026-08-31", "2026-01-01", "2026-12-31")) {
            assertEquals(monthKey(f), claveDePeriodo(f, MENSUAL_PURO))
        }
        for (c in listOf("2026-01", "2026-08", "2026-12")) assertEquals(monthKeyLabel(c), etiquetaDePeriodo(c, MENSUAL_PURO))
        assertEquals(shiftMonth("2026-08", 1), periodoAdyacente("2026-08", 1, MENSUAL_PURO))
        assertEquals(shiftMonth("2026-08", -1), periodoAdyacente("2026-08", -1, MENSUAL_PURO))
        assertEquals(shiftMonth("2026-12", 1), periodoAdyacente("2026-12", 1, MENSUAL_PURO))
        assertEquals(shiftMonth("2026-01", -1), periodoAdyacente("2026-01", -1, MENSUAL_PURO))
        assertTrue(enElPeriodo("2026-08-15", "2026-08", MENSUAL_PURO))
        assertTrue(enElPeriodo("2026-08-01", "2026-08", MENSUAL_PURO))
        assertTrue(enElPeriodo("2026-08-31", "2026-08", MENSUAL_PURO))
        assertFalse(enElPeriodo("2026-07-31", "2026-08", MENSUAL_PURO))
        assertFalse(enElPeriodo("2026-09-01", "2026-08", MENSUAL_PURO))
        assertEquals(31, diasDelPeriodo("2026-08", MENSUAL_PURO))
        assertEquals(30, diasDelPeriodo("2026-04", MENSUAL_PURO))
        assertEquals(28, diasDelPeriodo("2026-02", MENSUAL_PURO))
        assertEquals(29, diasDelPeriodo("2024-02", MENSUAL_PURO))
    }

    @Test fun semanal() {
        for (i in 0 until 7) assertEquals("2026-08-17", inicioDePeriodo(fechaUtc(2026, 8, 17 + i).toString(), SEMANAL))
        assertEquals("2026-08-23", finDePeriodo("2026-08-17", SEMANAL))
        assertEquals(7, diasDelPeriodo("2026-08-17", SEMANAL))
        assertEquals("2026-08-31", inicioDePeriodo("2026-08-31", SEMANAL))
        assertEquals("2026-09-06", finDePeriodo("2026-08-31", SEMANAL))
        assertEquals("2026-12-28", inicioDePeriodo("2026-12-30", SEMANAL))
        assertEquals("2027-01-03", finDePeriodo("2026-12-28", SEMANAL))
        assertEquals("2026-08-24", periodoAdyacente("2026-08-17", 1, SEMANAL))
        assertEquals("2026-08-10", periodoAdyacente("2026-08-17", -1, SEMANAL))
        assertFalse(enElPeriodo("2026-08-16", "2026-08-17", SEMANAL))
        assertTrue(enElPeriodo("2026-08-17", "2026-08-17", SEMANAL))
        assertTrue(enElPeriodo("2026-08-23", "2026-08-17", SEMANAL))
        assertFalse(enElPeriodo("2026-08-24", "2026-08-17", SEMANAL))
    }

    @Test fun quincenal() {
        val inicio = inicioDePeriodo("2026-08-17", QUINCENAL)
        assertEquals(14, diasDelPeriodo(inicio, QUINCENAL))
        assertNotEquals(inicioDePeriodo("2026-08-17", QUINCENAL), inicioDePeriodo("2026-08-24", QUINCENAL))
        val fin = finDePeriodo(inicio, QUINCENAL)!!
        assertEquals(inicioDePeriodo(shiftDays(fin, 1), QUINCENAL), periodoAdyacente(inicio, 1, QUINCENAL))
        assertEquals(inicioDePeriodo("2026-08-17", QUINCENAL), inicioDePeriodo("2026-08-17", QUINCENAL))
    }

    @Test fun quincenasDeCalendario() {
        assertEquals("2026-08-01", inicioDePeriodo("2026-08-01", QUINCENAS_MES))
        assertEquals("2026-08-01", inicioDePeriodo("2026-08-15", QUINCENAS_MES))
        assertEquals("2026-08-15", finDePeriodo("2026-08-01", QUINCENAS_MES))
        assertEquals("2026-08-16", inicioDePeriodo("2026-08-16", QUINCENAS_MES))
        assertEquals("2026-08-31", finDePeriodo("2026-08-16", QUINCENAS_MES))
        assertEquals("2026-04-30", finDePeriodo("2026-04-16", QUINCENAS_MES))
        assertEquals("2026-02-28", finDePeriodo("2026-02-16", QUINCENAS_MES))
        assertEquals("2024-02-29", finDePeriodo("2024-02-16", QUINCENAS_MES))
        assertEquals("2026-08-16", periodoAdyacente("2026-08-01", 1, QUINCENAS_MES))
        assertEquals("2026-09-01", periodoAdyacente("2026-08-16", 1, QUINCENAS_MES))
        assertNotEquals(claveDePeriodo("2026-08-10", QUINCENAS_MES), claveDePeriodo("2026-08-20", QUINCENAS_MES))
    }

    @Test fun mensualConDesfase() {
        assertEquals("2026-08-05", inicioDePeriodo("2026-08-05", MENSUAL_DESFASE_4))
        assertEquals("2026-08-05", inicioDePeriodo("2026-08-20", MENSUAL_DESFASE_4))
        assertEquals("2026-07-05", inicioDePeriodo("2026-08-04", MENSUAL_DESFASE_4))
        assertEquals("2026-07-05", inicioDePeriodo("2026-08-01", MENSUAL_DESFASE_4))
        assertEquals("2026-09-04", finDePeriodo("2026-08-05", MENSUAL_DESFASE_4))
        assertEquals("2025-12-05", inicioDePeriodo("2026-01-03", MENSUAL_DESFASE_4))
        assertEquals("2026-01-04", finDePeriodo("2025-12-05", MENSUAL_DESFASE_4))
        assertEquals("2026-08-01", inicioDePeriodo("2026-08-15", ConfigPeriodo("mensual", 0)))
        assertEquals("5 ago – 4 sep", etiquetaDePeriodo("2026-08-05", MENSUAL_DESFASE_4))
    }

    @Test fun todoElTiempo() {
        assertEquals(CLAVE_TODO_EL_TIEMPO, claveDePeriodo("2020-01-01", TODO))
        assertEquals(CLAVE_TODO_EL_TIEMPO, claveDePeriodo("2030-12-31", TODO))
        assertTrue(enElPeriodo("2000-01-01", CLAVE_TODO_EL_TIEMPO, TODO))
        assertTrue(enElPeriodo("2099-12-31", CLAVE_TODO_EL_TIEMPO, TODO))
        assertNull(finDePeriodo(CLAVE_TODO_EL_TIEMPO, TODO))
        assertNull(diasDelPeriodo(CLAVE_TODO_EL_TIEMPO, TODO))
        assertNull(diasTranscurridosEnPeriodo(CLAVE_TODO_EL_TIEMPO, "2026-08-25", TODO))
        assertEquals(CLAVE_TODO_EL_TIEMPO, periodoAdyacente(CLAVE_TODO_EL_TIEMPO, 1, TODO))
        assertEquals(CLAVE_TODO_EL_TIEMPO, periodoAdyacente(CLAVE_TODO_EL_TIEMPO, -1, TODO))
        assertEquals("Todo el tiempo", etiquetaDePeriodo(CLAVE_TODO_EL_TIEMPO, TODO))
    }

    @Test fun diasTranscurridos() {
        assertEquals(15, diasTranscurridosEnPeriodo("2026-08", "2026-08-15", MENSUAL_PURO))
        assertEquals(31, diasTranscurridosEnPeriodo("2026-07", "2026-08-15", MENSUAL_PURO))
        assertEquals(3, diasTranscurridosEnPeriodo("2026-08-17", "2026-08-19", SEMANAL))
    }

    @Test fun idaYVuelta() {
        for (c in listOf(SEMANAL, QUINCENAL, QUINCENAS_MES, MENSUAL_PURO, MENSUAL_DESFASE_4)) {
            val clave = claveDePeriodo("2026-08-20", c)
            assertEquals(clave, periodoAdyacente(periodoAdyacente(clave, 1, c), -1, c))
        }
    }

    @Test fun personalizado() {
        val c = ConfigPeriodo("personalizado", 0, 10.0, "2026-01-01")
        assertEquals("2026-01-11", inicioDePeriodo("2026-01-15", c))
        assertEquals("2026-01-20", finDePeriodo("2026-01-11", c))
        assertEquals("2025-12-22", inicioDePeriodo("2025-12-31", c))
        assertEquals("11–20 ene", etiquetaDePeriodo("2026-01-11", c))
    }
}
