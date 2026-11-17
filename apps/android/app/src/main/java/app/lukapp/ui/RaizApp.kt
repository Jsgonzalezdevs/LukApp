package app.lukapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.datos.EstadoSincronizacion
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.acceso.Girando
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.PantallaInicio
import app.lukapp.ui.shell.BarraNavegacion
import app.lukapp.ui.shell.Seccion
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/**
 * LukAppShell.tsx + LukAppPanel: columna de hasta 720dp con 16dp a los lados,
 * barra flotante abajo y fundido de 0.18s al cambiar de sección (sin salida).
 * El margen superior es el de `data-native` (clamp(1.25rem, 3vh, 1.75rem))
 * sobre la barra de estado, porque así se ve hoy la app Android.
 */
@Composable
fun ShellLukApp(
    modelo: ModeloApp,
    anotar: app.lukapp.ui.anotar.ModeloAnotar,
    asesor: app.lukapp.ui.asesor.ModeloAsesor,
    insights: app.lukapp.ui.inicio.ModeloInsights,
    alCerrarSesion: () -> Unit,
    desbloqueoActivo: Boolean,
    biometriaDisponible: Boolean,
    alCambiarDesbloqueo: (Boolean) -> Unit,
    tema: app.lukapp.ui.tema.PreferenciaTema,
    alCambiarTema: (app.lukapp.ui.tema.PreferenciaTema) -> Unit,
    correo: String?,
) {
    val c = LukApp.colores
    val seccion by modelo.seccion.collectAsState()
    val vista by modelo.vista.collectAsState()
    val estado by modelo.estadoSincronizacion.collectAsState()
    val error by modelo.errorSincronizacion.collectAsState()
    val hapticos = rememberHapticos()

    // Atrás por capas (inventario §1.4): Calendario → Mes, sección ≠ Inicio → Inicio, Inicio → salir.
    BackHandler(enabled = seccion != Seccion.INICIO) {
        modelo.seccion.value = if (seccion == Seccion.CALENDARIO) Seccion.MES else Seccion.INICIO
    }

    val altoPantalla = LocalConfiguration.current.screenHeightDp
    val margenSuperior = (altoPantalla * 0.03f).coerceIn(20f, 28f).dp

    Box(Modifier.fillMaxSize().background(c.bg)) {
        val actual = vista
        if (actual == null || (estado == EstadoSincronizacion.CARGANDO && actual.libro == app.lukapp.dominio.Libro())) {
            PantallaCarga()
        } else {
            var refrescando by remember { mutableStateOf(false) }
            LaunchedEffect(estado) { if (estado != EstadoSincronizacion.CARGANDO && refrescando) { refrescando = false; hapticos.disparar(Haptico.SELECTION) } }
            AnimatedContent(
                targetState = seccion,
                transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(0)) },
                label = "seccion",
            ) { s ->
                val contenido: @Composable () -> Unit = {
                    Column(
                        Modifier
                            .fillMaxSize()
                            // La barra de estado queda fuera del desplazamiento: en la app actual el
                            // contenido empieza debajo de ella y nunca pasa por detrás.
                            .windowInsetsPadding(WindowInsets.statusBars)
                            // El chat se desplaza por dentro y deja la caja de texto fija abajo.
                            .then(if (s == Seccion.ASESOR) Modifier else Modifier.verticalScroll(rememberScrollState()))
                            .padding(top = margenSuperior),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().then(if (s == Seccion.ASESOR) Modifier.fillMaxHeight() else Modifier).padding(horizontal = 16.dp)) {
                            AvisoSincronizacion(estado, error)
                            when (s) {
                                Seccion.INICIO -> PantallaInicio(
                                    vista = actual,
                                    alElegirPeriodo = modelo::elegirPeriodo,
                                    alAlternarPrivacidad = modelo::alternarPrivacidad,
                                    alVerMes = { modelo.seccion.value = Seccion.MES },
                                    alAjustes = { modelo.seccion.value = Seccion.AJUSTES },
                                    alAbrirMovimiento = anotar::abrirDetalle,
                                    insights = insights,
                                    // Como `promptInicial`: pasa al Asesor y la pregunta sale sola.
                                    alConsultarAsesor = { pregunta -> modelo.seccion.value = Seccion.ASESOR; asesor.enviar(pregunta, actual) },
                                )
                                Seccion.DINERO -> app.lukapp.ui.dinero.PantallaDinero(
                                    vista = actual,
                                    alElegirPeriodo = modelo::elegirPeriodo,
                                    alAjustes = { modelo.seccion.value = Seccion.AJUSTES },
                                    alAbrirCuenta = { modelo.cuentaAbierta.value = it.id },
                                    alAbrirPasivos = { modelo.panelPasivos.value = it },
                                )
                                Seccion.MES -> app.lukapp.ui.mes.PantallaMes(actual, modelo::elegirPeriodo, alAbrirCalendario = { modelo.calendarioAbierto.value = true },
                                    topes = app.lukapp.ui.mes.AccionesTopes(modelo::fijarPresupuesto, modelo::quitarPresupuesto, modelo::alertasPresupuesto, modelo::umbralAlerta))
                                Seccion.AJUSTES -> app.lukapp.ui.mas.PantallaMas(
                                    contarAhorros = actual.ajustes.contarAhorros, alContarAhorros = modelo::contarAhorros,
                                    tema = tema, alCambiarTema = alCambiarTema,
                                    desbloqueoActivo = desbloqueoActivo, biometriaDisponible = biometriaDisponible, alCambiarDesbloqueo = alCambiarDesbloqueo,
                                    correo = correo, alCerrarSesion = alCerrarSesion,
                                )
                                Seccion.ASESOR -> app.lukapp.ui.asesor.PantallaAsesor(asesor, actual, modelo::fijarPresupuesto, modelo::crearMeta, { tx -> modelo.seccion.value = Seccion.INICIO; anotar.abrirMovimiento(tx) }, Modifier.weight(1f))
                                else -> PantallaSinMigrar(s)
                            }
                            Box(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
                            Box(Modifier.size(136.dp))
                        }
                    }
                }
                // Pull to refresh solo en Inicio (usePullToRefresh.ts); háptico light al soltar.
                if (s == Seccion.INICIO) {
                    PullToRefreshBox(
                        isRefreshing = refrescando,
                        onRefresh = { refrescando = true; hapticos.disparar(Haptico.LIGHT); modelo.sincronizar() },
                    ) { contenido() }
                } else contenido()
            }
            BarraNavegacion(
                actual = seccion,
                alElegir = { modelo.seccion.value = it },
                modifier = Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.navigationBars).padding(horizontal = 16.dp),
            )
            CapaAnotar(anotar, actual, seccion, estadoGuardado = if (estado == EstadoSincronizacion.SIN_CONEXION) "Guardado en este dispositivo · pendiente de sincronizar" else "Sincronizado con tu cuenta", alGuardado = { fecha -> modelo.elegirPeriodo(app.lukapp.dominio.claveDePeriodo(fecha, actual.ajustes.periodo)) })
            val pasivos by modelo.panelPasivos.collectAsState()
            pasivos?.let { tipo ->
                app.lukapp.ui.pasivos.PantallaPasivos(
                    tipo = tipo, vista = actual, alCerrar = { modelo.panelPasivos.value = null },
                    acciones = app.lukapp.ui.pasivos.AccionesPasivo(
                        fijarSaldo = modelo::fijarSaldo, comprar = modelo::comprar, abonar = modelo::abonar,
                        eliminar = { modelo.eliminarCuenta(it) },
                    ),
                )
            }
            val historialAsesor by asesor.historialAbierto.collectAsState()
            if (historialAsesor && seccion == Seccion.ASESOR) app.lukapp.ui.asesor.HojaHistorial(asesor)
            val calendario by modelo.calendarioAbierto.collectAsState()
            if (calendario) app.lukapp.ui.calendario.PantallaCalendario(actual, alCerrar = { modelo.calendarioAbierto.value = false }, alAnadirPagoFijo = { modelo.pagosFijosAbierto.value = true })
            val pagosFijos by modelo.pagosFijosAbierto.collectAsState()
            if (pagosFijos) app.lukapp.ui.calendario.PantallaPagosFijos(actual, app.lukapp.ui.calendario.AccionesPagosFijos(modelo::crearPagoFijo, modelo::actualizarPagoFijo, modelo::borrarPagoFijo, modelo::confirmarPagoFijo), alCerrar = { modelo.pagosFijosAbierto.value = false })
            val abierta by modelo.cuentaAbierta.collectAsState()
            actual.libro.cajitas.firstOrNull { it.id == abierta && it.archivedAt == null }?.let { cuenta ->
                app.lukapp.ui.cuenta.PantallaDetalleCuenta(
                    cajita = cuenta, vista = actual,
                    alCerrar = { modelo.cuentaAbierta.value = null },
                    alFijarSaldo = { modelo.fijarSaldo(cuenta.id, it) },
                    alAlternarFavorita = { modelo.alternarFavorita(cuenta.id) },
                    alEliminar = { modelo.eliminarCuenta(cuenta.id) },
                )
            }
        }
    }
}

