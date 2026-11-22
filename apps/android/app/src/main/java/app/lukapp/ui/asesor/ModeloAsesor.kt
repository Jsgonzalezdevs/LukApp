package app.lukapp.ui.asesor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteAsesor
import app.lukapp.datos.TurnoChat
import app.lukapp.dominio.AsesorContext
import app.lukapp.dominio.ConexionIA
import app.lukapp.dominio.EntradaMotorFinanciero
import app.lukapp.dominio.PropuestaAsesor
import app.lukapp.dominio.detectarMovimiento
import app.lukapp.dominio.detectarPropuestaAsesor
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.dominio.voz.aprenderDe
import app.lukapp.dominio.elegirIndiceImagenLuki
import app.lukapp.dominio.esRespuestaFallbackAsesor
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.responderAsesor
import app.lukapp.dominio.responderAyudaLukApp
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.simularPregunta
import app.lukapp.ui.VistaInicio
import app.lukapp.datos.Transcripcion
import app.lukapp.nativo.GrabadoraVoz
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class MensajeAsesor(
    val id: String, val esUsuario: Boolean, val texto: String, val sugerencias: List<String> = emptyList(), val proveedor: String? = null,
    val propuesta: PropuestaAsesor? = null, val accion: ParsedTransaction? = null, val acciones: List<ParsedTransaction> = emptyList(), val propuestaGuardando: Boolean = false, val propuestaConfirmada: Boolean = false, val propuestaError: String? = null,
)

/**
 * Estado del chat del Asesor, con el orden de resolución de AsesorView.handleSend:
 * guía de LukApp, simulación, motor local si sabe responder, IA del servidor y,
 * si la IA falla, el motor local como respaldo con «Reintentar con IA».
 * Guarda cada mensaje en la conversación del servidor (como la web) y deja leer las anteriores.
 * Pendiente (no se simula): «Revisar y editar movimiento».
 */
