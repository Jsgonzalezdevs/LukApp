package app.lukapp.ui.dinero

import android.app.Application
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteExtractos
import app.lukapp.dominio.AnalisisResultado
import app.lukapp.dominio.MAX_BYTES_EXTRACTO
import app.lukapp.dominio.RespuestaExtracto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class FaseTrabajo { SUBIENDO, ESPERANDO_CONTRASENA, LISTO, ERROR }

/** Un extracto en proceso. Se guardan los bytes para poder reintentar o desbloquear sin volver a elegir el archivo. */
class TrabajoExtracto(
    val id: String,
    val nombre: String,
    val bytes: ByteArray?,
    val fase: FaseTrabajo,
    val inicio: Long,
    val resultado: AnalisisResultado? = null,
    val mensaje: String? = null,
)

/**
 * Estado de Importar extractos (useAnalista.ts). Cada archivo es un trabajo propio y los trabajos son independientes:
 * uno que falla no frena a los demás. Por ahora solo se leen PDF; las fotos, Excel y CSV de la web aún no existen aquí.
 */
class ModeloExtractos(aplicacion: Application, private val cliente: ClienteExtractos) : AndroidViewModel(aplicacion) {
    private val _trabajos = MutableStateFlow<List<TrabajoExtracto>>(emptyList())
    val trabajos: StateFlow<List<TrabajoExtracto>> = _trabajos.asStateFlow()

    private fun cambiar(id: String, f: (TrabajoExtracto) -> TrabajoExtracto) = _trabajos.update { l -> l.map { if (it.id == id) f(it) else it } }

    fun elegir(uris: List<Uri>) {
        for (uri in uris) viewModelScope.launch {
            val (nombre, bytes, error) = withContext(Dispatchers.IO) { leer(uri) }
            val id = UUID.randomUUID().toString()
            val t = if (bytes == null) TrabajoExtracto(id, nombre, null, FaseTrabajo.ERROR, System.currentTimeMillis(), mensaje = error)
            else TrabajoExtracto(id, nombre, bytes, FaseTrabajo.SUBIENDO, System.currentTimeMillis())
            _trabajos.update { listOf(t) + it }
            if (bytes != null) procesar(id, bytes, null)
        }
    }

    /** Valida antes de leer entero: un archivo malo de un lote muestra su error al instante. */
    private fun leer(uri: Uri): Triple<String, ByteArray?, String?> {
        val cr = getApplication<Application>().contentResolver
        var nombre = "extracto.pdf"
        var tamano = -1L
        runCatching {
            cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) { c.getString(0)?.let { nombre = it }; if (!c.isNull(1)) tamano = c.getLong(1) }
            }
        }
        val tipo = cr.getType(uri).orEmpty()
        if (tipo != "application/pdf" && !nombre.lowercase().endsWith(".pdf")) return Triple(nombre, null, "\"$nombre\" no es un PDF. En Android, por ahora, solo se leen PDF; las fotos, Excel y CSV siguen en la web.")
        if (tamano > MAX_BYTES_EXTRACTO) return Triple(nombre, null, "\"$nombre\" pesa ${"%.1f".format(java.util.Locale.US, tamano / 1024.0 / 1024.0)} MB y el límite es 4 MB.")
        return try {
            val bytes = cr.openInputStream(uri)?.use { it.readNBytes(MAX_BYTES_EXTRACTO + 1) } ?: return Triple(nombre, null, "No se pudo leer el archivo.")
            if (bytes.size > MAX_BYTES_EXTRACTO) Triple(nombre, null, "\"$nombre\" pesa más de 4 MB, que es el límite.") else Triple(nombre, bytes, null)
        } catch (_: Exception) { Triple(nombre, null, "No se pudo leer el archivo.") }
    }

    private fun procesar(id: String, bytes: ByteArray, contrasena: String?) {
        viewModelScope.launch {
            when (val r = cliente.analizar(bytes, contrasena)) {
                is RespuestaExtracto.Listo -> cambiar(id) { TrabajoExtracto(it.id, it.nombre, it.bytes, FaseTrabajo.LISTO, it.inicio, r.resultado) }
                is RespuestaExtracto.Error -> cambiar(id) {
                    TrabajoExtracto(it.id, it.nombre, it.bytes, if (r.pideContrasena) FaseTrabajo.ESPERANDO_CONTRASENA else FaseTrabajo.ERROR, it.inicio, null, r.mensaje)
                }
            }
        }
    }

    private fun reiniciar(id: String, contrasena: String?) {
        val t = _trabajos.value.firstOrNull { it.id == id } ?: return
        val bytes = t.bytes ?: return
        cambiar(id) { TrabajoExtracto(it.id, it.nombre, it.bytes, FaseTrabajo.SUBIENDO, System.currentTimeMillis()) }
        procesar(id, bytes, contrasena)
    }

    fun reintentar(id: String) = reiniciar(id, null)

    /** La contraseña llega, se manda y no se guarda: ni en el trabajo ni para otros extractos. */
    fun desbloquear(id: String, contrasena: String) { if (contrasena.isNotEmpty()) reiniciar(id, contrasena) }

    fun quitar(id: String) = _trabajos.update { l -> l.filter { it.id != id } }
}
