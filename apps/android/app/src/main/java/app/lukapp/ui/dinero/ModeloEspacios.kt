package app.lukapp.ui.dinero

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteEspacios
import app.lukapp.dominio.EspacioCompartido
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Estado de Espacios compartidos. `espacios == null` es «Cargando…». Cada escritura recarga después, como la web:
 * lo que se ve es lo que el servidor confirmó. La web además escucha cambios en vivo; aquí se recarga al abrir y
 * después de cada acción.
 */
class ModeloEspacios(private val cliente: ClienteEspacios) : ViewModel() {
    private val _espacios = MutableStateFlow<List<EspacioCompartido>?>(null)
    val espacios: StateFlow<List<EspacioCompartido>?> = _espacios.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    private val _ocupado = MutableStateFlow(false)
    val ocupado: StateFlow<Boolean> = _ocupado.asStateFlow()

    fun limpiarError() { _error.value = null }

    fun cargar() {
        viewModelScope.launch { recargar() }
    }

    private suspend fun recargar() {
        runCatching { cliente.cargar() }.onSuccess { _espacios.value = it; _error.value = null }.onFailure { _error.value = it.message ?: "No se pudieron cargar tus espacios compartidos"; if (_espacios.value == null) _espacios.value = emptyList() }
    }

    /** Corre una escritura y recarga; devuelve si salió bien para que la pantalla cierre su formulario solo entonces. */
    private suspend fun <T> escribir(accion: suspend () -> T): T? {
        _ocupado.value = true
        _error.value = null
        val r = runCatching { accion() }.onFailure { _error.value = it.message ?: "No se pudo completar la acción" }.getOrNull()
        if (r != null) recargar()
        _ocupado.value = false
        return r
    }

    /** El id del espacio nuevo, o null si no se pudo. */
    suspend fun crearEspacio(nombre: String, icono: String): String? = if (nombre.isBlank()) null else escribir { cliente.crearEspacio(nombre, icono) }
    suspend fun agregarGasto(espacioId: String, descripcion: String, monto: Long, pagadoPorId: String): Boolean = escribir { cliente.agregarGasto(espacioId, descripcion, monto, pagadoPorId); true } == true
    suspend fun borrarGasto(id: String): Boolean = escribir { cliente.borrarGasto(id); true } == true
    suspend fun saldar(espacioId: String): Boolean = escribir { cliente.saldar(espacioId); true } == true
    suspend fun aceptar(token: String): Boolean = escribir { cliente.aceptarInvitacion(token); true } == true

    /** El token de la invitación nueva (no cambia lo que se ve, así que no recarga). */
    suspend fun invitar(espacioId: String): String? {
        _ocupado.value = true
        _error.value = null
        val t = runCatching { cliente.crearInvitacion(espacioId) }.onFailure { _error.value = it.message ?: "No se pudo crear la invitación" }.getOrNull()
        _ocupado.value = false
        return t
    }
}
