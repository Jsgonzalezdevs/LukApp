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

    val vista: StateFlow<VistaInicio?> = combine(finanzas.libro, preferencias.ajustes, periodoElegido) { libro, ajustes, elegido ->
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
            // La web pasa los movimientos DEL PERÍODO a calcularRacha (InicioView.tsx:158-161).
            racha = calcularRacha(delPeriodo, hoy),
            catalogo = hacerCatalogo(libro.categorias),
            ajustes = ajustes,
        )
    }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.Eagerly, null)

    fun abrir(usuario: String) {
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
    /** «cuenta» o «cajita» mientras el formulario de nuevo está abierto. */
    val nuevaCajitaTipo = MutableStateFlow<String?>(null)

    suspend fun crearCajita(nombre: String, icon: String, tipo: String, clase: String?, meta: Long?, tasa: Double?, inversion: Boolean, moneda: String, saldoInicial: Long?) =
        aplicarCambios { OperacionesLibro.crearCajita(finanzas.libro.value, nombre, icon, tipo, clase, meta, tasa, inversion, moneda, saldoInicial) }
    suspend fun actualizarCajita(c: app.lukapp.dominio.Cajita) = aplicarCambios { OperacionesLibro.actualizarCajita(c) }
    suspend fun transferir(origen: String, destino: String, monto: Long) =
        aplicarCambios { OperacionesLibro.transferir(finanzas.libro.value, origen, destino, monto) }

    private suspend fun aplicarCambios(c: () -> app.lukapp.datos.Cambios?): Boolean = runCatching { c()?.let { finanzas.aplicar(it) }; true }.getOrDefault(false)

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

    fun contarAhorros(valor: Boolean) { viewModelScope.launch { preferencias.contarAhorros(valor) } }

    fun alternarPrivacidad() {
        viewModelScope.launch { preferencias.privacidad(!preferencias.ajustes.value.privacidad) }
    }
}
