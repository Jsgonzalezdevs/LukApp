package app.lukapp.dominio

// Origen: `lib/exportarExcel.ts` y `components/ReporteFinancieroModal.tsx`. Lo que se exporta sale del libro tal cual
// está en el teléfono; el archivo se guarda donde la persona elija y no pasa por ningún servidor.

private fun escaparXml(t: String) = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")

/** Los estilos del libro (XML Spreadsheet 2003: abre en Excel, LibreOffice y Google Sheets sin librerías). */
private const val ESTILOS = """ <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D8"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#18181B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Money">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="${'$'}#,##0"/>
  </Style>
  <Style ss:ID="MoneyIngreso">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#16A34A" ss:Bold="1"/>
   <NumberFormat ss:Format="${'$'}#,##0"/>
  </Style>
  <Style ss:ID="MoneyGasto">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#DC2626"/>
   <NumberFormat ss:Format="${'$'}#,##0"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Bold">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>"""

private fun celdaTexto(estilo: String?, valor: String) = "<Cell${estilo?.let { " ss:StyleID=\"$it\"" } ?: ""}><Data ss:Type=\"String\">${escaparXml(valor)}</Data></Cell>"
private fun celdaNumero(estilo: String, valor: Long) = "<Cell ss:StyleID=\"$estilo\"><Data ss:Type=\"Number\">$valor</Data></Cell>"

/**
 * Origen: `generarExcelFinanciero`. Dos hojas: «Movimientos» (de lo más nuevo a lo más viejo) y «Cuentas y Saldos». Con
 * `mesFiltro` ('YYYY-MM') solo entran los de ese mes; sin él, lo que llegue (quien llama ya lo recortó al período).
 * Diferencia con la web: un traslado se escribe «Transferencia»; la web lo escribe «Gasto», que no es lo que es.
 */
fun generarExcelFinanciero(transacciones: List<Transaccion>, cajitas: List<Cajita>, saldos: Map<String, Long>, mesFiltro: String? = null): String {
    fun nombreCuenta(id: String?) = if (id == null) "Sin cuenta" else cajitas.firstOrNull { it.id == id }?.nombre ?: "Sin cuenta"
    val txs = if (mesFiltro != null) transacciones.filter { it.occurredOn.startsWith(mesFiltro) } else transacciones
    val ordenadas = txs.sortedByDescending { it.occurredOn }
    val filasMov = ordenadas.joinToString("") { tx ->
        val ingreso = tx.kind == "ingreso"
        """

   <Row>
    ${celdaTexto("Center", tx.occurredOn)}
    ${celdaTexto("Center", when (tx.kind) { "ingreso" -> "Ingreso"; "transferencia" -> "Transferencia"; else -> "Gasto" })}
    ${celdaNumero(if (ingreso) "MoneyIngreso" else "MoneyGasto", tx.amountCop)}
    ${celdaTexto(null, tx.category)}
    ${celdaTexto(null, tx.description.ifEmpty { tx.rawTranscript })}
    ${celdaTexto(null, nombreCuenta(tx.cuentaId))}
    ${celdaTexto("Center", if (!tx.afectaSaldo) "No" else "Sí")}
   </Row>"""
    }
    val filasCuentas = cajitas.filter { it.archivedAt == null }.joinToString("") { c ->
        """

   <Row>
    ${celdaTexto("Bold", c.nombre)}
    ${celdaTexto("Center", c.tipo)}
    ${celdaNumero(if (TipoCajita.esPasivo(c.tipo)) "MoneyGasto" else "Money", saldos[c.id] ?: 0L)}
   </Row>"""
    }
    return """<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
$ESTILOS

 <!-- HOJA 1: MOVIMIENTOS -->
 <Worksheet ss:Name="Movimientos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="220"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Row ss:Height="24">
    ${listOf("Fecha", "Tipo", "Monto (COP)", "Categoría", "Descripción", "Cuenta", "Afecta saldo").joinToString("\n    ") { celdaTexto("Header", it) }}
   </Row>
   $filasMov
  </Table>
 </Worksheet>

 <!-- HOJA 2: CUENTAS Y SALDOS -->
 <Worksheet ss:Name="Cuentas y Saldos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="180"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    ${listOf("Cuenta / Cajita", "Tipo", "Saldo Actual (COP)").joinToString("\n    ") { celdaTexto("Header", it) }}
   </Row>
   $filasCuentas
  </Table>
 </Worksheet>
</Workbook>"""
}

