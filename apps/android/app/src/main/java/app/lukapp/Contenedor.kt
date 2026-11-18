package app.lukapp

import android.content.Context
import app.lukapp.datos.Preferencias
import app.lukapp.datos.PreferenciasCuenta
import app.lukapp.datos.ClienteAsesor
import app.lukapp.datos.ClienteEspacios
import app.lukapp.datos.ClienteCuenta
import app.lukapp.datos.ClienteFunciones
import app.lukapp.datos.Transcripcion
import app.lukapp.datos.RepositorioFinanzas
import app.lukapp.seguridad.AccesoGoogle
import app.lukapp.sesion.ServicioSesion
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import app.lukapp.seguridad.AlmacenCifrado
import app.lukapp.seguridad.SesionCifrada
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest

/**
 * Inyección de dependencias a mano.
 *
 * Con una sola actividad y un puñado de servicios, Hilt agregaba KSP, otro plugin
 * de Gradle y tiempo de compilación sin resolver nada que este objeto no resuelva.
 * Si el grafo crece hasta necesitar alcances por pantalla, se migra sin tocar los
 * ViewModels: ya reciben sus dependencias por constructor.
 */
class Contenedor(contexto: Context) {
    private val app = contexto.applicationContext

    val supabase: SupabaseClient = createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY) {
        install(Auth) {
            sessionManager = SesionCifrada(AlmacenCifrado(app, "sesion"))
            scheme = "lukapp"
            host = "auth"
        }
        install(Postgrest)
        install(Functions)
    }

    /**
     * El último usuario que entró, cifrado como la sesión. Si al abrir no hay red para renovar el token,
     * supabase-kt avisa del fallo pero no trae al usuario: con esto se abre su libro local (que sigue
     * cifrado con otra llave) en vez de mandarlo al acceso. Se borra al cerrar sesión.
     */
    val ultimoUsuario = AlmacenCifrado(app, "usuario")

    val accesoGoogle = AccesoGoogle(supabase)
    // HttpTimeout permite el límite de 18 s por petición de la transcripción.
    val http = HttpClient(OkHttp) { install(io.ktor.client.plugins.HttpTimeout) }
    val sesion = ServicioSesion(supabase, http)
    val preferencias = Preferencias(app)
    val finanzas = RepositorioFinanzas(supabase, app)
    val preferenciasCuenta = PreferenciasCuenta(supabase)
    val transcripcion = Transcripcion(supabase, http)
    val asesor = ClienteAsesor(supabase, http)
    val funciones = ClienteFunciones(supabase)
    val espacios = ClienteEspacios(supabase)
    val cuenta = ClienteCuenta(supabase, http)
}
