package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FiltrosTest {
    private var n = 0
    private fun tx(monto: Long, cat: String, desc: String, kind: String = TipoTx.GASTO, fecha: String = "2026-11-10", cuenta: String? = null) =
        Transaccion("t${n++}", kind, monto, cat, desc, fecha, cuenta, createdAt = "2026-11-10T00:00:00Z")
    private val libro = listOf(
        tx(45_000, "comida", "Almuerzo con Juan"),
        tx(120_000, "transporte", "Envio con BRE-B a: JUAN PEREZ"),
        tx(2_000_000, "otros", "Salario", TipoTx.INGRESO),
        tx(9_000, "comida", "Café", cuenta = "nequi"),
    )

    @Test fun filtroIntactoCoincideConTodoYNoCuentaComoActivo() {
        assertEquals(4, filtrarMovimientos(libro, FILTRO_VACIO, CATALOGO_BASE).size)
        assertFalse(filtroActivo(FILTRO_VACIO)); assertFalse(filtroActivo(Filtro(texto = "   ")))
        assertTrue(filtroActivo(Filtro(kind = "gasto")))
    }

    @Test fun textoBuscaEnDescripcionContraparteYCategoriaSinTildesNiMayusculas() {
        assertEquals(2, filtrarMovimientos(libro, Filtro(texto = "juan"), CATALOGO_BASE).size)
        // «café» además implica la categoría Comida para el intérprete, igual que en la web: trae también el almuerzo.
        val cafe = filtrarMovimientos(libro, Filtro(texto = "CAFE"), CATALOGO_BASE).map { it.description }
        assertTrue("Café" in cafe); assertEquals(2, cafe.size)
        assertEquals(1, filtrarMovimientos(libro, Filtro(texto = "Cafe con leche"), CATALOGO_BASE).count { it.description == "Café" })
        // La contraparte cuenta aunque el banco escriba el prefijo a su manera.
        assertEquals(1, filtrarMovimientos(libro, Filtro(texto = "juan perez"), CATALOGO_BASE).size)
    }

    @Test fun montoSeBuscaPorDigitosSinPuntos() {
        assertEquals(1, filtrarMovimientos(libro, Filtro(texto = "45.000"), CATALOGO_BASE).size)
        assertEquals(1, filtrarMovimientos(libro, Filtro(texto = "\$45,000"), CATALOGO_BASE).size)
    }

    @Test fun filtrosDeTipoCategoriaCuentaYFechaSeCombinan() {
        assertEquals(3, filtrarMovimientos(libro, Filtro(kind = "gasto")).size)
        assertEquals(2, filtrarMovimientos(libro, Filtro(categoria = "comida")).size)
        assertEquals(1, filtrarMovimientos(libro, Filtro(cuentaId = "nequi")).size)
        assertEquals(0, filtrarMovimientos(libro, Filtro(desde = "2026-11-11")).size)
        assertEquals(4, filtrarMovimientos(libro, Filtro(desde = "2026-11-10", hasta = "2026-11-10")).size)
    }

    @Test fun resumenSumaGastoEIngresoPorSeparado() {
        val r = resumirFiltrado(libro)
        assertEquals(4, r.cuantos); assertEquals(174_000L, r.gastoCop); assertEquals(2_000_000L, r.ingresoCop)
    }

    @Test fun funcionesSeBuscanPorTituloAyudaOAliasYTodasLasPalabrasDebenCalzar() {
        assertEquals(listOf("recurrentes"), buscarFunciones("netflix").map { it.id })
        assertEquals(listOf("recurrentes"), buscarFunciones("Pagos  FIJOS").map { it.id })
        assertTrue(buscarFunciones("zzz").isEmpty()); assertTrue(buscarFunciones("   ").isEmpty())
        assertTrue(buscarFunciones("pagos zzz").isEmpty())
    }
}
