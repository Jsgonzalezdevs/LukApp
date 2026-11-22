package app.lukapp.ui.mas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteCuenta
import app.lukapp.datos.Preferencias
import app.lukapp.dominio.EstadoPlan
import app.lukapp.dominio.PlanBeneficios
import app.lukapp.dominio.RegaloPremium
import app.lukapp.sesion.ServicioSesion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Estado de Cuenta (CuentaView.tsx): apodo, plan y los dos cambios delicados, contraseña y eliminación. */
class ModeloCuenta(private val cliente: ClienteCuenta, private val sesion: ServicioSesion, private val preferencias: Preferencias) : ViewModel() {
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

    private val _regalo = MutableStateFlow<RegaloPremium?>(null)
    /** El regalo de Premium que falta celebrar (RegaloPremium.tsx). null si no hay o ya se vio. */
    val regalo: StateFlow<RegaloPremium?> = _regalo.asStateFlow()
    private var regaloConsultado = false
    private var regaloMarcado: Long? = null

    /** Una sola consulta por arranque: la celebración no se repite al volver de segundo plano. */
    fun consultarRegalo() {
        if (regaloConsultado) return
        val usuario = sesion.idUsuario ?: return
        regaloConsultado = true
        viewModelScope.launch {
            val pendiente = cliente.regaloPremium() ?: return@launch
            if (!preferencias.regaloPremiumVisto(usuario, pendiente.id)) _regalo.value = pendiente
        }
    }

    /**
     * Se marca como visto al aparecer, no al cerrar: si la persona cierra la app con el
     * pop-up abierto, ya lo vio y no debe repetirse. El teléfono también lo recuerda,
     * por si la marca del servidor no alcanzó a guardarse.
     */
    fun regaloMostrado(regalo: RegaloPremium) {
        if (regaloMarcado == regalo.id) return
        regaloMarcado = regalo.id
        val usuario = sesion.idUsuario ?: return
        viewModelScope.launch {
            preferencias.recordarRegaloPremiumVisto(usuario, regalo.id)
            cliente.marcarRegaloVisto(regalo.id)
        }
    }

    fun cerrarRegalo() { _regalo.value = null }

    /** La página «Beneficios de Premium» (BeneficiosPremium.tsx), encima de todo. */
    val beneficiosAbiertos = MutableStateFlow(false)
    private val _beneficios = MutableStateFlow<EstadoBeneficios>(EstadoBeneficios.Cargando)
    val beneficios: StateFlow<EstadoBeneficios> = _beneficios.asStateFlow()

    fun abrirBeneficios() {
        beneficiosAbiertos.value = true
        cargarBeneficios()
    }

    fun cerrarBeneficios() { beneficiosAbiertos.value = false }

    /** Se consulta cada vez que se abre: el regalo pudo llegar hace un momento y los cupos cambian. */
    fun cargarBeneficios() {
        _beneficios.value = EstadoBeneficios.Cargando
        viewModelScope.launch {
            _beneficios.value = runCatching { cliente.planBeneficios() }
                .fold(onSuccess = { EstadoBeneficios.Listo(it) }, onFailure = { EstadoBeneficios.Error })
        }
    }

    /** Devuelve el error para enseñarlo, o null si se guardó. */
    suspend fun cambiarContrasena(nueva: String): String? = sesion.cambiarContrasena(nueva)

    /** Devuelve el error, o null si la cuenta quedó eliminada (la pantalla entonces cierra la sesión). */
    suspend fun eliminarCuenta(): String? = cliente.eliminar()
}

sealed interface EstadoBeneficios {
    data object Cargando : EstadoBeneficios
    data object Error : EstadoBeneficios
    data class Listo(val plan: PlanBeneficios) : EstadoBeneficios
}
