package app.lukapp.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.AjustesCuenta
import app.lukapp.datos.OperacionesLibro
import app.lukapp.datos.EstadoSincronizacion
import app.lukapp.datos.PreferenciasCuenta
import app.lukapp.datos.RepositorioFinanzas
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.ContextoFinanciero
import app.lukapp.dominio.InfoRacha
import app.lukapp.dominio.Libro
import app.lukapp.dominio.MonthTotals
import app.lukapp.dominio.PreparacionInicio
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.calcularRacha
import app.lukapp.dominio.claveDePeriodo
import app.lukapp.dominio.ConfigPeriodo
import app.lukapp.dominio.construirContextoFinanciero
import app.lukapp.dominio.forPeriod
import app.lukapp.dominio.hacerCatalogo
import app.lukapp.dominio.monthTotals
import app.lukapp.dominio.preparacionInicio
import app.lukapp.ui.shell.Seccion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Todo lo que Inicio necesita, ya calculado fuera del hilo principal. */
data class VistaInicio(
    val libro: Libro,
    val hoy: String,
    val clavePeriodo: String,
    val maxClavePeriodo: String,
    val delPeriodo: List<Transaccion>,
    val totales: MonthTotals,
    val contexto: ContextoFinanciero,
    val preparacion: PreparacionInicio,
    val racha: InfoRacha,
    /** Días que el equipo sumó a la racha; Dinero los usa con todo el historial. */
    val diasRegaladosRacha: List<String>,
    val catalogo: Catalogo,
    val ajustes: AjustesCuenta,
)

/**
 * El estado de LukAppPanel (LukAppApp.tsx): sección activa, período elegido y
 * la fotografía financiera derivada del libro. El motor se recalcula en
 * Dispatchers.Default porque recorre el libro completo varias veces y en un
 * teléfono de gama baja eso se notaría al desplazar.
 */
