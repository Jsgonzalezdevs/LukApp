package app.lukapp.dominio

import java.io.ByteArrayInputStream
import java.text.Normalizer
import java.time.LocalDate
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document
import org.w3c.dom.Element

// Origen: `analista/leerImportacion.ts`. CSV, Excel (.xlsx) y el texto que sale de una foto se leen EN EL TELÉFONO,
// sin mandar el archivo a ningún servidor. Un archivo que no se entiende se rechaza con un mensaje; nunca se adivina.

/** Un archivo que no se pudo leer; el mensaje es para la persona. */
class ErrorImportacion(mensaje: String) : Exception(mensaje)

private val FECHA_ISO = Regex("^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})$")
private val FECHA_DMY = Regex("^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{2,4})$")
private val FECHA_CON_HORA = Regex("^(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4})(?=$|\\s)")

/** `String(valor ?? '')` de JS: un número entero no lleva «.0». */
private fun textoPlano(valor: Any?): String = when (valor) {
    null -> ""
    is Number -> { val d = valor.toDouble(); if (d == Math.floor(d) && !d.isInfinite() && Math.abs(d) < 1e15) d.toLong().toString() else valor.toString() }
    else -> valor.toString()
}

private fun texto(valor: Any?): String = textoPlano(valor).replace(Regex("\\s+"), " ").trim()

/** Origen: `fechaImportada`. Un número de Excel es «días desde 1899-12-30»; un monto corriente se rechaza. */
fun fechaImportada(valor: Any?): String? {
    if (valor is Number) {
        val d = valor.toDouble()
        if (d.isNaN() || d.isInfinite() || d < 20_000 || d > 80_000) return null
        return LocalDate.of(1899, 12, 30).plusDays(Math.floor(d).toLong()).toString()
    }
    val t = texto(valor)
    val sinHora = FECHA_CON_HORA.find(t)?.value ?: t
    val iso = FECHA_ISO.find(sinHora)
    val dmy = FECHA_DMY.find(sinHora)
    if (iso == null && dmy == null) return null
    val anio = (iso?.groupValues?.get(1) ?: dmy!!.groupValues[3]).toInt()
    val mes = (iso?.groupValues?.get(2) ?: dmy!!.groupValues[2]).toInt()
    val dia = (iso?.groupValues?.get(3) ?: dmy!!.groupValues[1]).toInt()
    val completo = if (anio < 100) (if (anio < 70) 2000 + anio else 1900 + anio) else anio
    return try { LocalDate.of(completo, mes, dia).toString() } catch (_: Exception) { null }
}

/** Origen: `montoImportado`. Separador colombiano o internacional, con o sin signo; siempre en pesos enteros positivos. */
fun montoImportado(valor: Any?): Long? {
    if (valor is Number) { val d = valor.toDouble(); return if (d.isNaN() || d.isInfinite()) null else Math.round(Math.abs(d)) }
    var limpio = texto(valor).replace(Regex("[^\\d,.-]"), "")
    if (limpio.isEmpty()) return null
    val coma = limpio.lastIndexOf(',')
    val punto = limpio.lastIndexOf('.')
    if (coma >= 0 && punto >= 0) {
        limpio = if (coma > punto) limpio.replace(".", "").replace(",", ".") else limpio.replace(",", "")
    } else if (coma >= 0) {
        limpio = if (limpio.length - coma - 1 == 2) limpio.replace(",", ".") else limpio.replace(",", "")
    } else if (punto >= 0 && limpio.length - punto - 1 == 3) {
        limpio = limpio.replace(".", "")
    }
    val n = limpio.toDoubleOrNull() ?: return null
    return if (n.isNaN() || n.isInfinite()) null else Math.round(Math.abs(n))
}