/** PantallaCarga.tsx: fondo solo, spinner a los 350 ms, sin logo. */
@Composable
fun PantallaCarga() {
    val c = LukApp.colores
    var mostrar by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { kotlinx.coroutines.delay(350); mostrar = true }
    Box(Modifier.fillMaxSize().background(c.bg), contentAlignment = Alignment.Center) {
        if (mostrar) Box(Modifier.size(28.dp)) { Girando(Lucide.LoaderCircle, 28.dp, c.inkSoft.copy(alpha = 0.7f)) }
    }
}

/** El aviso de LukAppApp.tsx:997-1000: tarjeta ámbar con ícono de 16 y texto de 13. */
@Composable
private fun AvisoSincronizacion(estado: EstadoSincronizacion, error: String?) {
    val c = LukApp.colores
    val texto = when {
        estado == EstadoSincronizacion.SIN_CONEXION -> "Sin conexión. Tus cambios se guardan en este teléfono y se envían al volver la señal."
        estado == EstadoSincronizacion.ERROR && error != null -> error
        else -> return
    }
    Row(
        Modifier.padding(bottom = 16.dp).fillMaxWidth()
            .background(c.warnBg, Medidas.formaCard).padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icono(if (estado == EstadoSincronizacion.SIN_CONEXION) Lucide.CloudOff else Lucide.AlertTriangle, tamano = 16.dp, color = c.warnInk)
        Text(texto, style = LukApp.tipo.xs, color = c.warnInk)
    }
}

