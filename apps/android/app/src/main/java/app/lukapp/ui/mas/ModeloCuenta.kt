package app.lukapp.ui.mas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteCuenta
import app.lukapp.dominio.EstadoPlan
import app.lukapp.sesion.ServicioSesion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Estado de Cuenta (CuentaView.tsx): apodo, plan y los dos cambios delicados, contraseña y eliminación. */
class ModeloCuenta(private val cliente: ClienteCuenta, private val sesion: ServicioSesion) : ViewModel() {
    private val _apodo = MutableStateFlow<String?>(null)
    val apodo: StateFlow<String?> = _apodo.asStateFlow()
    private val _plan = MutableStateFlow<EstadoPlan?>(null)
    val plan: StateFlow<EstadoPlan?> = _plan.asStateFlow()
    private val _cargandoPlan = MutableStateFlow(false)
    val cargandoPlan: StateFlow<Boolean> = _cargandoPlan.asStateFlow()
    private val _errorPlan = MutableStateFlow<String?>(null)
    val errorPlan: StateFlow<String?> = _errorPlan.asStateFlow()

    val correo: String? get() = sesion.correo
    val idUsuario: String? get() = sesion.idUsuario

    fun cargar() {
        sesion.idUsuario?.let { id -> viewModelScope.launch { _apodo.value = cliente.apodo(id) } }
        cargarPlan()
    }

    fun cargarPlan() {
        _cargandoPlan.value = true
        _errorPlan.value = null
        viewModelScope.launch {
            runCatching { cliente.plan() }.onSuccess { _plan.value = it }.onFailure { _errorPlan.value = it.message ?: "No se pudo consultar tu plan." }
            _cargandoPlan.value = false
        }
    }

    /** Devuelve el error para enseñarlo, o null si se guardó. */
    suspend fun cambiarContrasena(nueva: String): String? = sesion.cambiarContrasena(nueva)

    /** Devuelve el error, o null si la cuenta quedó eliminada (la pantalla entonces cierra la sesión). */
    suspend fun eliminarCuenta(): String? = cliente.eliminar()
}
