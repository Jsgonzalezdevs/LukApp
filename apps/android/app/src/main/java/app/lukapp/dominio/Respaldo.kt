package app.lukapp.dominio

import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.put

/**
 * Origen: `lib/respaldo.ts`. Sacar los datos y volverlos a meter, con el mismo formato que la web
 * (`{version, generado, datos}` con las nueve listas en camelCase): un respaldo de una app se restaura en la otra.
 */

/** Sube cuando el formato deja de poder leerse tal cual. */
const val VERSION_RESPALDO = 1

/**
 * Al escribir van TODOS los campos, también los nulos: la web distingue `null` de ausente
 * (`archivedAt !== null`) y un campo que falte la haría tratar como archivado lo que no lo está.
 */
private val escritor = Json { prettyPrint = true; prettyPrintIndent = "  "; encodeDefaults = true; explicitNulls = true }

/** Al leer se acepta lo que la web omita (campos opcionales sin valor) y lo que esta versión no conoce. */
private val lector = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

/** Origen: `armarRespaldo` + `JSON.stringify(…, null, 2)`. */
fun armarRespaldoJson(libro: Libro, generado: String): String {
    val datos = escritor.encodeToJsonElement(Libro.serializer(), libro)
    val raiz = buildJsonObject {
        put("version", VERSION_RESPALDO)
        put("generado", generado)
        put("datos", datos)
    }
    return escritor.encodeToString(JsonObject.serializer(), raiz)
}

/** Origen: `ResultadoLectura`. `error` se lee en pantalla; `resumen` dice qué trae ANTES de reemplazar nada. */
data class ResultadoLectura(val ok: Boolean, val libro: Libro?, val error: String?, val resumen: String?)

private fun fallo(error: String) = ResultadoLectura(false, null, error, null)

private val CONTADORES = listOf<Triple<(Libro) -> Int, String, String>>(
    Triple({ it.transacciones.size }, "movimiento", "movimientos"),
    Triple({ it.cajitas.size }, "cuenta o cajita", "cuentas y cajitas"),
    Triple({ it.movimientos.size }, "ajuste", "ajustes"),
    Triple({ it.metas.size }, "meta", "metas"),
    Triple({ it.categorias.size }, "categoría propia", "categorías propias"),
    Triple({ it.contactos.size }, "contacto", "contactos"),
    Triple({ it.presupuestos.size }, "presupuesto", "presupuestos"),
    Triple({ it.recurrentes.size }, "recurrente", "recurrentes"),
)

/** Origen: `resumirRespaldo`. «34 movimientos · 3 cuentas y cajitas · 1 meta». */
fun resumirRespaldo(libro: Libro): String {
    val partes = CONTADORES.mapNotNull { (cuenta, singular, plural) -> cuenta(libro).let { n -> if (n == 0) null else "$n ${if (n == 1) singular else plural}" } }
    return if (partes.isEmpty()) "Está vacío" else partes.joinToString(" · ")
}

/**
 * Origen: `leerRespaldo`. Sin confiar en nada de lo que trae: un JSON malo aquí es alguien a punto de reemplazar
 * su contabilidad con basura. Cada lista se toma solo si de verdad es una lista y lo que falte entra vacío.
 */
fun leerRespaldo(texto: String): ResultadoLectura {
    val crudo: JsonElement = try { lector.parseToJsonElement(texto) } catch (e: Exception) {
        return fallo("Ese archivo no es un respaldo de la app: no se pudo leer como JSON.")
    }
    if (crudo !is JsonObject) return fallo("El archivo está vacío o no tiene datos.")
    val version = (crudo["version"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
    val datos = crudo["datos"]
    if (version == null || datos == null || datos is JsonNull) return fallo("Falta la información que identifica al archivo como un respaldo de esta app.")
    // Un respaldo del futuro puede traer campos que esta versión no sabe leer: restaurarlo a medias sería peor que rechazarlo.
    if (version > VERSION_RESPALDO) {
        val v = if (version == Math.floor(version)) version.toLong().toString() else version.toString()
        return fallo("Ese respaldo es de una versión más nueva ($v) que esta app. Actualiza la app antes de restaurarlo.")
    }
    val objeto = datos as? JsonObject ?: JsonObject(emptyMap())
    fun <T> lista(clave: String, s: kotlinx.serialization.KSerializer<T>): List<T> =
        (objeto[clave] as? JsonArray)?.let { lector.decodeFromJsonElement(ListSerializer(s), it) } ?: emptyList()
    val libro = try {
        Libro(
            transacciones = lista("transacciones", Transaccion.serializer()),
            cajitas = lista("cajitas", Cajita.serializer()),
            movimientos = lista("cajitaMovimientos", CajitaMovimiento.serializer()),
            metas = lista("metas", Meta.serializer()),
            categorias = lista("categorias", CategoriaPersonal.serializer()),
            contactos = lista("contactos", Contacto.serializer()),
            presupuestos = lista("presupuestos", Presupuesto.serializer()),
            recurrentes = lista("recurrentes", Recurrente.serializer()),
            revisiones = lista("revisiones", RevisionDudosa.serializer()),
        )
    } catch (e: SerializationException) {
        return fallo("Ese archivo no es un respaldo de la app: alguna fila no tiene la forma esperada.")
    } catch (e: IllegalArgumentException) {
        return fallo("Ese archivo no es un respaldo de la app: alguna fila no tiene la forma esperada.")
    }
    return ResultadoLectura(true, libro, null, resumirRespaldo(libro))
}

/** Origen: `nombreDeArchivo`. Con fecha, para que dos respaldos no se pisen en la carpeta. */
fun nombreDeArchivoRespaldo(hoy: String): String = "finanzas-$hoy.json"

private fun escapar(valor: String): String = if (valor.any { it == '"' || it == '\n' || it == ';' || it == ',' }) "\"${valor.replace("\"", "\"\"")}\"" else valor

/**
 * Origen: `aCsv`. Separado por punto y coma: Excel en español toma la coma como decimal y dejaría todo en una
 * columna. Montos sin separadores ni símbolo, porque una hoja necesita un número.
 */
fun aCsv(libro: Libro, nombreDeCuenta: (String?) -> String): String =
    (listOf(listOf("Fecha", "Tipo", "Monto", "Categoría", "Descripción", "Cuenta", "Afecta saldo").joinToString(";")) +
        libro.transacciones.sortedBy { it.occurredOn }.map { tx ->
            listOf(tx.occurredOn, tx.kind, tx.amountCop.toString(), escapar(tx.category), escapar(tx.description), escapar(nombreDeCuenta(tx.cuentaId)), if (!tx.afectaSaldo) "No" else "Sí").joinToString(";")
        }).joinToString("\n")

/** Origen: `pesoAproximado`. */
fun pesoAproximado(texto: String): String {
    val kb = texto.length / 1024.0
    return if (kb < 1024) "${Math.round(kb)} KB" else "${java.math.BigDecimal(kb / 1024).setScale(1, java.math.RoundingMode.HALF_UP)} MB"
}