/**
 * Estado honesto de una sección que todavía no tiene versión nativa. Solo
 * existe en esta compilación de desarrollo: la app publicada sigue siendo la
 * WebView hasta alcanzar paridad (docs/android/MIGRACION.md).
 */
@Composable
private fun PantallaSinMigrar(seccion: Seccion) {
    val c = LukApp.colores
    Column(Modifier.fillMaxWidth().padding(top = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(seccion.etiqueta, style = LukApp.tipo.tituloXl, color = c.ink)
        Text(
            "Esta sección todavía no está migrada a la app nativa. Mientras tanto se usa en la app publicada.",
            Modifier.padding(top = 12.dp), style = LukApp.tipo.secundario, color = c.inkSoft, textAlign = TextAlign.Center,
        )
    }
}

/**
 * La barra de anotar con todo lo que abre: capa de dictado, Captura y avisos.
 * Como en LukAppApp.tsx, la barra se oculta en Asesor y Más y con cualquier capa abierta.
 */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.CapaAnotar(
    anotar: app.lukapp.ui.anotar.ModeloAnotar,
    vista: VistaInicio,
    seccion: Seccion,
    estadoGuardado: String,
    alGuardado: (String) -> Unit,
) {
    val dictado by anotar.dictado.collectAsState()
    val pendiente by anotar.pendiente.collectAsState()
    val aviso by anotar.aviso.collectAsState()
    val detalle by anotar.detalle.collectAsState()
    val editando by anotar.editando.collectAsState()
    val guardado by anotar.guardado.collectAsState()
    val contexto = androidx.compose.ui.platform.LocalContext.current
    val hapticos = rememberHapticos()
    val pedirMicrofono = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { concedido ->
        anotar.microfonoBloqueado(!concedido)
        if (concedido) { hapticos.disparar(Haptico.HEAVY); anotar.empezarDictado() }
    }
    val alMicrofono: () -> Unit = {
        when {
            dictado.fase == app.lukapp.ui.anotar.FaseDictado.PROCESANDO -> {}
            androidx.core.content.ContextCompat.checkSelfPermission(contexto, android.Manifest.permission.RECORD_AUDIO) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED -> { hapticos.disparar(Haptico.HEAVY); anotar.empezarDictado() }
            // El permiso se pide al tocar el micrófono, nunca al abrir la app.
            else -> pedirMicrofono.launch(android.Manifest.permission.RECORD_AUDIO)
        }
    }
    val hayCapa = dictado.abierto || pendiente != null || aviso != null || detalle != null || editando != null
    if (!hayCapa && seccion != Seccion.ASESOR && seccion != Seccion.AJUSTES) {
        app.lukapp.ui.anotar.BarraAnotar(
            escuchando = false,
            procesando = false,
            bloqueado = dictado.microfonoBloqueado,
            alManual = anotar::abrirManual,
            alMicrofono = alMicrofono,
            // 12dp sobre la barra inferior de 60dp (`--fin-nav-h + 0.75rem`).
            modifier = Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.navigationBars).padding(bottom = 72.dp),
        )
    }
    if (dictado.abierto) {
        app.lukapp.ui.anotar.CapaDictado(
            estado = dictado,
            alCancelar = { hapticos.disparar(Haptico.LIGHT); anotar.cancelarDictado() },
            alTerminar = { hapticos.disparar(Haptico.MEDIUM); anotar.terminarDictado() },
            alContinuar = anotar::continuarConTexto,
            alEscribir = { anotar.cancelarDictado(); anotar.abrirManual() },
        )
    }
    val p = pendiente
    if (p != null) {
        app.lukapp.ui.anotar.PantallaCaptura(
            parsed = p,
            libro = vista.libro,
            catalogo = vista.catalogo,
            cuentaPorDefecto = vista.ajustes.cuentaFavoritaId,
            alGuardar = { b ->
                val ok = anotar.guardar(b)
                if (ok) alGuardado(b.occurredOn ?: app.lukapp.dominio.bogotaDate())
                ok
            },
            alCancelar = anotar::cerrarCaptura,
            alReintentarVoz = if (p.raw.isNotBlank()) ({ anotar.cerrarCaptura(); alMicrofono() }) else null,
        )
    }
    val d = detalle
    if (d != null) {
        app.lukapp.ui.anotar.DetalleMovimiento(d, vista.catalogo, vista.libro, vista.hoy, alCerrar = anotar::cerrarDetalle, alEditar = { anotar.editar(d) }, alBorrar = { anotar.borrar(d.id) })
    }
    val e = editando
    if (e != null) {
        app.lukapp.ui.anotar.HojaEditar(
            tx = e, libro = vista.libro, catalogo = vista.catalogo,
            alGuardar = { b ->
                val ok = anotar.actualizar(e, b)
                // Si el día cambió de período, saltar a donde quedó (handleUpdate).
                if (ok) alGuardado(b.occurredOn ?: e.occurredOn)
                ok
            },
            alCancelar = anotar::cerrarEdicion,
        )
    }
    app.lukapp.ui.anotar.AvisoGuardado(
        guardado = guardado,
        estado = estadoGuardado,
        alDeshacer = anotar::deshacer,
        alCerrar = anotar::cerrarGuardado,
        // `pb-[safe-bottom + 7rem]`: encima de la barra de anotar y la de navegación.
        modifier = Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.navigationBars).padding(bottom = 112.dp),
    )
    val a = aviso
    if (a != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = anotar::cerrarAviso,
            confirmButton = { androidx.compose.material3.TextButton(onClick = { anotar.cerrarAviso(); anotar.abrirManual() }) { Text("Anotar a mano") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = anotar::cerrarAviso) { Text("Cerrar") } },
            text = { Text(a, style = LukApp.tipo.secundario) },
        )
    }
}