private fun cabeceraNormalizada(valor: Any?): String =
    Normalizer.normalize(texto(valor), Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase().replace(Regex("[^a-z0-9]"), "")

private fun ubicarColumna(cabeceras: List<String>, patrones: List<Regex>) = cabeceras.indexOfFirst { c -> patrones.any { it.containsMatchIn(c) } }

private val PATRONES = mapOf(
    "fecha" to listOf("fecha", "date"),
    "descripcion" to listOf("descripcion", "concepto", "detalle", "comercio", "referencia", "merchant", "establecimiento", "nombre"),
    "debito" to listOf("debito", "retiro", "cargo", "gasto", "withdrawal"),
    "credito" to listOf("credito", "abono", "deposito", "^ingresos?$", "credit"),
    "monto" to listOf("monto", "valor", "importe", "amount", "transaccion"),
    "tipo" to listOf("^tipo$", "movimiento", "ingresogasto$", "gastosingreso$"),
    "categoria" to listOf("categoria", "category"),
    "afectaSaldo" to listOf("afectasaldo", "impactasaldo", "balanceactual"),
).mapValues { (_, v) -> v.map { Regex(it) } }

private fun columnasDe(cabeceras: List<Any?>): Map<String, Int> {
    val n = cabeceras.map { cabeceraNormalizada(it) }
    return PATRONES.mapValues { (_, p) -> ubicarColumna(n, p) }
}

private val ETIQUETAS_A_CLAVE = CATEGORY_LABELS.entries.associate { (k, v) -> cabeceraNormalizada(v) to k } + CATEGORIES.associateBy { cabeceraNormalizada(it) }

private val REGLAS_CATEGORIA: List<Pair<Regex, String>> = listOf(
    "supermerc|mercado|exito|carulla|\\bd1\\b|\\bara\\b|olimpica" to "mercado",
    "restaurante|panader|cafe|comida|domicilio|rappi|crepes|hamburgues" to "comida",
    "uber|taxi|transmi|transporte|gasolina|peaje|cabify|didi" to "transporte",
    "luz|energia|agua|internet|telefon|servicio publico" to "servicios",
    "farmacia|medic|clinica|salud|drogueria" to "salud",
    "arriendo|hogar|ferreteria|mueble" to "hogar",
    "cine|netflix|spotify|juego|entretenimiento" to "entretenimiento",
    "ropa|zapato|vestuario" to "ropa",
    "universidad|colegio|educacion|curso|libro" to "educacion",
    "transferencia|traslado" to "transferencia",
    "ahorro|inversion|bolsillo" to "ahorro",
).map { (p, c) -> Regex(p) to c }

private fun inferirCategoria(descripcion: String, tipo: String, categoriaArchivo: Any?): String {
    ETIQUETAS_A_CLAVE[cabeceraNormalizada(categoriaArchivo)]?.let { return it }
    if (tipo == "ingreso") return "ingreso"
    val d = Normalizer.normalize(descripcion, Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase()
    return REGLAS_CATEGORIA.firstOrNull { it.first.containsMatchIn(d) }?.second ?: "otros"
}

private fun celda(fila: List<Any?>, i: Int): Any? = if (i >= 0 && i < fila.size) fila[i] else null

private fun clasificar(fila: List<Any?>, c: Map<String, Int>): MovimientoExtraido? {
    val fecha = fechaImportada(celda(fila, c.getValue("fecha")))
    val descripcion = texto(celda(fila, c.getValue("descripcion")))
    if (fecha == null || descripcion.isEmpty()) return null
    val debito = if (c.getValue("debito") >= 0) montoImportado(celda(fila, c.getValue("debito"))) else null
    val credito = if (c.getValue("credito") >= 0) montoImportado(celda(fila, c.getValue("credito"))) else null
    val valor = if (c.getValue("monto") >= 0) montoImportado(celda(fila, c.getValue("monto"))) else null
    val tipoTexto = if (c.getValue("tipo") >= 0) cabeceraNormalizada(celda(fila, c.getValue("tipo"))) else ""
    val saldoTexto = if (c.getValue("afectaSaldo") >= 0) cabeceraNormalizada(celda(fila, c.getValue("afectaSaldo"))) else ""
    var monto = 0L
    var tipo = "gasto"
    val d = debito ?: 0L
    val cr = credito ?: 0L
    if (d != 0L || cr != 0L) {
        // Débito y crédito a la vez no se pueden interpretar: la fila se deja fuera.
        if (d > 0 && cr > 0) return null
        monto = if (d != 0L) d else cr
        tipo = if (cr != 0L) "ingreso" else "gasto"
    } else if (valor != null && valor != 0L) {
        val original = texto(celda(fila, c.getValue("monto")))
        tipo = if (Regex("ingreso|abono|credito|deposito|entrada").containsMatchIn(tipoTexto) || Regex("^\\s*\\+").containsMatchIn(original) || Regex("^\\s*\\(").containsMatchIn(original)) "ingreso" else "gasto"
        monto = valor
        // Un monto negativo es una salida; los paréntesis son la misma notación contable.
        if (Regex("\\(.*\\)").containsMatchIn(original) || Regex("^\\s*-").containsMatchIn(original)) tipo = "gasto"
    }
    if (monto == 0L) return null
    val lower = descripcion.lowercase()
    val exclusion = when {
        Regex("transferencia entre mis cuentas|entre cuentas propias|entre mis cuentas|bolsillo a|traslado interno|traslado entre cuentas").containsMatchIn(lower) -> MotivoExclusion.TRASLADO_PROPIO
        Regex("pago tarjeta|abono tarjeta|pago de tarjeta").containsMatchIn(lower) -> MotivoExclusion.PAGO_TARJETA
        Regex("reverso|reversion|anulacion").containsMatchIn(lower) -> MotivoExclusion.REVERSO
        else -> null
    }
    return MovimientoExtraido(
        fecha, descripcion, monto, tipo, inferirCategoria(descripcion, tipo, celda(fila, c.getValue("categoria"))),
        "Revisa la categoría y el tipo antes de importar.", null, "alta", exclusion,
        if (saldoTexto.isNotEmpty()) saldoTexto !in setOf("no", "false", "0", "historico", "historica") else null,
    )
}

/** Origen: `analizarFilas`. Busca la fila de encabezados (fecha + descripción + algún monto) y lee lo que sigue. */
fun analizarFilas(filas: List<List<Any?>>, entidad: String? = null): AnalisisResultado {
    val indice = filas.indexOfFirst { f -> val c = columnasDe(f); c.getValue("fecha") >= 0 && c.getValue("descripcion") >= 0 && (c.getValue("monto") >= 0 || c.getValue("debito") >= 0 || c.getValue("credito") >= 0) }
    if (indice < 0) throw ErrorImportacion("No encontramos columnas de fecha, descripción y monto. Revisa que el archivo tenga encabezados.")
    val columnas = columnasDe(filas[indice])
    val movimientos = filas.drop(indice + 1).mapNotNull { clasificar(it, columnas) }
    if (movimientos.isEmpty()) throw ErrorImportacion("No encontramos movimientos legibles en el archivo. Verifica las fechas, descripciones y montos.")
    val fechas = movimientos.map { it.fecha }.sorted()
    val primera = fechas.first(); val ultima = fechas.last()
    return AnalisisResultado(
        entidad, PeriodoExtracto(primera, ultima, if (primera == ultima) primera else "$primera – $ultima"),
        "Encontramos ${movimientos.size} filas con movimientos. Revisa cada fila, categoría y posible duplicado antes de importarla.",
        emptyList(), emptyList(), emptyList(), movimientos, listOf("El archivo se procesó en este dispositivo; comprueba los datos antes de guardar."),
    )
}

/** Origen: `csvComoFilas`. El delimitador es el más frecuente en la primera línea FUERA de comillas (`;`, `,` o tabulador). */
fun csvComoFilas(csv: String): List<List<String>> {
    val primeraLinea = csv.take(8_000).split(Regex("\\r?\\n"), limit = 2).first()
    val conteos = linkedMapOf(';' to 0, ',' to 0, '\t' to 0)
    var entre = false
    var i = 0
    while (i < primeraLinea.length) {
        val ch = primeraLinea[i]
        if (ch == '"' && i + 1 < primeraLinea.length && primeraLinea[i + 1] == '"' && entre) i++
        else if (ch == '"') entre = !entre
        else if (!entre && conteos.containsKey(ch)) conteos[ch] = conteos.getValue(ch) + 1
        i++
    }
    val delimitador = conteos.entries.sortedByDescending { it.value }.first().key
    val filas = mutableListOf<List<String>>()
    var fila = mutableListOf<String>()
    val campo = StringBuilder()
    entre = false
    i = 0
    while (i < csv.length) {
        val ch = csv[i]
        if (ch == '"' && entre && i + 1 < csv.length && csv[i + 1] == '"') { campo.append('"'); i++ }
        else if (ch == '"') entre = !entre
        else if (ch == delimitador && !entre) { fila.add(campo.toString()); campo.setLength(0) }
        else if ((ch == '\n' || ch == '\r') && !entre) {
            if (campo.isNotEmpty() || fila.isNotEmpty()) { fila.add(campo.toString()); filas.add(fila) }
            fila = mutableListOf(); campo.setLength(0)
            if (ch == '\r' && i + 1 < csv.length && csv[i + 1] == '\n') i++
        } else campo.append(ch)
        i++
    }
    if (campo.isNotEmpty() || fila.isNotEmpty()) { fila.add(campo.toString()); filas.add(fila) }
    return filas
}

private const val MAX_ENTRADA = 8 * 1024 * 1024
private const val MAX_TOTAL = 24 * 1024 * 1024

/** Solo las partes del libro que hacen falta, con tope de tamaño: un zip malicioso no debe agotar la memoria. */
private fun entradasXlsx(bytes: ByteArray): Map<String, ByteArray> {
    val salida = HashMap<String, ByteArray>()
    var total = 0L
    var entradas = 0
    try {
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val e = zip.nextEntry ?: break
                if (++entradas > 1_000) throw ErrorImportacion("El Excel contiene demasiados archivos internos y no se puede procesar con seguridad.")
                val nombre = e.name
                val relevante = nombre == "xl/workbook.xml" || nombre == "xl/_rels/workbook.xml.rels" || nombre == "xl/sharedStrings.xml" || Regex("^xl/worksheets/[^/]+\\.xml$").matches(nombre)
                if (!relevante) continue
                val b = java.io.ByteArrayOutputStream()
                val buf = ByteArray(16 * 1024)
                while (true) {
                    val n = zip.read(buf); if (n < 0) break
                    total += n
                    if (b.size() + n > MAX_ENTRADA || total > MAX_TOTAL) throw ErrorImportacion("El Excel se expande demasiado al abrirlo. Guarda solo la hoja de movimientos o expórtalo como CSV.")
                    b.write(buf, 0, n)
                }
                salida[nombre] = b.toByteArray()
            }
        }
    } catch (e: ErrorImportacion) { throw e } catch (_: Exception) {
        throw ErrorImportacion("El archivo Excel está dañado, protegido con contraseña o no es un .xlsx válido.")
    }
    if (salida.isEmpty()) throw ErrorImportacion("El archivo Excel está dañado, protegido con contraseña o no es un .xlsx válido.")
    return salida
}

