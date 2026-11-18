package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import javax.xml.parsers.DocumentBuilderFactory

class ExportarTest {
    private fun tx(id: String, kind: String, monto: Long, fecha: String, cat: String = "comida", desc: String = "x", cuenta: String? = "c1", afecta: Boolean = true) =
        Transaccion(id, kind, monto, cat, desc, fecha, cuenta, afecta, "dicho: $desc", null, null, "${fecha}T00:00:00Z")
    private fun caja(id: String, nombre: String, tipo: String = TipoCajita.CUENTA, archivada: Boolean = false) =
        Cajita(id, nombre, "Wallet", tipo, null, null, null, "2026-01-01T00:00:00Z", if (archivada) "2026-02-01T00:00:00Z" else null)

    @Test fun excelEsXmlValidoConDosHojas() {
        val xml = generarExcelFinanciero(
            listOf(tx("1", "gasto", 85_000, "2026-11-03", desc = "Mercado & <más>"), tx("2", "ingreso", 2_000_000, "2026-11-05", cat = "ingreso")),
            listOf(caja("c1", "Nequi \"principal\""), caja("c2", "Tarjeta", TipoCajita.TARJETA), caja("c3", "Vieja", archivada = true)),
            mapOf("c1" to 500_000L, "c2" to 120_000L),
        )
        val doc = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }.newDocumentBuilder().parse(xml.byteInputStream())
        val hojas = doc.getElementsByTagNameNS("urn:schemas-microsoft-com:office:spreadsheet", "Worksheet")
        assertEquals(2, hojas.length)
        assertTrue(xml.contains("ss:Name=\"Movimientos\"") && xml.contains("ss:Name=\"Cuentas y Saldos\""))
        assertTrue(xml.contains("Mercado &amp; &lt;más&gt;"))
        assertTrue(xml.contains("Nequi &quot;principal&quot;"))
        assertTrue(!xml.contains("Vieja"))
        assertTrue(xml.contains("<Data ss:Type=\"Number\">120000</Data>"))
    }

    @Test fun movimientosDeLoMasNuevoALoMasViejoYTrasladoNoEsGasto() {
        val xml = generarExcelFinanciero(listOf(tx("a", "gasto", 1, "2026-11-01", desc = "viejo"), tx("b", "transferencia", 2, "2026-11-09", desc = "nuevo")), emptyList(), emptyMap())
        assertTrue(xml.indexOf("nuevo") < xml.indexOf("viejo"))
        assertTrue(xml.contains(">Transferencia<"))
    }

    @Test fun filtroPorMesYDescripcionVaciaUsaLoDicho() {
        val xml = generarExcelFinanciero(listOf(tx("a", "gasto", 1, "2026-10-31", desc = "octubre"), tx("b", "gasto", 2, "2026-11-01", desc = "")), emptyList(), emptyMap(), "2026-11")
        assertTrue(!xml.contains("octubre"))
        assertTrue(xml.contains("dicho: "))
        assertTrue(xml.contains(">Sin cuenta<"))
    }

    @Test fun marcaDeSaldo() {
        val xml = generarExcelFinanciero(listOf(tx("a", "gasto", 1, "2026-11-01", afecta = false)), listOf(caja("c1", "A")), emptyMap())
        assertTrue(xml.contains("<Data ss:Type=\"String\">No</Data>"))
    }

    @Test fun nombresDeArchivo() {
        assertEquals("finanzas-completo.xls", nombreArchivoExcel())
        assertEquals("finanzas-2026-11.xls", nombreArchivoExcel("2026-11"))
        assertEquals("finanzas-2026-11-16.xls", nombreArchivoExcel(null, "2026-11-16"))
        assertEquals("informe-2026-11.pdf", nombreArchivoInforme("2026-11"))
    }

    @Test fun reporteDelMes() {
        val txs = listOf(
            tx("1", "ingreso", 1_000_000, "2026-11-01", cat = "ingreso"), tx("2", "gasto", 300_000, "2026-11-02", cat = "mercado"),
            tx("3", "gasto", 100_000, "2026-11-03", cat = "comida"), tx("4", "gasto", 50_000, "2026-10-30", cat = "comida"),
            tx("5", "transferencia", 9_000, "2026-11-04"),
        )
        val cajas = listOf(caja("c1", "Nequi"), caja("c2", "Tarjeta", TipoCajita.TARJETA), caja("c3", "Vieja", archivada = true))
        val r = reporteMensual(txs, cajas, mapOf("c1" to 400_000L, "c2" to 90_000L, "c3" to 7L), "2026-11", { it.uppercase() }, { "#000000" })
        assertEquals("Noviembre de 2026", r.nombreMes)
        assertEquals(4, r.movimientos)
        assertEquals(1_000_000L, r.ingresos); assertEquals(400_000L, r.gastos); assertEquals(600_000L, r.balance)
        assertEquals(60, r.porcentajeBalance)
        assertEquals("Te quedó disponible el 60% de lo que ingresó.", r.resumenBalance)
        assertEquals(listOf("MERCADO" to 75, "COMIDA" to 25), r.categorias.map { it.nombre to it.pct })
        assertEquals(400_000L, r.patrimonio)
        assertEquals(listOf("Nequi", "Tarjeta"), r.cuentas.map { it.nombre })
        assertEquals(true, r.cuentas[1].esPasivo)
    }

    @Test fun reporteConGastoMayorQueIngresoYSinIngresos() {
        val mas = reporteMensual(listOf(tx("1", "ingreso", 100, "2026-11-01"), tx("2", "gasto", 150, "2026-11-02")), emptyList(), emptyMap(), "2026-11", { it }, { "#000" })
        assertEquals("Gastaste 50% más de lo que ingresó.", mas.resumenBalance); assertEquals(false, mas.balancePositivo)
        val vacio = reporteMensual(emptyList(), emptyList(), emptyMap(), "2026-11", { it }, { "#000" })
        assertNull(vacio.porcentajeBalance); assertEquals("Registra tus movimientos para ver el cierre del mes.", vacio.resumenBalance)
    }

    @Test fun categoriasSoloSeisYFecha() {
        val txs = (1..8).map { tx("$it", "gasto", it * 1000L, "2026-11-01", cat = "c$it") }
        assertEquals(6, reporteMensual(txs, emptyList(), emptyMap(), "2026-11", { it }, { "#000" }).categorias.size)
        assertEquals("8/11/2026", fechaDelInforme("2026-11-08"))
        assertEquals("Diciembre de 2026", nombreDelMesLargo("2026-12"))
    }
}
