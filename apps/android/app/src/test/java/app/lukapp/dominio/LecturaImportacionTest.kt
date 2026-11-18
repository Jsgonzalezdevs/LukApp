package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** Las mismas pruebas de `leerImportacion.test.ts`, con el mismo `extracto-prueba.xlsx`. */
class LecturaImportacionTest {
    @Test fun fechasColombianasYNumerosDeExcel() {
        assertEquals("2026-10-20", fechaImportada("20/10/2026"))
        assertEquals("2026-10-20", fechaImportada("20/10/2026 18:45:00"))
        assertEquals("2026-10-20", fechaImportada(46_315.0))
        assertEquals("2026-10-20", fechaImportada(46_315))
        assertNull(fechaImportada("31/02/2026"))
        assertNull(fechaImportada(75_000.0 + 10_000))
        assertNull(fechaImportada(4_500.0))
        assertEquals("2025-01-01", fechaImportada("2025-01-01"))
        assertEquals("2026-10-20", fechaImportada("20.10.26"))
    }

    @Test fun montosConSeparadorColombianoInternacionalYSigno() {
        assertEquals(1_250_000L, montoImportado("$ 1.250.000"))
        assertEquals(1_250L, montoImportado("1,250.00"))
        assertEquals(25_000L, montoImportado("-25.000"))
        assertEquals(4_500L, montoImportado(4500.0))
        assertEquals(8_500L, montoImportado("8.500"))
        assertNull(montoImportado("sin cifra"))
    }

    @Test fun debitoYCreditoSeparadosYFilasQueNoSonMovimientos() {
        val r = analizarFilas(listOf(
            listOf("Fecha", "Descripción", "Débito", "Crédito"),
            listOf("15/10/2026", "Mercado con; coma", "75.000", ""),
            listOf("16/10/2026", "Pago nómina", "", "2.500.000"),
            listOf("No es fecha", "Fila resumen", "", "4.000"),
        ))
        assertEquals(2, r.movimientos.size)
        assertEquals(Triple("2026-10-15", 75_000L, "gasto"), r.movimientos[0].let { Triple(it.fecha, it.montoCop, it.tipo) })
        assertEquals(Triple("2026-10-16", 2_500_000L, "ingreso"), r.movimientos[1].let { Triple(it.fecha, it.montoCop, it.tipo) })
        assertEquals("mercado", r.movimientos[0].categoria)
    }

    @Test fun sinEncabezadosSegurosSeRechazaEnVezDeAdivinar() {
        val e = assertThrows(ErrorImportacion::class.java) { analizarFilas(listOf(listOf("x", "y"), listOf("a", "b"))) }
        assertTrue(e.message!!.contains("columnas de fecha"))
    }

    @Test fun conservaLaMarcaDeSaldoDeUnCsvExportadoDeLukApp() {
        val r = analizarFilas(listOf(
            listOf("Fecha", "Tipo", "Monto", "Categoría", "Descripción", "Cuenta", "Afecta saldo"),
            listOf("2025-01-01", "gasto", "25000", "comida", "Café", "Efectivo", "No"),
        ))
        assertEquals("comida", r.movimientos[0].categoria)
        assertEquals(false, r.movimientos[0].afectaSaldo)
    }

    @Test fun csvConPuntoYComaYComillas() {
        val r = leerCsv("Fecha;Descripción;Débito;Crédito\n15/10/2026;\"Café; centro\";8.500;".toByteArray())
        assertEquals(Triple("Café; centro", 8_500L, "gasto"), r.movimientos[0].let { Triple(it.descripcion, it.montoCop, it.tipo) })
    }

    @Test fun coma_dentro_de_una_celda_no_cambia_el_delimitador() {
        val r = leerCsv("Fecha,Descripción,Valor,Tipo\n20/10/2026,\"Café, centro\",4500,Gasto".toByteArray())
        assertEquals(Triple("Café, centro", 4_500L, "gasto"), r.movimientos[0].let { Triple(it.descripcion, it.montoCop, it.tipo) })
    }

    @Test fun csvConMarcaBomYSaltosWindows() {
        val r = leerCsv("﻿Fecha,Descripción,Valor\r\n20/10/2026,Taxi,\"-12.000\"\r\n21/10/2026,Nómina,+3.000.000\r\n".toByteArray())
        assertEquals(listOf("gasto", "ingreso"), r.movimientos.map { it.tipo })
        assertEquals("transporte", r.movimientos[0].categoria)
    }

    @Test fun hojaXlsxConFechasDeExcelYCeldasCompartidas() {
        val bytes = javaClass.getResourceAsStream("/extracto-prueba.xlsx")!!.readBytes()
        val r = leerExcel(bytes)
        assertEquals(2, r.movimientos.size)
        assertEquals(listOf("2026-10-20", "2026-10-21"), r.movimientos.map { it.fecha })
        assertEquals(listOf("Mercado", "Nómina"), r.movimientos.map { it.descripcion })
        assertEquals(listOf(45_000L, 2_500_000L), r.movimientos.map { it.montoCop })
        assertEquals(listOf("gasto", "ingreso"), r.movimientos.map { it.tipo })
    }

    @Test fun unArchivoQueNoEsXlsxSeRechazaConMensaje() {
        val e = assertThrows(ErrorImportacion::class.java) { leerExcel("esto no es un zip".toByteArray()) }
        assertTrue(e.message!!.contains("xlsx"))
    }

    @Test fun textoDeFotoSacaLineasConUnSoloNumeroYMarcaConfianzaMedia() {
        val r = analizarTextoOCR("20/10/2026 COMPRA PANADERIA 15.500\n21/10/2026 ABONO NOMINA 1.200.000")
        assertEquals(listOf("2026-10-20" to 15_500L, "2026-10-21" to 1_200_000L), r.movimientos.map { it.fecha to it.montoCop })
        assertEquals(listOf("gasto", "ingreso"), r.movimientos.map { it.tipo })
        assertTrue(r.movimientos.all { it.confianza == "media" })
        assertTrue(r.advertencias.first().contains("foto"))
    }

    @Test fun lineasConDosNumerosNoSeAdivinan() {
        val e = assertThrows(ErrorImportacion::class.java) { analizarTextoOCR("20/10/2026 COMPRA TIENDA 15.500 saldo 120.000") }
        assertTrue(e.message!!.contains("imagen"))
    }
}
