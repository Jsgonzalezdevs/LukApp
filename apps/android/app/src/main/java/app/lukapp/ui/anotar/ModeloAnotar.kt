package app.lukapp.ui.anotar

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.Cambios
import app.lukapp.datos.OperacionesLibro
import app.lukapp.datos.analizarAnomalias
import app.lukapp.dominio.formatCop
import app.lukapp.datos.RepositorioFinanzas
import app.lukapp.datos.Transcripcion
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.contactoPorApodo
import app.lukapp.dominio.nuevoId
import app.lukapp.dominio.voz.CuentaConocida
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.dominio.voz.aprenderDe
import app.lukapp.dominio.voz.comoEntidadVoz
import app.lukapp.dominio.voz.movimientoEnBlanco
import app.lukapp.dominio.voz.parseComandoVoz
import app.lukapp.dominio.voz.parseMultipleTransactions
import app.lukapp.nativo.GrabadoraVoz
import java.time.Instant
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Las fases de DictadoOverlay.tsx. */
enum class FaseDictado { ESCUCHANDO, PROCESANDO, REVELANDO, ERROR }

data class EstadoDictado(
    val abierto: Boolean = false,
    val fase: FaseDictado = FaseDictado.ESCUCHANDO,
    val nivel: Float = 0f,
    val texto: String = "",
    val error: String? = null,
    val microfonoBloqueado: Boolean = false,
)

/** El aviso «quedó guardado» (AvisoGuardado.tsx). */
data class Guardado(
    val id: String,
    val texto: String,
    val detalle: String? = null,
    val aviso: String? = null,
    val permitirDeshacer: Boolean = true,
    val esError: Boolean = false,
)

/** Lo que Captura confirma (ConfirmDraft de ConfirmSheet.tsx). */
data class Borrador(
    val kind: String,
    val amountCop: Long,
    val category: String,
    val description: String,
    val cuentaId: String?,
    val rawTranscript: String,
    val occurredOn: String?,
    val cuotasTotal: Int?,
    val cuotaCop: Long?,
)

/**
 * BotonAnotar + `handleSubmit`/`handleSave` de LukAppApp.tsx. Nada se guarda
 * sin pasar por Captura, igual que en la web.
 */
