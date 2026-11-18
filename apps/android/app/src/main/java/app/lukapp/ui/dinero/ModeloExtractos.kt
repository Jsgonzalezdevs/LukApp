package app.lukapp.ui.dinero

import android.app.Application
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteExtractos
import app.lukapp.dominio.AnalisisResultado
import app.lukapp.dominio.ErrorImportacion
import app.lukapp.dominio.MAX_BYTES_EXTRACTO
import app.lukapp.dominio.RespuestaExtracto
import app.lukapp.dominio.analizarTextoOCR
import app.lukapp.dominio.leerCsv
import app.lukapp.dominio.leerExcel
import app.lukapp.nativo.LecturaImagen
import app.lukapp.nativo.LectorImagen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class FaseTrabajo { SUBIENDO, ESPERANDO_CONTRASENA, LISTO, ERROR }

/** De qué manera se lee: el PDF lo lee el servidor; la foto, el Excel y el CSV se leen en el teléfono. */
enum class TipoArchivo { PDF, IMAGEN, EXCEL, CSV }

/** Un extracto en proceso. Se guardan los bytes (o el `uri` de una foto) para reintentar sin volver a elegir el archivo. */
class TrabajoExtracto(
    val id: String,
    val nombre: String,
    val bytes: ByteArray?,
    val fase: FaseTrabajo,
    val inicio: Long,
    val resultado: AnalisisResultado? = null,
    val mensaje: String? = null,
    val tipo: TipoArchivo = TipoArchivo.PDF,
    val uri: Uri? = null,
) {
    fun con(fase: FaseTrabajo, inicio: Long = this.inicio, resultado: AnalisisResultado? = null, mensaje: String? = null) =
        TrabajoExtracto(id, nombre, bytes, fase, inicio, resultado, mensaje, tipo, uri)
    val reintentable get() = bytes != null || uri != null
}

/**
 * Estado de Importar extractos (useAnalista.ts). Cada archivo es un trabajo propio y los trabajos son independientes:
 * uno que falla no frena a los demás. PDF → servidor; foto (ML Kit), Excel .xlsx y CSV → en el teléfono, sin enviarlos.
 */
class ModeloExtractos(aplicacion: Application, private val cliente: ClienteExtractos) : AndroidViewModel(aplicacion) {
    private val _trabajos = MutableStateFlow<List<TrabajoExtracto>>(emptyList())
    val trabajos: StateFlow<List<TrabajoExtracto>> = _trabajos.asStateFlow()

    private fun cambiar(id: String, f: (TrabajoExtracto) -> TrabajoExtracto) = _trabajos.update { l -> l.map { if (it.id == id) f(it) else it } }

    fun elegir(uris: List<Uri>) {
        for (uri in uris) viewModelScope.launch {
            val id = UUID.randomUUID().toString()
            val ahora = System.currentTimeMillis()
            val leido = withContext(Dispatchers.IO) { leer(uri) }
            val t = when (leido) {
                is Leido.Error -> TrabajoExtracto(id, leido.nombre, null, FaseTrabajo.ERROR, ahora, mensaje = leido.mensaje)
                is Leido.Archivo -> TrabajoExtracto(id, leido.nombre, leido.bytes, FaseTrabajo.SUBIENDO, ahora, tipo = leido.tipo, uri = uri)
            }
            _trabajos.update { listOf(t) + it }
            if (leido is Leido.Archivo) procesar(id, leido.tipo, leido.bytes, uri, null)
        }
    }

    private sealed interface Leido {
        data class Archivo(val nombre: String, val tipo: TipoArchivo, val bytes: ByteArray) : Leido
        data class Error(val nombre: String, val mensaje: String) : Leido
    }

