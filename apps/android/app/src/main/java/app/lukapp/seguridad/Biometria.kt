package app.lukapp.seguridad

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Desbloqueo con huella, rostro o el PIN del teléfono.
 *
 * No reemplaza a Supabase: solo decide si se deja ver una sesión que ya existe en
 * el almacén cifrado. Se acepta biometría débil (rostro 2D en muchos gama media)
 * más el PIN como respaldo, porque proteger contra quien toma el teléfono
 * desbloqueado es el objetivo; el token no se libera con la huella.
 */
object Biometria {

    private const val AUTENTICADORES = BIOMETRIC_STRONG or BIOMETRIC_WEAK or DEVICE_CREDENTIAL

    enum class Disponibilidad { LISTA, SIN_CONFIGURAR, SIN_HARDWARE }

    sealed interface Resultado {
        data object Aprobado : Resultado
        data object Cancelado : Resultado
        data class Fallo(val mensaje: String) : Resultado
    }

    fun disponibilidad(actividad: FragmentActivity): Disponibilidad =
        when (BiometricManager.from(actividad).canAuthenticate(AUTENTICADORES)) {
            BiometricManager.BIOMETRIC_SUCCESS -> Disponibilidad.LISTA
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> Disponibilidad.SIN_CONFIGURAR
            else -> Disponibilidad.SIN_HARDWARE
        }

    suspend fun pedir(actividad: FragmentActivity, titulo: String, subtitulo: String): Resultado =
        suspendCancellableCoroutine { continuacion ->
            val aviso = BiometricPrompt(
                actividad,
                ContextCompat.getMainExecutor(actividad),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        if (continuacion.isActive) continuacion.resume(Resultado.Aprobado)
                    }

                    override fun onAuthenticationError(codigo: Int, mensaje: CharSequence) {
                        if (!continuacion.isActive) return
                        val cancelado = codigo == BiometricPrompt.ERROR_USER_CANCELED ||
                            codigo == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            codigo == BiometricPrompt.ERROR_CANCELED
                        continuacion.resume(if (cancelado) Resultado.Cancelado else Resultado.Fallo(mensaje.toString()))
                    }
                },
            )
            aviso.authenticate(
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle(titulo)
                    .setSubtitle(subtitulo)
                    .setAllowedAuthenticators(AUTENTICADORES)
                    .build(),
            )
            continuacion.invokeOnCancellation { aviso.cancelAuthentication() }
        }
}