private fun xml(archivos: Map<String, ByteArray>, nombre: String): Document {
    val contenido = archivos[nombre] ?: throw ErrorImportacion("Este Excel no contiene una hoja que podamos leer. Guárdalo de nuevo como .xlsx o CSV.")
    val f = DocumentBuilderFactory.newInstance()
    // Sin entidades externas ni DTD: el XML viene de un archivo que no controlamos.
    runCatching { f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true) }
    runCatching { f.isExpandEntityReferences = false }
    return f.newDocumentBuilder().parse(ByteArrayInputStream(contenido))
}

private fun Document.todos(etiqueta: String): List<Element> = getElementsByTagName(etiqueta).let { l -> (0 until l.length).map { l.item(it) as Element } }
private fun Element.todos(etiqueta: String): List<Element> = getElementsByTagName(etiqueta).let { l -> (0 until l.length).map { l.item(it) as Element } }

/** Origen: `leerXlsx`. Primera hoja del libro; cadenas compartidas y texto en la propia celda; números como número. */
fun leerXlsx(bytes: ByteArray): List<List<Any?>> {
    val archivos = entradasXlsx(bytes)
    val compartidas = if (archivos.containsKey("xl/sharedStrings.xml")) xml(archivos, "xl/sharedStrings.xml").todos("si").map { si -> si.todos("t").joinToString("") { it.textContent.orEmpty() } } else emptyList()
    val libro = xml(archivos, "xl/workbook.xml")
    val hoja = libro.todos("sheet").firstOrNull() ?: throw ErrorImportacion("El Excel no tiene hojas con datos.")
    val rels = xml(archivos, "xl/_rels/workbook.xml.rels")
    val id = hoja.getAttribute("r:id")
    val ruta = rels.todos("Relationship").firstOrNull { it.getAttribute("Id") == id }?.getAttribute("Target")?.takeIf { it.isNotEmpty() } ?: "worksheets/sheet1.xml"
    val rutaHoja = if (ruta.startsWith("/")) ruta.drop(1) else "xl/${ruta.removePrefix("./")}"
    return xml(archivos, rutaHoja).todos("row").map { fila ->
        val resultado = mutableListOf<Any?>()
        for (c in fila.todos("c")) {
            val letras = Regex("^[A-Z]+").find(c.getAttribute("r"))?.value.orEmpty()
            var columna = 0
            for (l in letras) columna = columna * 26 + (l.code - 64)
            columna--
            if (columna < 0) continue
            val v = c.todos("v").firstOrNull()?.textContent.orEmpty()
            val t = c.getAttribute("t")
            val valor: Any? = when {
                t == "s" -> compartidas.getOrNull(v.toIntOrNull() ?: -1).orEmpty()
                t == "inlineStr" -> c.todos("t").joinToString("") { it.textContent.orEmpty() }
                v.isNotEmpty() && v.toDoubleOrNull()?.let { !it.isNaN() && !it.isInfinite() } == true -> v.toDouble()
                else -> v
            }
            while (resultado.size <= columna) resultado.add(null)
            resultado[columna] = valor
        }
        resultado
    }
}