class ModeloAnotar(
    app: Application,
    private val finanzas: RepositorioFinanzas,
    private val transcripcion: Transcripcion,
) : AndroidViewModel(app) {

    private val grabadora = GrabadoraVoz(app)
    private var medidor: Job? = null

    private val _dictado = MutableStateFlow(EstadoDictado())
    val dictado: StateFlow<EstadoDictado> = _dictado.asStateFlow()

    private val _pendiente = MutableStateFlow<ParsedTransaction?>(null)
    /** El movimiento abierto en Captura (`pending`). */
    val pendiente: StateFlow<ParsedTransaction?> = _pendiente.asStateFlow()

    private val _detalle = MutableStateFlow<Transaccion?>(null)
    val detalle: StateFlow<Transaccion?> = _detalle.asStateFlow()
    private val _editando = MutableStateFlow<Transaccion?>(null)
    val editando: StateFlow<Transaccion?> = _editando.asStateFlow()
    private val _guardado = MutableStateFlow<Guardado?>(null)
    val guardado: StateFlow<Guardado?> = _guardado.asStateFlow()

    fun abrirDetalle(tx: Transaccion) { _detalle.value = tx }
    fun cerrarDetalle() { _detalle.value = null }
    fun editar(tx: Transaccion) { _detalle.value = null; _editando.value = tx }
    fun cerrarEdicion() { _editando.value = null }
    fun cerrarGuardado() { _guardado.value = null }

    private val _aviso = MutableStateFlow<String?>(null)
    /** Dictados que la app nativa todavía no sabe confirmar (varios movimientos, comandos). */
    val aviso: StateFlow<String?> = _aviso.asStateFlow()

    private val _comando = MutableStateFlow<app.lukapp.dominio.voz.ComandoVoz?>(null)
    /** Una orden por voz (transferir, abonar, saldo, rendimiento) esperando que la revises y confirmes. */
    val comando: StateFlow<app.lukapp.dominio.voz.ComandoVoz?> = _comando.asStateFlow()
    fun cerrarComando() { _comando.value = null }

    /**
     * `confirmarComandoVoz` de LukAppApp.tsx. Nada se aplica sin pasar por la confirmación; si no se pudo guardar, la
     * pantalla sigue abierta con lo escrito. Estas operaciones no se deshacen desde el aviso.
     */
    suspend fun confirmarComando(orden: app.lukapp.dominio.OrdenConfirmada): Boolean {
        fun nombre(id: String) = libro.cajitas.firstOrNull { it.id == id }?.nombre.orEmpty()
        val hoy = app.lukapp.dominio.bogotaDate()
        val texto: String; val aviso: String?
        val cambios = when (orden) {
            is app.lukapp.dominio.OrdenConfirmada.Transferencia -> {
                texto = "Transferiste ${formatCop(orden.montoCop)}"; aviso = "${nombre(orden.origenId)} → ${nombre(orden.destinoId)}"
                OperacionesLibro.transferir(libro, orden.origenId, orden.destinoId, orden.montoCop, orden.occurredOn ?: hoy)
            }
            is app.lukapp.dominio.OrdenConfirmada.Abono -> {
                texto = "Abonaste ${formatCop(orden.montoCop)}"; aviso = "${nombre(orden.cuentaId)} → ${nombre(orden.deudaId)}"
                OperacionesLibro.abonarDeuda(libro, orden.deudaId, orden.cuentaId, orden.montoCop, orden.occurredOn ?: hoy)
            }
            is app.lukapp.dominio.OrdenConfirmada.Saldo -> {
                texto = "${nombre(orden.cajitaId)} quedó en ${formatCop(orden.saldoCop)}"; aviso = null
                OperacionesLibro.fijarSaldo(libro, orden.cajitaId, orden.saldoCop, "Saldo actualizado por voz")
            }
            is app.lukapp.dominio.OrdenConfirmada.Rendimiento -> {
                texto = "Rendimiento de ${formatCop(orden.montoCop)}"; aviso = nombre(orden.cajitaId)
                OperacionesLibro.registrarRendimiento(orden.cajitaId, orden.montoCop, orden.occurredOn ?: hoy)
            }
        }
        val ok = runCatching { cambios?.let { finanzas.aplicar(it) }; true }.getOrDefault(false)
        if (!ok) return false
        _guardado.value = Guardado("operacion-voz", texto, aviso = aviso, permitirDeshacer = false)
        _comando.value = null
        return true
    }

    private val _multiples = MutableStateFlow<List<app.lukapp.dominio.voz.ParsedTransaction>?>(null)
    /** Varios movimientos dictados de una vez, esperando que los revises (`multiPending`). */
    val multiples: StateFlow<List<app.lukapp.dominio.voz.ParsedTransaction>?> = _multiples.asStateFlow()
    fun cerrarMultiples() { _multiples.value = null }

    /**
     * `onSaveAll` de LukAppApp.tsx: se guardan todos juntos en una sola operación (o ninguno) y el aviso no ofrece
     * Deshacer. Si falla, la lista sigue abierta para intentarlo de nuevo.
     */
    suspend fun guardarMultiples(items: List<app.lukapp.dominio.voz.ParsedTransaction>, cuentaPorDefecto: String?): Boolean {
        val ahora = Instant.now().toString()
        val txs = app.lukapp.dominio.movimientosDeMultiples(items, cuentaPorDefecto).map {
            Transaccion(nuevoId(), it.kind, it.amountCop, it.category, it.description, it.occurredOn ?: bogotaDate(), it.cuentaId, true, it.rawTranscript, null, null, ahora)
        }
        val ok = runCatching { finanzas.aplicar(Cambios(guardar = Libro(transacciones = txs))); true }.getOrDefault(false)
        if (!ok) {
            _guardado.value = Guardado("error", "No se pudieron guardar los movimientos", aviso = "Revisa la conexión e inténtalo de nuevo.", permitirDeshacer = false, esError = true)
            return false
        }
        _multiples.value = null
        _guardado.value = Guardado("multi", "Se guardaron ${txs.size} movimientos", permitirDeshacer = false)
        return true
    }

    private val _escaneando = MutableStateFlow(false)
    /** Leyendo la foto de un comprobante: la barra se bloquea mientras tanto. */
    val escaneando: StateFlow<Boolean> = _escaneando.asStateFlow()

    /**
     * `useImageOCR` + `onDictado`: el texto de la foto entra al mismo intérprete que lo dictado (por eso un comprobante con
     * varios movimientos o una orden de voz también se confirma antes de guardar). Los mensajes son los de la web.
     */
    fun escanear(contexto: android.content.Context, uri: android.net.Uri) {
        if (_escaneando.value) return
        _escaneando.value = true
        viewModelScope.launch {
            when (val r = app.lukapp.nativo.LectorImagen.leer(contexto, uri)) {
                is app.lukapp.nativo.LecturaImagen.Texto -> interpretar(r.texto)
                app.lukapp.nativo.LecturaImagen.SinTexto -> _aviso.value = "No encontramos texto en la imagen. Sube el comprobante completo o inténtalo de nuevo."
                app.lukapp.nativo.LecturaImagen.Fallo -> _aviso.value = "No pudimos leer el archivo en este momento. Tu foto puede estar bien; inténtalo otra vez."
            }
            _escaneando.value = false
        }
    }

    private val libro: Libro get() = finanzas.libro.value

    fun abrirManual() { _pendiente.value = movimientoEnBlanco() }
    /** `onCrearTransaccion` del Asesor: abre Captura con el movimiento detectado, sin guardarlo. */
    fun abrirMovimiento(tx: ParsedTransaction) { _pendiente.value = tx }
    fun cerrarCaptura() { _pendiente.value = null }
    fun cerrarAviso() { _aviso.value = null }
    fun microfonoBloqueado(bloqueado: Boolean) = _dictado.update { it.copy(microfonoBloqueado = bloqueado) }

    fun empezarDictado() {
        _dictado.update { EstadoDictado(abierto = true, microfonoBloqueado = it.microfonoBloqueado) }
        runCatching { grabadora.iniciar() }.onFailure {
            _dictado.update { it.copy(fase = FaseDictado.ERROR, error = "No se pudo usar el micrófono. Escríbelo a mano.") }
            return
        }
        medidor = viewModelScope.launch {
            // 100 ms, como el metering de la app Expo.
            while (isActive) { _dictado.update { it.copy(nivel = grabadora.nivel()) }; delay(100) }
        }
    }

    /** "Terminé": deja de grabar y transcribe la grabación completa. */
    fun terminarDictado() {
        if (_dictado.value.fase != FaseDictado.ESCUCHANDO) return
        medidor?.cancel()
        val audio = grabadora.terminar()
        _dictado.update { it.copy(fase = FaseDictado.PROCESANDO, nivel = 0f) }
        if (audio == null) {
            _dictado.update { it.copy(fase = FaseDictado.ERROR, error = "No se grabó nada. Mantén la app abierta mientras hablas.") }
            return
        }
        viewModelScope.launch {
            when (val r = transcripcion.transcribir(audio, vocabulario())) {
                is Transcripcion.Resultado.Texto -> _dictado.update { it.copy(fase = FaseDictado.REVELANDO, texto = r.texto) }
                is Transcripcion.Resultado.Error -> _dictado.update { it.copy(fase = FaseDictado.ERROR, error = r.mensaje) }
            }
        }
    }

    fun cancelarDictado() {
        medidor?.cancel()
        grabadora.cancelar()
        _dictado.update { EstadoDictado(microfonoBloqueado = it.microfonoBloqueado) }
    }

    /** "Revisar movimiento": el texto final pasa por el intérprete (handleSubmit). */
    fun continuarConTexto() {
        val texto = _dictado.value.texto
        _dictado.update { EstadoDictado(microfonoBloqueado = it.microfonoBloqueado) }
        if (texto.isNotBlank()) interpretar(texto)
    }

    fun interpretar(texto: String) {
        val l = libro
        parseComandoVoz(texto, l.cajitas.map { it.comoEntidadVoz() })?.let { _comando.value = it; return }
        val cuentas = l.cajitas.filter { it.archivedAt == null && (it.tipo == "cuenta" || it.tipo == "tarjeta") }.map { CuentaConocida(it.id, it.nombre) }
        val parseados = parseMultipleTransactions(texto, cuentas, l.categorias, aprenderDe(l.transacciones), l.transacciones)
        when {
            parseados.size > 1 -> _multiples.value = parseados
            parseados.size == 1 -> {
                val p = parseados[0]
                val quien = contactoPorApodo(texto, l.contactos)
                _pendiente.value = if (quien != null) p.copy(description = quien.nombre) else p
            }
        }
    }

    /** `detalleDeGuardado` de LukAppApp.tsx. */
    private fun detalleDeGuardado(id: String?): String {
        val cuenta = libro.cajitas.firstOrNull { it.id == id } ?: return "Guardado en tu historial · sin cambiar un saldo"
        return if (cuenta.tipo == "tarjeta") "Registrado en ${cuenta.nombre} · cupo actualizado" else "Guardado en ${cuenta.nombre} · saldo actualizado"
    }

    /** handleSave: un movimiento nuevo con la RPC atómica y el aviso con Deshacer. Devuelve false si falló. */
    suspend fun guardar(b: Borrador): Boolean {
        val id = nuevoId()
        // La anomalía se mide contra el historial de antes de este movimiento.
        val anomalia = analizarAnomalias(libro.transacciones, b.category, b.amountCop)
        val detalle = detalleDeGuardado(b.cuentaId)
        return runCatching {
            finanzas.aplicar(
                Cambios(
                    guardar = Libro(
                        transacciones = listOf(
                            Transaccion(
                                id = id, kind = b.kind, amountCop = b.amountCop, category = b.category,
                                description = b.description, occurredOn = b.occurredOn ?: bogotaDate(),
                                cuentaId = b.cuentaId, afectaSaldo = true, rawTranscript = b.rawTranscript,
                                cuotasTotal = b.cuotasTotal, cuotaCop = b.cuotaCop, createdAt = Instant.now().toString(),
                            ),
                        ),
                    ),
                ),
            )
            _pendiente.value = null
            _guardado.value = Guardado(
                id = id, texto = "${b.description} · ${formatCop(b.amountCop)}", detalle = detalle,
                aviso = if (anomalia.esAnomalia) "Más de lo normal — sueles gastar ${formatCop(Math.round(anomalia.promedio))} aquí." else null,
            )
            true
        }.getOrElse {
            _guardado.value = Guardado("error", "No se pudo guardar el movimiento", aviso = "Revisa la conexión e inténtalo de nuevo.", permitirDeshacer = false, esError = true)
            false
        }
    }

    /** handleUpdate: la fecha solo cambia si se eligió una; nunca se borra por accidente. */
    suspend fun actualizar(original: Transaccion, b: Borrador): Boolean = runCatching {
        val nuevo = original.copy(
            kind = b.kind, amountCop = b.amountCop, category = b.category, description = b.description,
            cuentaId = b.cuentaId, occurredOn = b.occurredOn ?: original.occurredOn,
        )
        finanzas.aplicar(OperacionesLibro.actualizarTransaccion(libro, nuevo))
        _editando.value = null
        true
    }.getOrElse {
        _guardado.value = Guardado("error", "No se pudo actualizar el movimiento", aviso = "Revisa la conexión e inténtalo de nuevo.", permitirDeshacer = false, esError = true)
        false
    }

    suspend fun borrar(id: String): Boolean = runCatching {
        finanzas.aplicar(OperacionesLibro.borrarTransaccion(libro, id))
        _detalle.value = null
        true
    }.getOrDefault(false)

    /** «Deshacer» del aviso: borra el movimiento recién guardado. */
    suspend fun deshacer(id: String): Boolean {
        val ok = borrar(id)
        if (ok) _guardado.value = null
        return ok
    }

    /** `vocabularioDictado`: nombres de cuentas, categorías propias y contactos, sin repetir. */
    private fun vocabulario(): List<String> {
        val l = libro
        val terminos = l.cajitas.filter { it.archivedAt == null }.map { it.nombre } +
            l.categorias.filter { it.archivedAt == null }.map { it.nombre } +
            l.contactos.filter { it.archivedAt == null }.flatMap { listOf(it.nombre) + it.apodos }
        val vistos = HashSet<String>()
        return terminos.filter { t ->
            val limpio = t.trim()
            val clave = limpio.lowercase(java.util.Locale.forLanguageTag("es"))
            limpio.length >= 2 && vistos.add(clave)
        }.take(30)
    }

    override fun onCleared() { grabadora.cancelar() }
}
