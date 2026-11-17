package app.lukapp.ui.asesor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteAsesor
import app.lukapp.datos.TurnoChat
import app.lukapp.dominio.ConexionIA
import app.lukapp.dominio.elegirIndiceImagenLuki
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MensajeAsesor(val id: String, val esUsuario: Boolean, val texto: String)

/**
 * Estado del chat del Asesor. Pendiente (no se simula): motor local de respaldo,
 * historial y memoria persistidos, propuestas accionables y dictado.
 */
class ModeloAsesor(private val cliente: ClienteAsesor) : ViewModel() {
    val mensajes = MutableStateFlow<List<MensajeAsesor>>(emptyList())
    val pensando = MutableStateFlow(false)
    val conexion = MutableStateFlow(ConexionIA.DESPERTANDO)
    val error = MutableStateFlow<String?>(null)
    /** Pose de Luki del saludo, elegida una vez por apertura de la app (en la web, por sesión). */
    val poseLuki = elegirIndiceImagenLuki(Math.random())

    private var consulta: Job? = null
    private var ultimoTexto: String? = null
    private var contador = 0
    private fun nuevoId() = "msg-${System.currentTimeMillis()}-${contador++}"

    init { verificar() }

    fun verificar() {
        conexion.value = ConexionIA.DESPERTANDO
        viewModelScope.launch { conexion.value = if (cliente.disponible()) ConexionIA.EN_LINEA else ConexionIA.LOCAL }
    }

    fun enviar(texto: String) {
        val t = texto.trim()
        if (t.isEmpty() || pensando.value) return
        mensajes.update { it + MensajeAsesor(nuevoId(), true, t) }
        preguntar(t)
    }

    /** «Reintentar con IA»: vuelve a preguntar sin repetir el mensaje del usuario. */
    fun reintentar() { ultimoTexto?.let { if (!pensando.value) preguntar(it) } }

    private fun preguntar(t: String) {
        ultimoTexto = t
        error.value = null
        pensando.value = true
        val historial = mensajes.value.dropLast(0).map { TurnoChat(it.id, if (it.esUsuario) "user" else "bot", it.texto) }
        consulta = viewModelScope.launch {
            try {
                when (val r = cliente.consultar(t, historial, "q_${System.currentTimeMillis()}_${contador++}")) {
                    is ClienteAsesor.Respuesta.Texto -> {
                        mensajes.update { it + MensajeAsesor(nuevoId(), false, r.texto) }
                        conexion.value = ConexionIA.EN_LINEA
                    }
                    is ClienteAsesor.Respuesta.Error -> error.value = r.mensaje
                }
            } finally { pensando.value = false }
        }
    }

    fun nuevaConversacion() {
        consulta?.cancel()
        mensajes.value = emptyList(); error.value = null; ultimoTexto = null; pensando.value = false
    }
}