class ModeloAsesor(
    aplicacion: android.app.Application,
    private val cliente: ClienteAsesor,
    private val transcripcion: Transcripcion,
) : androidx.lifecycle.AndroidViewModel(aplicacion) {
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

    /** Dictado de la pregunta (`useDictation` de AsesorView): graba, transcribe y deja el texto en la caja, sin enviar. */
    enum class FaseDictadoAsesor { REPOSO, ESCUCHANDO, PROCESANDO }
    val faseDictado = MutableStateFlow(FaseDictadoAsesor.REPOSO)
    val errorDictado = MutableStateFlow<String?>(null)
    /** Lo transcrito, hasta que la pantalla lo agregue a la caja (`manejarDictadoFinal`) y lo consuma. */
    val textoDictado = MutableStateFlow<String?>(null)
    fun consumirTextoDictado() { textoDictado.value = null }
    private val grabadora = GrabadoraVoz(aplicacion)

    /** `alternarDictado`: empieza a escuchar, o termina y transcribe. Con el permiso ya concedido (la pantalla lo pide). */
    fun alternarDictado() {
        when (faseDictado.value) {
            FaseDictadoAsesor.PROCESANDO -> return
            FaseDictadoAsesor.ESCUCHANDO -> {
                val audio = grabadora.terminar()
                if (audio == null) { faseDictado.value = FaseDictadoAsesor.REPOSO; errorDictado.value = "No se grabó nada. Mantén la app abierta mientras hablas."; return }
                faseDictado.value = FaseDictadoAsesor.PROCESANDO
                viewModelScope.launch {
                    when (val r = transcripcion.transcribir(audio, emptyList())) {
                        is Transcripcion.Resultado.Texto -> { if (r.texto.isNotBlank()) textoDictado.value = r.texto.trim() }
                        is Transcripcion.Resultado.Error -> errorDictado.value = r.mensaje
                    }
                    faseDictado.value = FaseDictadoAsesor.REPOSO
                }
            }
            FaseDictadoAsesor.REPOSO -> {
                errorDictado.value = null
                runCatching { grabadora.iniciar() }.onSuccess { faseDictado.value = FaseDictadoAsesor.ESCUCHANDO }
                    .onFailure { errorDictado.value = "No se pudo usar el micrófono. Escríbelo a mano." }
            }
        }
    }

    override fun onCleared() { grabadora.cancelar() }

    val conversaciones = MutableStateFlow<List<ClienteAsesor.Conversacion>>(emptyList())
    val conversacionId = MutableStateFlow<String?>(null)
    val historialAbierto = MutableStateFlow(false)
    val cargandoConversacion = MutableStateFlow(false)
    val aviso = MutableStateFlow<String?>(null)
    private var memoria = emptyList<ClienteAsesor.DatoMemoria>()
    private var recordar = true
    private val candado = Mutex()

    /** Insignia «Premium» del encabezado. Va ANTES del `init`: sin sesión la consulta termina al instante y la escribe. */
    val premium = MutableStateFlow(false)
    val valoraciones = MutableStateFlow<Map<String, Boolean>>(emptyMap())

    init {
        verificar()
        viewModelScope.launch {
            memoria = cliente.memoria().orEmpty()
            cliente.conversaciones()?.let { conversaciones.value = it }
        }
    }

    /** Guarda en orden (usuario antes que respuesta) y crea la conversación con el primer mensaje, como `guardarMensaje`. */
    private fun guardar(m: MensajeAsesor) {
        if (!recordar) return
        viewModelScope.launch {
            candado.withLock {
                var id = conversacionId.value
                if (id == null) {
                    val nueva = cliente.crearConversacion(m.texto.take(70)) ?: return@withLock
                    id = nueva.id
                    conversacionId.value = id
                    conversaciones.update { listOf(nueva) + it.filter { c -> c.id != nueva.id } }
                }
                if (cliente.guardarMensaje(id, !m.esUsuario, m.texto, m.proveedor)) {
                    val ahora = java.time.Instant.now().toString()
                    conversaciones.update { l -> l.map { if (it.id == id) it.copy(actualizadoEn = ahora) else it }.sortedByDescending { it.actualizadoEn } }
                }
            }
        }
    }

    fun abrirHistorial() { historialAbierto.value = true }
    fun cerrarHistorial() { historialAbierto.value = false }

    fun abrirConversacion(c: ClienteAsesor.Conversacion) {
        if (cargandoConversacion.value) return
        cargandoConversacion.value = true
        viewModelScope.launch {
            val guardados = cliente.mensajes(c.id)
            if (guardados == null) aviso.value = "No pudimos abrir esa conversación."
            else {
                consulta?.cancel(); pensando.value = false; limpiarEstado()
                mensajes.value = guardados.map { MensajeAsesor(it.id, it.rol != "assistant", it.texto, proveedor = it.proveedor) }
                conversacionId.value = c.id; recordar = c.recordar; contexto = AsesorContext(); historialAbierto.value = false
            }
            cargandoConversacion.value = false
        }
    }

    fun actualizarPlan() { viewModelScope.launch { premium.value = cliente.prestaciones().let { it.esPremium && it.asesorIa } } }

    fun verificar() {
        actualizarPlan()
        conexion.value = ConexionIA.DESPERTANDO
        viewModelScope.launch { conexion.value = if (cliente.disponible()) ConexionIA.EN_LINEA else ConexionIA.LOCAL }
    }

    /** Útil (true) / no útil (false) por mensaje. Como en la web, vive solo en pantalla: no se guarda ni se envía. */
    fun valorar(id: String, util: Boolean) = valoraciones.update { if (it[id] == util) it - id else it + (id to util) }

    /** Como `handleRegenerar`: vuelve a mandar la pregunta anterior a esa respuesta, o un resumen si no hay. */
    fun regenerar(idRespuesta: String, vista: VistaInicio) {
        val l = mensajes.value
        val i = l.indexOfFirst { it.id == idRespuesta }
        if (i == -1) return
        val pregunta = l.subList(0, i).lastOrNull { it.esUsuario }?.texto ?: "Dame un resumen de mis finanzas"
        enviar(pregunta, vista)
    }

    fun enviar(texto: String, vista: VistaInicio) = procesar(texto.trim(), vista, esReintento = false)

    /** «Reintentar con IA»: quita el respaldo local anterior y vuelve a preguntar. */
    fun reintentar(vista: VistaInicio) { ultimoTexto?.let { procesar(it, vista, esReintento = true) } }

    private fun agregarBot(texto: String, sugerencias: List<String> = emptyList(), proveedor: String? = null, propuesta: PropuestaAsesor? = null, accion: ParsedTransaction? = null, acciones: List<ParsedTransaction>? = null) {
        val m = MensajeAsesor(nuevoId(), false, texto, sugerencias, proveedor, propuesta, accion, acciones.orEmpty())
        mensajes.update { it + m }
        guardar(m)
    }

    private fun limpiarEstado() { error.value = null; ultimoTexto = null }

    private fun procesar(t: String, vista: VistaInicio, esReintento: Boolean) {
        if (t.isEmpty() || pensando.value) return
        // El historial que ve la IA es el anterior a esta pregunta, como `messages.slice(-5)` en la web.
        val historial = mensajes.value.map { TurnoChat(it.id, if (it.esUsuario) "user" else "bot", it.texto) }
        if (esReintento) mensajes.update { if (it.lastOrNull()?.esUsuario == false) it.dropLast(1) else it }
        else MensajeAsesor(nuevoId(), true, t).let { u -> mensajes.update { it + u }; guardar(u) }

        responderAyudaLukApp(t)?.let { agregarBot(it, proveedor = "Guía de LukApp"); limpiarEstado(); return }

        pensando.value = true
        consulta = viewModelScope.launch {
            try {
                val libro = vista.libro
                val saldos = saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))
                val lexico = aprenderDe(libro.transacciones)
                val propuesta = detectarPropuestaAsesor(t, libro.categorias, lexico)
                suspend fun local() = withContext(Dispatchers.Default) {
                    responderAsesor(t, libro.transacciones, libro.cajitas, saldos, libro.categorias, lexico, contexto, vista.contexto.liquidez.disponibleDiarioCop)
                }
                val simulacion = withContext(Dispatchers.Default) { simularPregunta(t, EntradaMotorFinanciero(libro, vista.hoy, vista.ajustes.periodo)) }
                if (simulacion != null) {
                    agregarBot(simulacion.respuesta, proveedor = "Luki"); conexion.value = ConexionIA.LOCAL; limpiarEstado(); return@launch
                }
                if (!esReintento && propuesta == null) {
                    val rapida = local()
                    if (!esRespuestaFallbackAsesor(rapida)) {
                        contexto = rapida.newContext
                        agregarBot(rapida.text, rapida.suggestions.orEmpty(), "Luki", accion = rapida.action, acciones = rapida.actions)
                        conexion.value = ConexionIA.LOCAL; limpiarEstado(); return@launch
                    }
                }
                error.value = null; ultimoTexto = null
                val idConsulta = "asesor-${System.currentTimeMillis()}-${java.util.UUID.randomUUID()}"
                when (val r = cliente.consultar(t, historial, idConsulta, if (recordar) memoria.map { "${it.clave}: ${it.valor}" } else emptyList())) {
                    is ClienteAsesor.Respuesta.Texto -> {
                        // El modelo redacta, pero lo que se puede guardar lo decide el parser: sin movimiento real no hay botón.
                        val deteccion = withContext(Dispatchers.Default) { detectarMovimiento(t, libro.transacciones, libro.cajitas, libro.categorias, lexico, contexto) }
                        contexto = deteccion.newContext
                        agregarBot(r.texto, proveedor = r.proveedor, propuesta = propuesta, accion = if (propuesta != null) null else deteccion.propuesta?.action, acciones = if (propuesta != null) null else deteccion.propuesta?.actions); conexion.value = ConexionIA.EN_LINEA }
                    is ClienteAsesor.Respuesta.Error -> {
                        conexion.value = ConexionIA.LOCAL
                        error.value = r.mensaje; ultimoTexto = t
                        val respaldo = local()
                        contexto = respaldo.newContext
                        agregarBot(respaldo.text, respaldo.suggestions.orEmpty(), propuesta = propuesta, accion = if (propuesta != null) null else respaldo.action, acciones = if (propuesta != null) null else respaldo.actions)
                        // Para que Superadmin explique qué recibió la persona cuando la IA no estuvo disponible (telemetría de la web).
                        viewModelScope.launch { cliente.respaldoLocal(idConsulta, t, respaldo.text, r.mensaje) }
                    }
                }
            } finally { pensando.value = false }
        }
    }

    private fun cambiar(id: String, f: (MensajeAsesor) -> MensajeAsesor) = mensajes.update { l -> l.map { if (it.id == id) f(it) else it } }

    /** `actualizarPropuesta`: el monto nunca baja de 1, como en la web. */
    fun editarPropuesta(id: String, f: (PropuestaAsesor) -> PropuestaAsesor) =
        cambiar(id) { m -> if (m.propuesta == null || m.propuestaConfirmada) m else m.copy(propuesta = f(m.propuesta)) }

    /** `confirmarPropuesta`: guarda por la misma puerta que el resto de la app y nunca sin que la persona pulse el botón. */
    fun confirmarPropuesta(id: String, fijarPresupuesto: suspend (String, Long) -> Boolean, crearMeta: suspend (String, Long, String?) -> Boolean) {
        val p = mensajes.value.firstOrNull { it.id == id }?.propuesta ?: return
        cambiar(id) { it.copy(propuestaGuardando = true, propuestaError = null) }
        viewModelScope.launch {
            val ok = runCatching {
                when (p) {
                    is PropuestaAsesor.Presupuesto -> fijarPresupuesto(p.categoria, p.montoCop)
                    is PropuestaAsesor.Meta -> crearMeta(p.nombre, p.objetivoCop, p.fechaObjetivo)
                }
            }.getOrDefault(false)
            cambiar(id) { it.copy(propuestaGuardando = false, propuestaConfirmada = ok, propuestaError = if (ok) null else "No se pudo guardar; revisa tu conexión e inténtalo otra vez.") }
        }
    }

    fun nuevaConversacion() {
        consulta?.cancel()
        mensajes.value = emptyList(); limpiarEstado(); pensando.value = false; contexto = AsesorContext()
        conversacionId.value = null; historialAbierto.value = false
    }
}
