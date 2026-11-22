package app.lukapp.ui.acceso

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.Preferencias
import app.lukapp.seguridad.AccesoGoogle
import app.lukapp.sesion.ServicioSesion
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ModoAcceso { ENTRAR, REGISTRARSE, RECUPERAR, ACTUALIZAR }
enum class EstadoApodo { VACIO, CORTO, COMPROBANDO, LIBRE, COGIDO }

data class EstadoAcceso(
    val modo: ModoAcceso = ModoAcceso.ENTRAR,
    val identidad: String = "",
    val contrasena: String = "",
    val usuario: String = "",
    val verContrasena: Boolean = false,
    val recordarme: Boolean = true,
    val apodo: EstadoApodo = EstadoApodo.VACIO,
    val ocupado: Boolean = false,
    val abriendoGoogle: Boolean = false,
    val error: String? = null,
    val enviado: Boolean = false,
    val recuperadoEnviado: Boolean = false,
    val contrasenaActualizada: Boolean = false,
)

/** La lógica de LoginPanel.tsx: modos, apodo en vivo, recordarme y envío. */
class ModeloAcceso(
    private val sesion: ServicioSesion,
    private val google: AccesoGoogle,
    private val preferencias: Preferencias,
) : ViewModel() {

    private val _estado = MutableStateFlow(EstadoAcceso())
    val estado: StateFlow<EstadoAcceso> = _estado.asStateFlow()
    private var comprobacion: Job? = null

    init {
        viewModelScope.launch {
            val recordar = preferencias.recordarUsuario.first()
            val correo = preferencias.correoGuardado.first()
            _estado.update { it.copy(recordarme = recordar, identidad = correo) }
        }
        viewModelScope.launch {
            sesion.enRecuperacion.collect { if (it) cambiarModo(ModoAcceso.ACTUALIZAR) }
        }
    }

    fun cambiarModo(modo: ModoAcceso) = _estado.update {
        it.copy(modo = modo, error = null, enviado = false, recuperadoEnviado = false, contrasenaActualizada = false)
    }

    fun identidad(v: String) = _estado.update { it.copy(identidad = v) }
    fun contrasena(v: String) = _estado.update { it.copy(contrasena = v) }
    fun verContrasena() = _estado.update { it.copy(verContrasena = !it.verContrasena) }
    fun recordarme(v: Boolean) = _estado.update { it.copy(recordarme = v) }

    fun usuario(v: String) {
        _estado.update { it.copy(usuario = v) }
        comprobacion?.cancel()
        val limpio = v.trim()
        when {
            limpio.isEmpty() -> _estado.update { it.copy(apodo = EstadoApodo.VACIO) }
            limpio.length < APODO_MINIMO -> _estado.update { it.copy(apodo = EstadoApodo.CORTO) }
            else -> {
                _estado.update { it.copy(apodo = EstadoApodo.COMPROBANDO) }
                // Mismo antirrebote de 450 ms: no consultar la base por cada letra.
                comprobacion = viewModelScope.launch {
                    delay(450)
                    val libre = sesion.usuarioDisponible(limpio)
                    _estado.update { it.copy(apodo = if (libre) EstadoApodo.LIBRE else EstadoApodo.COGIDO) }
                }
            }
        }
    }

    fun listo(e: EstadoAcceso = _estado.value): Boolean = when (e.modo) {
        ModoAcceso.ENTRAR -> e.identidad.trim().isNotEmpty() && e.contrasena.isNotEmpty()
        ModoAcceso.REGISTRARSE -> correoValido(e.identidad) && errorContrasena(e) == null && e.apodo == EstadoApodo.LIBRE && !e.ocupado
        ModoAcceso.RECUPERAR -> correoValido(e.identidad) && !e.ocupado
        ModoAcceso.ACTUALIZAR -> errorContrasena(e) == null && !e.ocupado
    }

    fun enviar() {
        val e = _estado.value
        if (!listo(e)) return
        viewModelScope.launch {
            _estado.update { it.copy(ocupado = true, error = null) }
            when (e.modo) {
                ModoAcceso.ENTRAR -> {
                    if (e.recordarme && e.identidad.isNotBlank()) {
                        preferencias.guardar(Preferencias.Claves.CORREO_GUARDADO, e.identidad.trim())
                        preferencias.guardar(Preferencias.Claves.RECORDAR_USUARIO, true)
                    } else {
                        preferencias.guardar(Preferencias.Claves.CORREO_GUARDADO, null)
                        preferencias.guardar(Preferencias.Claves.RECORDAR_USUARIO, false)
                    }
                    val error = sesion.entrar(e.identidad.trim(), e.contrasena)
                    _estado.update { it.copy(ocupado = false, error = error) }
                }
                ModoAcceso.REGISTRARSE -> {
                    val error = sesion.registrarse(e.identidad.trim(), e.contrasena, e.usuario.trim())
                    _estado.update { it.copy(ocupado = false, error = error, enviado = true) }
                }
                ModoAcceso.RECUPERAR -> {
                    val error = sesion.recuperarContrasena(e.identidad.trim())
                    _estado.update { it.copy(ocupado = false, error = error, recuperadoEnviado = error == null) }
                }
                ModoAcceso.ACTUALIZAR -> {
                    val error = sesion.actualizarContrasena(e.contrasena)
                    _estado.update { it.copy(ocupado = false, error = error, contrasenaActualizada = error == null) }
                }
            }
        }
    }

    fun entrarConGoogle(contexto: Context) {
        viewModelScope.launch {
            _estado.update { it.copy(abriendoGoogle = true, error = null) }
            val resultado = google.entrar(contexto)
            _estado.update {
                it.copy(
                    abriendoGoogle = false,
                    error = (resultado as? AccesoGoogle.Resultado.Error)?.mensaje,
                )
            }
        }
    }

    fun terminarRecuperacion() {
        sesion.finalizarRecuperacion()
        cambiarModo(ModoAcceso.ENTRAR)
    }

    companion object {
        const val APODO_MINIMO = 3
        private val CORREO = Regex("""^[^\s@]+@[^\s@]+\.[^\s@]+$""")
        fun correoValido(texto: String) = CORREO.matches(texto.trim())

        fun errorContrasena(e: EstadoAcceso): String? = when (e.modo) {
            ModoAcceso.REGISTRARSE -> app.lukapp.dominio.validarContrasenaSegura(e.contrasena, listOf(e.usuario, e.identidad))
            ModoAcceso.ACTUALIZAR -> app.lukapp.dominio.validarContrasenaSegura(e.contrasena)
            else -> null
        }
    }
}