class ModeloApp(
    private val finanzas: RepositorioFinanzas,
    private val preferencias: PreferenciasCuenta,
) : ViewModel() {

    val seccion = MutableStateFlow(Seccion.INICIO)
    private val periodoElegido = MutableStateFlow<String?>(null)

    val estadoSincronizacion: StateFlow<EstadoSincronizacion> = finanzas.estado
    val errorSincronizacion: StateFlow<String?> = finanzas.error

    val vista: StateFlow<VistaInicio?> = combine(finanzas.libro, preferencias.ajustes, periodoElegido, finanzas.diasRegaladosRacha) { libro, ajustes, elegido, regalados ->
        val hoy = bogotaDate()
        val maxClave = claveDePeriodo(hoy, ajustes.periodo)
        val clave = elegido ?: maxClave
        val delPeriodo = forPeriod(libro.transacciones, clave, ajustes.periodo)
            .sortedByDescending { it.occurredOn }
        VistaInicio(
            libro = libro,
            hoy = hoy,
            clavePeriodo = clave,
            maxClavePeriodo = maxClave,
            delPeriodo = delPeriodo,
            totales = monthTotals(delPeriodo),
            contexto = construirContextoFinanciero(libro, hoy, ajustes.periodo),
            preparacion = preparacionInicio(libro),
            // Con todo el historial, igual que la web: con solo el período, la racha se cortaba el día 1.
            racha = calcularRacha(libro.transacciones, hoy, regalados),
            diasRegaladosRacha = regalados,
            catalogo = hacerCatalogo(libro.categorias),
            ajustes = ajustes,
        )
    }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** El usuario con sesión: las vaquitas, que viven en el teléfono, se guardan por usuario. */
    var usuarioId: String? = null
        private set

    fun abrir(usuario: String) {
        usuarioId = usuario
        preferencias.recargar()
        viewModelScope.launch { finanzas.abrir(usuario) }
    }

    fun sincronizar() {
        preferencias.recargar()
        viewModelScope.launch { finanzas.sincronizar() }
    }

    /** La cuenta o ahorro abierto en su detalle (`panelDineroCajitaId`). */
    val cuentaAbierta = MutableStateFlow<String?>(null)

    /** La vista de tarjetas y deudas abierta (`panelDinero = 'tarjeta' | 'deuda'`). */
    val panelPasivos = MutableStateFlow<String?>(null)
    val calendarioAbierto = MutableStateFlow(false)

    suspend fun fijarPresupuesto(categoria: String, monto: Long): Boolean = runCatching {
        OperacionesLibro.fijarPresupuesto(finanzas.libro.value, categoria, monto)?.let { finanzas.aplicar(it) }
        true
    }.getOrDefault(false)

    val pagosFijosAbierto = MutableStateFlow(false)
    val buscarAbierto = MutableStateFlow(false)
    val proyeccionAbierta = MutableStateFlow(false)
    /** Clave 'YYYY-MM' del mes cuyo resumen tipo historia está abierto, o null. */
    val resumenMes = MutableStateFlow<String?>(null)
    /** «cuenta» o «cajita» mientras el formulario de nuevo está abierto. */
    val nuevaCajitaTipo = MutableStateFlow<String?>(null)

    suspend fun crearCajita(nombre: String, icon: String, tipo: String, clase: String?, meta: Long?, tasa: Double?, inversion: Boolean, moneda: String, saldoInicial: Long?) =
        aplicarCambios { OperacionesLibro.crearCajita(finanzas.libro.value, nombre, icon, tipo, clase, meta, tasa, inversion, moneda, saldoInicial) }
    suspend fun actualizarCajita(c: app.lukapp.dominio.Cajita) = aplicarCambios { OperacionesLibro.actualizarCajita(c) }
    suspend fun transferir(origen: String, destino: String, monto: Long) =
        aplicarCambios { OperacionesLibro.transferir(finanzas.libro.value, origen, destino, monto) }

    private suspend fun aplicarCambios(c: () -> app.lukapp.datos.Cambios?): Boolean = runCatching { c()?.let { finanzas.aplicar(it) }; true }.getOrDefault(false)

    val categoriasAbierto = MutableStateFlow(false)
    val respaldoAbierto = MutableStateFlow(false)
    val funcionesAbierto = MutableStateFlow(false)
    val metasAbierto = MutableStateFlow(false)
    val gmfAbierto = MutableStateFlow(false)
    val divisionAbierta = MutableStateFlow(false)
    val vaquitasAbierto = MutableStateFlow(false)
    val espaciosAbierto = MutableStateFlow(false)
    val extractosAbierto = MutableStateFlow(false)
    val reporteAbierto = MutableStateFlow(false)
    /** Importar extractos: los movimientos nuevos y lo que quedó para revisar entran juntos, en una sola operación. */
    suspend fun importarExtracto(txs: List<app.lukapp.dominio.Transaccion>, revisiones: List<app.lukapp.dominio.RevisionDudosa>) =
        aplicarCambios { app.lukapp.datos.Cambios(guardar = app.lukapp.dominio.Libro(transacciones = txs, revisiones = revisiones)) }
    /** «Completar este movimiento»: el que ya tenías toma el texto y la categoría del extracto. */
    suspend fun completarMovimiento(tx: app.lukapp.dominio.Transaccion) = aplicarCambios { OperacionesLibro.actualizarTransaccion(finanzas.libro.value, tx) }
    fun cambiarUvt(v: app.lukapp.dominio.ValorUvt) { viewModelScope.launch { preferencias.uvt(v) } }
    fun cambiarCuentasGmf(ids: List<String>) { viewModelScope.launch { preferencias.cuentasGmf(ids) } }
    fun cambiarRegimenGmf(r: String) { viewModelScope.launch { preferencias.regimenGmf(r) } }
    fun cambiarCuentaExentaGmf(id: String?) { viewModelScope.launch { preferencias.cuentaExentaGmf(id) } }
    suspend fun crearMetaCompleta(nombre: String, icon: String, objetivo: Long, fecha: String?, cajitaId: String?) =
        aplicarCambios { OperacionesLibro.crearMeta(finanzas.libro.value, nombre, objetivo, fecha, icon, 0, cajitaId) }
    suspend fun actualizarMeta(m: app.lukapp.dominio.Meta) = aplicarCambios { OperacionesLibro.actualizarMeta(m) }
    suspend fun borrarMeta(id: String) = aplicarCambios { OperacionesLibro.borrarMeta(id) }
    fun recordatorioActivo(valor: Boolean) { viewModelScope.launch { preferencias.recordatorioActivo(valor) } }
    fun recordatorioHora(hora: String) { viewModelScope.launch { preferencias.recordatorioHora(hora) } }
    fun terminarGuiaBasica() { viewModelScope.launch { preferencias.terminarGuiaBasica() } }
    fun marcarSeccionGuia(id: String) { viewModelScope.launch { preferencias.marcarSeccionGuia(id) } }
    fun reiniciarGuia() { viewModelScope.launch { preferencias.reiniciarGuia() } }
    /**
     * Cierra la bienvenida: guarda el nombre, crea la cuenta elegida (con su saldo inicial) y marca la bienvenida
     * como terminada. Si la cuenta no se pudo crear devuelve false y NO la marca, para que se pueda reintentar.
     */
    suspend fun terminarBienvenida(nombre: String, banco: String?, clase: String?, saldo: Long?): Boolean {
        if (nombre.isNotEmpty()) preferencias.nombre(nombre)
        if (banco != null && !crearCajita(banco, "Wallet", app.lukapp.dominio.TipoCajita.CUENTA, clase, null, null, false, "COP", saldo)) return false
        preferencias.terminarOnboarding()
        return true
    }
    val cuentaAbiertaPanel = MutableStateFlow(false)
    /** Cambios hechos sin conexión que todavía no suben. */
    val cambiosPendientes: Int get() = finanzas.pendientes
    /** Como `sincronizar`, pero espera a que termine para que la pantalla Cuenta pueda enseñar el giro. */
    suspend fun sincronizarYEsperar() { preferencias.recargar(); finanzas.sincronizar() }
    /** `almacen.restaurar`: REEMPLAZA todo el libro (la RPC borra lo que no venga en el respaldo). */
    suspend fun restaurarLibro(nuevo: app.lukapp.dominio.Libro) = aplicarCambios { app.lukapp.datos.Cambios(guardar = nuevo, reemplazar = true) }
    val nombresAbierto = MutableStateFlow(false)
    suspend fun unirContactos(a: String, b: String, nombre: String) = aplicarCambios { OperacionesLibro.unirContactos(finanzas.libro.value, a, b, nombre) }
    suspend fun separarContactos(a: String, b: String, nombre: String) = aplicarCambios { OperacionesLibro.separarContactos(finanzas.libro.value, a, b, nombre) }
    suspend fun renombrarContacto(c: app.lukapp.dominio.Contacto) = aplicarCambios { OperacionesLibro.actualizarContacto(c) }
    suspend fun deshacerContacto(id: String) = aplicarCambios { OperacionesLibro.borrarContacto(id) }
    suspend fun apodarParte(clave: String, nombre: String, apodo: String, quitar: Boolean) = aplicarCambios { OperacionesLibro.apodarParte(finanzas.libro.value, clave, nombre, apodo, quitar) }
    val revisionesAbierto = MutableStateFlow(false)
    suspend fun guardarRevision(r: app.lukapp.dominio.RevisionDudosa) = aplicarCambios { OperacionesLibro.guardarRevision(r) }
    suspend fun crearCategoria(nombre: String, icon: String, emoji: String, color: String) = aplicarCambios { OperacionesLibro.crearCategoria(nombre, icon, emoji, color) }
    suspend fun actualizarCategoria(c: app.lukapp.dominio.CategoriaPersonal) = aplicarCambios { OperacionesLibro.actualizarCategoria(c) }
    suspend fun archivarCategoria(c: app.lukapp.dominio.CategoriaPersonal) = aplicarCambios { OperacionesLibro.archivarCategoria(c) }
    suspend fun borrarCategoria(id: String) = aplicarCambios { OperacionesLibro.borrarCategoria(id) }

    suspend fun crearPagoFijo(nombre: String, kind: String, monto: Long, categoria: String, cuentaId: String?, dia: Int) =
        aplicarCambios { OperacionesLibro.crearRecurrente(nombre, kind, monto, categoria, cuentaId, dia) }
    suspend fun actualizarPagoFijo(r: app.lukapp.dominio.Recurrente) = aplicarCambios { OperacionesLibro.actualizarRecurrente(r) }
    suspend fun borrarPagoFijo(id: String) = aplicarCambios { OperacionesLibro.borrarRecurrente(id) }
    suspend fun confirmarPagoFijo(p: app.lukapp.dominio.Pendiente) = aplicarCambios { OperacionesLibro.confirmarRecurrente(p) }

    suspend fun quitarPresupuesto(categoria: String): Boolean = runCatching {
        finanzas.aplicar(OperacionesLibro.quitarPresupuesto(categoria))
        true
    }.getOrDefault(false)

    fun alertasPresupuesto(valor: Boolean) { viewModelScope.launch { preferencias.alertasPresupuesto(valor) } }
    fun umbralAlerta(pct: Int) { viewModelScope.launch { preferencias.umbralAlerta(pct) } }

    suspend fun crearMeta(nombre: String, objetivo: Long, fecha: String?): Boolean = runCatching {
        finanzas.aplicar(OperacionesLibro.crearMeta(finanzas.libro.value, nombre, objetivo, fecha))
        true
    }.getOrDefault(false)

    suspend fun abonar(deudaId: String, cuentaId: String, monto: Long): Boolean = runCatching {
        OperacionesLibro.abonarDeuda(finanzas.libro.value, deudaId, cuentaId, monto)?.let { finanzas.aplicar(it) }
        true
    }.getOrDefault(false)

    suspend fun comprar(id: String, monto: Long, categoria: String, cuotas: Int?, cuota: Long?, interes: Double?, manejo: Long?): Boolean = runCatching {
        finanzas.aplicar(OperacionesLibro.registrarCompra(finanzas.libro.value, id, monto, categoria, cuotasTotal = cuotas, cuotaCop = cuota, interesPct = interes, cuotaManejoCop = manejo))
        true
    }.getOrDefault(false)

    suspend fun fijarSaldo(id: String, saldo: Long): Boolean = runCatching {
        OperacionesLibro.fijarSaldo(finanzas.libro.value, id, saldo)?.let { finanzas.aplicar(it) }
        true
    }.getOrDefault(false)

    suspend fun eliminarCuenta(id: String): Boolean = runCatching {
        finanzas.aplicar(OperacionesLibro.borrarCajita(finanzas.libro.value, id))
        // Si era la principal, deja de serlo (la web la dejaría apuntando a una cuenta que ya no existe).
        if (preferencias.ajustes.value.cuentaFavoritaId == id) preferencias.cuentaFavorita(null)
        cuentaAbierta.value = null
        true
    }.getOrDefault(false)

    fun alternarFavorita(id: String) {
        viewModelScope.launch { preferencias.cuentaFavorita(if (preferencias.ajustes.value.cuentaFavoritaId == id) null else id) }
    }

    fun elegirPeriodo(clave: String) { periodoElegido.value = clave }

    val periodoAbierto = MutableStateFlow(false)
    fun proximosPagos(valor: Boolean) { viewModelScope.launch { preferencias.proximosPagos(valor) } }
    fun decisiones(valor: Boolean) { viewModelScope.launch { preferencias.decisiones(valor) } }
    /** Al cambiar de frecuencia la clave elegida deja de existir, así que se vuelve al período de hoy. */
    fun cambiarPeriodo(config: ConfigPeriodo) { periodoElegido.value = null; viewModelScope.launch { preferencias.periodo(config) } }
    fun contarAhorros(valor: Boolean) { viewModelScope.launch { preferencias.contarAhorros(valor) } }

    fun alternarPrivacidad() {
        viewModelScope.launch { preferencias.privacidad(!preferencias.ajustes.value.privacidad) }
    }

    /** Hay alguna pantalla o panel encima de las secciones: la guía no se enseña entonces, no señalaría nada. */
    val hayPanelAbierto: StateFlow<Boolean> = combine(
        listOf(
            calendarioAbierto, pagosFijosAbierto, buscarAbierto, proyeccionAbierta, periodoAbierto, categoriasAbierto, revisionesAbierto,
            nombresAbierto, respaldoAbierto, funcionesAbierto, cuentaAbiertaPanel, metasAbierto, gmfAbierto, divisionAbierta, vaquitasAbierto, espaciosAbierto, extractosAbierto, reporteAbierto,
            resumenMes.map { it != null }, nuevaCajitaTipo.map { it != null }, cuentaAbierta.map { it != null }, panelPasivos.map { it != null },
        ),
    ) { estados -> estados.any { it } }.stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.Eagerly, false)
}
