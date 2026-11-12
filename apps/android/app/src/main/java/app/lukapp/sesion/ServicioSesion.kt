package app.lukapp.sesion

import android.content.Intent
import app.lukapp.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** El mismo deep link que REDIRECCION_NATIVA en useSesion.ts y en la app Expo. */
const val REDIRECCION_NATIVA = "lukapp://auth/callback"

/**
 * Las operaciones de cuenta de `useSesion.ts`, sobre supabase-kt.
 * Devuelven null si salió bien o el mensaje ya traducido si no: la pantalla solo
 * tiene que mostrarlo, igual que `sesion.error` en la web.
 */
class ServicioSesion(private val supabase: SupabaseClient, private val http: HttpClient) {

    val estado: StateFlow<SessionStatus> get() = supabase.auth.sessionStatus

    private val _enRecuperacion = MutableStateFlow(false)
    /** Se llegó desde el enlace "restaurar contraseña": hay que pedir la nueva antes de entrar. */
    val enRecuperacion: StateFlow<Boolean> = _enRecuperacion.asStateFlow()

    fun finalizarRecuperacion() { _enRecuperacion.value = false }

    val correo: String? get() = supabase.auth.currentUserOrNull()?.email

    val idUsuario: String? get() = supabase.auth.currentUserOrNull()?.id

    suspend fun entrar(identidad: String, contrasena: String): String? = intentar {
        // El alias público demo corresponde únicamente a la cuenta de demostración.
        val correo = if (identidad.trim().lowercase() == "demo") "demofestech@lukapp.app" else identidad.trim()
        supabase.auth.signInWith(Email) { email = correo; password = contrasena }
    }

    /** El apodo va en la metadata porque el trigger `crear_perfil` lo copia a `perfiles`. */
    suspend fun registrarse(correo: String, contrasena: String, usuario: String): String? = intentar {
        supabase.auth.signUpWith(Email, redirectUrl = REDIRECCION_NATIVA) {
            email = correo.trim()
            password = contrasena
            if (usuario.isNotBlank()) data = buildJsonObject { put("usuario", usuario.trim()) }
        }
    }

    suspend fun recuperarContrasena(correo: String): String? {
        val error = intentar { supabase.auth.resetPasswordForEmail(correo.trim(), redirectUrl = REDIRECCION_NATIVA) }
        if (error == null) avisarContrasenaCambiada()
        return error
    }

    suspend fun actualizarContrasena(nueva: String): String? = intentar {
        supabase.auth.updateUser { password = nueva }
    }

    /** Ante un fallo de red devuelve true: el índice único de la base es quien manda (useSesion.ts). */
    suspend fun usuarioDisponible(usuario: String): Boolean = runCatching {
        supabase.postgrest.rpc("usuario_disponible", buildJsonObject { put("nombre", usuario.trim()) })
            .data.trim().let { it == "true" }
    }.getOrDefault(true)

    suspend fun salir(): String? = intentar { supabase.auth.signOut() }

    /**
     * Correos de confirmación y de recuperación vuelven por lukapp://auth/callback.
     * `type=recovery` puede venir en el fragmento o en la query según el flujo.
     */
    fun manejarEnlace(intent: Intent) {
        val datos = intent.data ?: return
        if (datos.scheme != "lukapp") return
        val texto = datos.toString()
        if ("type=recovery" in texto) _enRecuperacion.value = true
        supabase.handleDeeplinks(intent)
    }

    private suspend fun avisarContrasenaCambiada() {
        val token = supabase.auth.currentAccessTokenOrNull() ?: return
        runCatching {
            http.post("${BuildConfig.API_URL}/api/mi-cuenta/contrasena-cambiada") { header("Authorization", "Bearer $token") }
        }
    }

    private suspend fun intentar(bloque: suspend () -> Unit): String? = try {
        withTimeout(LIMITE_MS) { bloque() }
        null
    } catch (_: TimeoutCancellationException) {
        "El servidor no respondió. Revisa tu conexión e inténtalo de nuevo."
    } catch (e: Exception) {
        traducirErrorSesion(e.message.orEmpty(), e is java.io.IOException)
    }

    private companion object { const val LIMITE_MS = 12_000L }
}

/** `traducir` de useSesion.ts:370+, con los mismos textos. */
internal fun traducirErrorSesion(mensaje: String, esRed: Boolean = false): String {
    val m = mensaje.lowercase()
    return when {
        esRed || "failed to fetch" in m || "networkerror" in m || "load failed" in m ||
            "network request failed" in m || "unable to resolve host" in m ->
            "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
        "invalid login credentials" in m -> "Correo o contraseña incorrectos."
        "email not confirmed" in m -> "Confirma tu correo antes de entrar."
        "unsupported provider" in m || "provider is not enabled" in m ->
            "El acceso con Google todavía no está habilitado. Inténtalo con tu correo."
        "user already registered" in m -> "Ese correo ya tiene una cuenta."
        "password should be at least" in m -> "La contraseña debe tener al menos 6 caracteres."
        "unable to validate email address" in m -> "Ese correo no parece válido."
        "rate limit" in m || "too many" in m -> "Demasiados intentos. Espera un momento."
        else -> mensaje.ifBlank { "No se pudo completar la operación." }
    }
}
