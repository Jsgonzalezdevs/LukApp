package app.lukapp.ui.asesor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteAsesor
import app.lukapp.datos.TurnoChat
import app.lukapp.dominio.AsesorContext
import app.lukapp.dominio.ConexionIA
import app.lukapp.dominio.EntradaMotorFinanciero
import app.lukapp.dominio.voz.aprenderDe
import app.lukapp.dominio.elegirIndiceImagenLuki
import app.lukapp.dominio.esRespuestaFallbackAsesor
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.responderAsesor
import app.lukapp.dominio.responderAyudaLukApp
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.simularPregunta
import app.lukapp.ui.VistaInicio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MensajeAsesor(val id: String, val esUsuario: Boolean, val texto: String, val sugerencias: List<String> = emptyList())

/**
 * Estado del chat del Asesor, con el orden de resolución de AsesorView.handleSend:
 * guía de LukApp, simulación, motor local si sabe responder, IA del servidor y,
 * si la IA falla, el motor local como respaldo con «Reintentar con IA».
 * Pendiente (no se simula): historial y memoria guardados, propuestas de
 * presupuesto/meta, «Revisar y editar movimiento», telemetría del respaldo y dictado.
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
    private var contexto = AsesorContext()
    private var contador = 0
    private fun nuevoId() = "msg-${System.currentTimeMillis()}-${contador++}"

    init { verificar() }

    fun verificar() {
        conexion.value = ConexionIA.DESPERTANDO
        viewModelScope.launch { conexion.value = if (cliente.disponible()) ConexionIA.EN_LINEA else ConexionIA.LOCAL }
    }

    fun enviar(texto: String, vista: VistaInicio) = procesar(texto.trim(), vista, esReintento = false)

    /** «Reintentar con IA»: quita el respaldo local anterior y vuelve a preguntar. */
    fun reintentar(vista: VistaInicio) { ultimoTexto?.let { procesar(it, vista, esReintento = true) } }

    private fun agregarBot(texto: String, sugerencias: List<String> = emptyList()) =
        mensajes.update { it + MensajeAsesor(nuevoId(), false, texto, sugerencias) }

    private fun limpiarEstado() { error.value = null; ultimoTexto = null }

    private fun procesar(t: String, vista: VistaInicio, esReintento: Boolean) {
        if (t.isEmpty() || pensando.value) return
        // El historial que ve la IA es el anterior a esta pregunta, como `messages.slice(-5)` en la web.
        val historial = mensajes.value.map { TurnoChat(it.id, if (it.esUsuario) "user" else "bot", it.texto) }
        if (esReintento) mensajes.update { if (it.lastOrNull()?.esUsuario == false) it.dropLast(1) else it }
        else mensajes.update { it + MensajeAsesor(nuevoId(), true, t) }

        responderAyudaLukApp(t)?.let { agregarBot(it); limpiarEstado(); return }

        pensando.value = true
        consulta = viewModelScope.launch {
            try {
                val libro = vista.libro
                val saldos = saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))
                val lexico = aprenderDe(libro.transacciones)
                suspend fun local() = withContext(Dispatchers.Default) {
                    responderAsesor(t, libro.transacciones, libro.cajitas, saldos, libro.categorias, lexico, contexto, vista.contexto.liquidez.disponibleDiarioCop)
                }
                val simulacion = withContext(Dispatchers.Default) { simularPregunta(t, EntradaMotorFinanciero(libro, vista.hoy, vista.ajustes.periodo)) }
                if (simulacion != null) {
                    agregarBot(simulacion.respuesta); conexion.value = ConexionIA.LOCAL; limpiarEstado(); return@launch
                }
                if (!esReintento) {
                    val rapida = local()
                    if (!esRespuestaFallbackAsesor(rapida)) {
                        contexto = rapida.newContext
                        agregarBot(rapida.text, rapida.suggestions.orEmpty())
                        conexion.value = ConexionIA.LOCAL; limpiarEstado(); return@launch
                    }
                }
                error.value = null; ultimoTexto = null
                when (val r = cliente.consultar(t, historial, "asesor-${System.currentTimeMillis()}-${java.util.UUID.randomUUID()}")) {
                    is ClienteAsesor.Respuesta.Texto -> { agregarBot(r.texto); conexion.value = ConexionIA.EN_LINEA }
                    is ClienteAsesor.Respuesta.Error -> {
                        conexion.value = ConexionIA.LOCAL
                        error.value = r.mensaje; ultimoTexto = t
                        val respaldo = local()
                        contexto = respaldo.newContext
                        agregarBot(respaldo.text, respaldo.suggestions.orEmpty())
                    }
                }
            } finally { pensando.value = false }
        }
    }

    fun nuevaConversacion() {
        consulta?.cancel()
        mensajes.value = emptyList(); limpiarEstado(); pensando.value = false; contexto = AsesorContext()
    }
}