/** Origen: `leerArchivoTabular` (la elección entre CSV y Excel la hace quien llama, por el nombre). */
fun leerCsv(bytes: ByteArray): AnalisisResultado = analizarFilas(csvComoFilas(String(bytes, Charsets.UTF_8).removePrefix("﻿")))
fun leerExcel(bytes: ByteArray): AnalisisResultado = analizarFilas(leerXlsx(bytes))

private val INGRESO_OCR = Regex("\\b(abono|ingreso|deposito|consignacion|transferencia recibida)\\b", RegexOption.IGNORE_CASE)
private val FECHA_OCR = Regex("\\b(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4})\\b")
private val MONTO_OCR = Regex("(?:COP\\s*)?\\$?\\s*-?\\d[\\d.,]*")

/**
 * Origen: `analizarTextoOCR`. De cada línea con fecha y UN solo número saca fecha, detalle y monto; con dos números
 * (saldo corrido, cuota) no se arriesga: sin los límites visuales de las columnas, adivinar podría torcer el libro.
 * Todo queda con confianza «media» para que la persona lo confirme antes de importar.
 */
fun analizarTextoOCR(contenido: String): AnalisisResultado {
    val filas = contenido.split(Regex("\\r?\\n")).map { it.trim() }.filter { it.isNotEmpty() }.mapNotNull { linea ->
        val fecha = FECHA_OCR.find(linea)?.value ?: return@mapNotNull null
        val resto = linea.replaceFirst(fecha, "")
        val montos = MONTO_OCR.findAll(resto).map { it.value }.toList()
        if (montos.size != 1) return@mapNotNull null
        val monto = montoImportado(montos.last()) ?: return@mapNotNull null
        val descripcion = resto.replaceFirst(montos.last(), "").replace(Regex("\\s+"), " ").trim()
        if (monto == 0L || descripcion.isEmpty()) return@mapNotNull null
        val ingreso = INGRESO_OCR.containsMatchIn(linea)
        listOf<Any?>(fecha, descripcion, if (ingreso) monto.toString() else "", if (ingreso) "" else monto.toString())
    }
    if (filas.isEmpty()) throw ErrorImportacion("No logramos reconocer filas con fecha, detalle y valor en la imagen. Prueba una foto nítida o sube el extracto como PDF o CSV.")
    val r = analizarFilas(listOf(listOf<Any?>("Fecha", "Descripción", "Crédito", "Débito")) + filas)
    return r.copy(
        movimientos = r.movimientos.map { it.copy(confianza = "media") },
        advertencias = listOf("El reconocimiento de la foto puede confundir cifras; revisa cada movimiento antes de confirmarlo.") + r.advertencias,
    )
}