    /** Valida antes de leer entero: un archivo malo de un lote muestra su error al instante. */
    private fun leer(uri: Uri): Leido {
        val cr = getApplication<Application>().contentResolver
        var nombre = "archivo"
        var tamano = -1L
        runCatching {
            cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) { c.getString(0)?.let { nombre = it }; if (!c.isNull(1)) tamano = c.getLong(1) }
            }
        }
        val mime = cr.getType(uri).orEmpty()
        val n = nombre.lowercase()
        val tipo = when {
            mime == "application/pdf" || n.endsWith(".pdf") -> TipoArchivo.PDF
            Regex("^image/(jpeg|png|webp|tiff)$").matches(mime) || Regex(".*\\.(jpe?g|png|webp|tiff?)$").matches(n) -> TipoArchivo.IMAGEN
            n.endsWith(".xlsx") || mime.contains("spreadsheetml") -> TipoArchivo.EXCEL
            n.endsWith(".csv") || mime == "text/csv" || mime == "text/comma-separated-values" -> TipoArchivo.CSV
            else -> return Leido.Error(nombre, "\"$nombre\" no es compatible. Usa PDF, imagen, Excel .xlsx o CSV.")
        }
        if (tamano > MAX_BYTES_EXTRACTO) return Leido.Error(nombre, "\"$nombre\" pesa ${"%.1f".format(java.util.Locale.US, tamano / 1024.0 / 1024.0)} MB y el límite es 4 MB.")
        return try {
            val bytes = cr.openInputStream(uri)?.use { it.readNBytes(MAX_BYTES_EXTRACTO + 1) } ?: return Leido.Error(nombre, "No se pudo leer el archivo.")
            if (bytes.size > MAX_BYTES_EXTRACTO) Leido.Error(nombre, "\"$nombre\" pesa más de 4 MB, que es el límite.") else Leido.Archivo(nombre, tipo, bytes)
        } catch (_: Exception) { Leido.Error(nombre, "No se pudo leer el archivo.") }
    }

    private fun procesar(id: String, tipo: TipoArchivo, bytes: ByteArray?, uri: Uri?, contrasena: String?) {
        viewModelScope.launch {
            when (tipo) {
                TipoArchivo.PDF -> when (val r = cliente.analizar(bytes ?: return@launch, contrasena)) {
                    is RespuestaExtracto.Listo -> cambiar(id) { it.con(FaseTrabajo.LISTO, resultado = r.resultado) }
                    is RespuestaExtracto.Error -> cambiar(id) { it.con(if (r.pideContrasena) FaseTrabajo.ESPERANDO_CONTRASENA else FaseTrabajo.ERROR, mensaje = r.mensaje) }
                }
                else -> {
                    val r = withContext(Dispatchers.Default) { leerLocal(tipo, bytes, uri) }
                    cambiar(id) { if (r.isSuccess) it.con(FaseTrabajo.LISTO, resultado = r.getOrNull()) else it.con(FaseTrabajo.ERROR, mensaje = r.exceptionOrNull()?.message) }
                }
            }
        }
    }

    /** Nada sale del teléfono. Un fallo inesperado se dice con palabras de persona, no con el texto de la excepción. */
    private suspend fun leerLocal(tipo: TipoArchivo, bytes: ByteArray?, uri: Uri?): Result<AnalisisResultado> = try {
        Result.success(when (tipo) {
            TipoArchivo.CSV -> leerCsv(bytes ?: throw ErrorImportacion("No se pudo leer el archivo."))
            TipoArchivo.EXCEL -> leerExcel(bytes ?: throw ErrorImportacion("No se pudo leer el archivo."))
            TipoArchivo.IMAGEN -> when (val l = LectorImagen.leer(getApplication(), uri ?: throw ErrorImportacion("No se pudo leer la imagen."), conLineas = true)) {
                is LecturaImagen.Texto -> analizarTextoOCR(l.texto)
                LecturaImagen.SinTexto -> throw ErrorImportacion("No logramos reconocer texto en la imagen. Prueba una foto nítida o sube el extracto como PDF o CSV.")
                LecturaImagen.Fallo -> throw ErrorImportacion("No pudimos leer la imagen. Prueba con otra foto.")
            }
            TipoArchivo.PDF -> throw ErrorImportacion("Un PDF se lee en el servidor.")
        })
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: ErrorImportacion) { Result.failure(e) } catch (_: Exception) {
        Result.failure(ErrorImportacion("No pudimos leer el archivo. Prueba exportarlo de nuevo."))
    }

    private fun reiniciar(id: String, contrasena: String?) {
        val t = _trabajos.value.firstOrNull { it.id == id } ?: return
        if (!t.reintentable) return
        cambiar(id) { it.con(FaseTrabajo.SUBIENDO, inicio = System.currentTimeMillis()) }
        procesar(id, t.tipo, t.bytes, t.uri, contrasena)
    }

    fun reintentar(id: String) = reiniciar(id, null)

    /** La contraseña llega, se manda y no se guarda: ni en el trabajo ni para otros extractos. */
    fun desbloquear(id: String, contrasena: String) { if (contrasena.isNotEmpty()) reiniciar(id, contrasena) }

    fun quitar(id: String) = _trabajos.update { l -> l.filter { it.id != id } }
}
