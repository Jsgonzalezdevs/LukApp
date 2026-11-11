package app.lukapp

import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.lukapp.datos.Preferencias
import app.lukapp.seguridad.Biometria
import app.lukapp.ui.ModeloApp
import app.lukapp.ui.PantallaCarga
import app.lukapp.ui.ShellLukApp
import app.lukapp.ui.acceso.ModeloAcceso
import app.lukapp.ui.acceso.PantallaAcceso
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.PreferenciaTema
import app.lukapp.ui.tema.TemaLukApp
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

/**
 * Única actividad. Decide entre carga, acceso y la app según la sesión de
 * Supabase, y pone el candado biométrico encima cuando la persona lo activó.
 *
 * El candado se pide al abrir en frío y al volver tras más de 30 s fuera: lo
 * bastante para cubrir "dejé el teléfono desbloqueado en la mesa" sin pedir la
 * huella cada vez que se contesta un mensaje.
 */
class ActividadPrincipal : FragmentActivity() {

    private val contenedor by lazy { (application as LukAppAplicacion).contenedor }
    private var bloqueada by mutableStateOf(true)
    private var salioEn = 0L

    private val fabrica by lazy {
        viewModelFactory {
            initializer { ModeloAcceso(contenedor.sesion, contenedor.accesoGoogle, contenedor.preferencias) }
            initializer { ModeloApp(contenedor.finanzas, contenedor.preferenciasCuenta) }
            initializer { app.lukapp.ui.anotar.ModeloAnotar(application, contenedor.finanzas, contenedor.transcripcion) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        intent?.let(contenedor.sesion::manejarEnlace)

        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStop(owner: LifecycleOwner) { salioEn = SystemClock.elapsedRealtime() }
            override fun onStart(owner: LifecycleOwner) {
                if (salioEn != 0L && SystemClock.elapsedRealtime() - salioEn > 30_000) bloqueada = true
            }
        })

        val proveedor = ViewModelProvider(this, fabrica)
        val modeloAcceso = proveedor[ModeloAcceso::class.java]
        val modeloApp = proveedor[ModeloApp::class.java]
        val modeloAnotar = proveedor[app.lukapp.ui.anotar.ModeloAnotar::class.java]

        setContent {
            val temaGuardado by contenedor.preferencias.tema.collectAsState(initial = null)
            val desbloqueo by contenedor.preferencias.desbloqueoBiometrico.collectAsState(initial = false)
            val estadoSesion by contenedor.sesion.estado.collectAsState()
            val enRecuperacion by contenedor.sesion.enRecuperacion.collectAsState()
            val alcance = rememberCoroutineScope()
            val tema = PreferenciaTema.de(temaGuardado)
            val cambiarTema: (PreferenciaTema) -> Unit = { t ->
                alcance.launch { contenedor.preferencias.guardar(Preferencias.Claves.TEMA, t.valor) }
            }

            TemaLukApp(tema) {
                // Con el token vencido al abrir, supabase-kt pasa por RefreshFailure mientras renueva
                // (o mientras no hay red). La sesión sigue guardada y sigue siendo de la persona:
                // como la web, se entra con los datos en caché en vez de mandarla al acceso.
                val uidRenovando = (estadoSesion as? SessionStatus.RefreshFailure)?.let { contenedor.sesion.idUsuario }
                when (val s = estadoSesion) {
                    is SessionStatus.Initializing -> PantallaCarga()
                    is SessionStatus.Authenticated, is SessionStatus.RefreshFailure -> if (s is SessionStatus.RefreshFailure && uidRenovando == null) {
                        val e by modeloAcceso.estado.collectAsState()
                        PantallaAcceso(modeloAcceso, tema, cambiarTema, e)
                    } else if (enRecuperacion) {
                        val e by modeloAcceso.estado.collectAsState()
                        PantallaAcceso(modeloAcceso, tema, cambiarTema, e)
                    } else {
                        val uid = (s as? SessionStatus.Authenticated)?.session?.user?.id ?: uidRenovando
                        LaunchedEffect(uid) { if (uid != null) modeloApp.abrir(uid) }
                        if (desbloqueo && bloqueada) {
                            Candado { pedirHuella() }
                            LaunchedEffect(Unit) { pedirHuella() }
                        } else {
                            ShellLukApp(
                                modelo = modeloApp,
                                anotar = modeloAnotar,
                                alCerrarSesion = {
                                    alcance.launch {
                                        uid?.let(contenedor.finanzas::olvidarLocal)
                                        contenedor.finanzas.cerrar()
                                        contenedor.sesion.salir()
                                        contenedor.accesoGoogle.olvidarCuenta(this@ActividadPrincipal)
                                    }
                                },
                                desbloqueoActivo = desbloqueo,
                                biometriaDisponible = Biometria.disponibilidad(this@ActividadPrincipal) == Biometria.Disponibilidad.LISTA,
                                alCambiarDesbloqueo = { activar -> alcance.launch { cambiarDesbloqueo(activar) } },
                            )
                        }
                    }
                    else -> {
                        val e by modeloAcceso.estado.collectAsState()
                        PantallaAcceso(modeloAcceso, tema, cambiarTema, e)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        contenedor.sesion.manejarEnlace(intent)
    }

    override fun onResume() {
        super.onResume()
        // Lo que se anotó en otro dispositivo aparece al volver, como el refresco al enfocar de la web.
        if (contenedor.sesion.idUsuario != null && !bloqueada) ViewModelProvider(this, fabrica)[ModeloApp::class.java].sincronizar()
    }

    private suspend fun pedirHuella() {
        if (Biometria.disponibilidad(this) != Biometria.Disponibilidad.LISTA) {
            // Si quitaron la huella y el PIN del teléfono, el candado ya no protege nada:
            // se deja pasar en vez de dejar a la persona por fuera de su propia cuenta.
            bloqueada = false
            return
        }
        if (Biometria.pedir(this, "Desbloquear LukApp", "Confirma que eres tú") == Biometria.Resultado.Aprobado) bloqueada = false
    }

    private suspend fun cambiarDesbloqueo(activar: Boolean) {
        // Activar exige probar primero que la huella funciona: evita quedar bloqueado por un sensor roto.
        if (activar && Biometria.pedir(this, "Activar desbloqueo", "Confirma con tu huella, rostro o PIN") != Biometria.Resultado.Aprobado) return
        contenedor.preferencias.guardar(Preferencias.Claves.DESBLOQUEO_BIOMETRICO, activar)
        bloqueada = false
    }
}

@androidx.compose.runtime.Composable
private fun Candado(alPedir: suspend () -> Unit) {
    val c = LukApp.colores
    val alcance = rememberCoroutineScope()
    Box(Modifier.fillMaxSize().background(c.bg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("LukApp está bloqueada", style = LukApp.tipo.titulo, color = c.ink)
            Text(
                "Desbloquear",
                Modifier.background(c.accent, Medidas.formaPildora).pulsable { alcance.launch { alPedir() } }.padding(horizontal = 24.dp, vertical = 12.dp),
                style = LukApp.tipo.cuerpoB, color = c.onAccent, textAlign = TextAlign.Center,
            )
        }
    }
}
