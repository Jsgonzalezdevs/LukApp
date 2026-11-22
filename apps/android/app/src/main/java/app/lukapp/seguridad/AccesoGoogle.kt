package app.lukapp.seguridad

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import app.lukapp.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * "Continuar con Google" nativo: Credential Manager muestra el selector de cuentas
 * del sistema y devuelve un ID token que se canjea en Supabase Auth.
 *
 * Que Google diga quién es la persona no la autentica en LukApp: la sesión solo
 * existe cuando Supabase valida el token (audiencia = client id web configurado en
 * el proveedor Google del proyecto) y emite su propio JWT. Supabase enlaza por
 * correo verificado, así que quien ya tenía cuenta con ese correo entra a la misma
 * cuenta y no se duplica.
 */
class AccesoGoogle(private val supabase: SupabaseClient) {

    sealed interface Resultado {
        data object Listo : Resultado
        data object Cancelado : Resultado
        data class Error(val mensaje: String) : Resultado
    }

    val configurado: Boolean get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

    suspend fun entrar(contexto: Context): Resultado {
        if (!configurado) return Resultado.Error("El acceso con Google todavía no está disponible en esta versión.")

        // El nonce crudo va a Supabase y su SHA-256 a Google: así un token robado
        // de otra app no se puede reutilizar para entrar aquí.
        val nonceCrudo = ByteArray(32).also(SecureRandom()::nextBytes).joinToString("") { "%02x".format(it) }
        val nonceHash = MessageDigest.getInstance("SHA-256").digest(nonceCrudo.toByteArray())
            .joinToString("") { "%02x".format(it) }

        val opcion = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setNonce(nonceHash)
            .build()

        val credencial = try {
            CredentialManager.create(contexto)
                .getCredential(contexto, GetCredentialRequest.Builder().addCredentialOption(opcion).build())
                .credential
        } catch (_: GetCredentialCancellationException) {
            return Resultado.Cancelado
        } catch (_: NoCredentialException) {
            return Resultado.Error("No encontramos una cuenta de Google en este teléfono.")
        } catch (e: GetCredentialException) {
            return Resultado.Error("No pudimos abrir Google. Intenta de nuevo.")
        }

        if (credencial !is CustomCredential || credencial.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            return Resultado.Error("Google devolvió una respuesta que no reconocemos.")
        }
        val token = GoogleIdTokenCredential.createFrom(credencial.data).idToken

        return runCatching {
            supabase.auth.signInWith(IDToken) {
                idToken = token
                provider = Google
                nonce = nonceCrudo
            }
            Resultado.Listo
        }.getOrElse { Resultado.Error("Google te reconoció, pero LukApp no pudo abrir tu sesión. Intenta de nuevo.") }
    }

    /** Olvida la cuenta elegida para que el próximo "Continuar con Google" vuelva a preguntar. */
    suspend fun olvidarCuenta(contexto: Context) {
        runCatching { CredentialManager.create(contexto).clearCredentialState(androidx.credentials.ClearCredentialStateRequest()) }
    }
}
