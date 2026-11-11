package app.lukapp

import android.content.Context
import app.lukapp.datos.Preferencias
import app.lukapp.datos.PreferenciasCuenta
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

    val accesoGoogle = AccesoGoogle(supabase)
    val http = HttpClient(OkHttp)
    val sesion = ServicioSesion(supabase, http)
    val preferencias = Preferencias(app)
    val finanzas = RepositorioFinanzas(supabase, app)
    val preferenciasCuenta = PreferenciasCuenta(supabase)
}