/** Origen: `descargarExcel`. `nombre` es lo que lleva el archivo cuando los datos ya vienen recortados a un período que no es un mes. */
fun nombreArchivoExcel(mesFiltro: String? = null, nombre: String? = null): String {
    val etiqueta = nombre ?: mesFiltro
    return if (etiqueta != null) "finanzas-$etiqueta.xls" else "finanzas-completo.xls"
}

private val MESES = listOf("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")

data class FilaCategoriaReporte(val categoria: String, val nombre: String, val color: String, val total: Long, val pct: Int)
data class FilaCuentaReporte(val nombre: String, val saldo: Long, val esPasivo: Boolean)

/** Lo que dice el informe de un mes: se calcula una vez y lo usan la pantalla y el PDF. */
data class ReporteMensual(
    val mes: String,
    val nombreMes: String,
    val movimientos: Int,
    val ingresos: Long,
    val gastos: Long,
    val balance: Long,
    val porcentajeBalance: Int?,
    val resumenBalance: String,
    val categorias: List<FilaCategoriaReporte>,
    val patrimonio: Long,
    val cuentas: List<FilaCuentaReporte>,
) { val balancePositivo get() = balance >= 0 }

/** «2026-11» → «Noviembre de 2026». */
fun nombreDelMesLargo(mes: String): String {
    val (anio, m) = mes.split("-")
    return "${MESES[m.toInt() - 1]} de $anio"
}

/**
 * Origen: el cálculo de `ReporteFinancieroModal`. Ingresos y gastos son los del mes (por prefijo de fecha); el patrimonio es
 * la suma de las cuentas activas que NO son pasivos. Se muestran las 6 categorías de mayor gasto.
 */
fun reporteMensual(
    transacciones: List<Transaccion>, cajitas: List<Cajita>, saldos: Map<String, Long>, mes: String,
    nombreDe: (String) -> String, colorDe: (String) -> String,
): ReporteMensual {
    val txMes = transacciones.filter { it.occurredOn.startsWith(mes) }
    val ingresos = txMes.filter { it.kind == "ingreso" }.sumOf { it.amountCop }
    val gastos = txMes.filter { it.kind == "gasto" }.sumOf { it.amountCop }
    val balance = ingresos - gastos
    val pct = if (ingresos > 0) Math.round(balance.toDouble() / ingresos * 100).toInt() else null
    val porCategoria = LinkedHashMap<String, Long>()
    txMes.filter { it.kind == "gasto" }.forEach { porCategoria[it.category] = (porCategoria[it.category] ?: 0L) + it.amountCop }
    val categorias = porCategoria.entries.sortedByDescending { it.value }.take(6).map { (c, t) ->
        FilaCategoriaReporte(c, nombreDe(c), colorDe(c), t, if (gastos > 0) Math.round(t.toDouble() / gastos * 100).toInt() else 0)
    }
    val activas = cajitas.filter { it.archivedAt == null }
    val patrimonio = activas.filter { !TipoCajita.esPasivo(it.tipo) }.sumOf { saldos[it.id] ?: 0L }
    val resumen = when {
        ingresos == 0L -> "Registra tus movimientos para ver el cierre del mes."
        balance >= 0 -> "Te quedó disponible el $pct% de lo que ingresó."
        else -> "Gastaste ${Math.abs(pct ?: 0)}% más de lo que ingresó."
    }
    return ReporteMensual(
        mes, nombreDelMesLargo(mes), txMes.size, ingresos, gastos, balance, pct, resumen, categorias, patrimonio,
        activas.map { FilaCuentaReporte(it.nombre, saldos[it.id] ?: 0L, TipoCajita.esPasivo(it.tipo)) },
    )
}

fun nombreArchivoInforme(mes: String) = "informe-$mes.pdf"

/** `toLocaleDateString('es-CO')`: día/mes/año sin ceros de relleno. */
fun fechaDelInforme(iso: String): String = iso.split("-").let { "${it[2].toInt()}/${it[1].toInt()}/${it[0]}" }
