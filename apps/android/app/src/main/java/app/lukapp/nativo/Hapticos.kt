package app.lukapp.nativo

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Los 7 patrones de `useHapticFeedback.ts:25-33`, en milisegundos y con los
 * mismos nombres. Se usa el Vibrator con forma de onda y no HapticFeedbackConstants
 * porque las constantes del sistema cambian de duración según el fabricante y la
 * web ya definió sus patrones exactos; así "success" se siente igual que en la PWA.
 *
 * La web no tiene ajuste para apagar la vibración: aquí tampoco se inventa uno.
 * Sí se respeta lo que el sistema decida (modo silencio/no molestar, "vibración
 * al tocar" desactivada): el Vibrator de Android ya lo filtra con los atributos
 * de uso táctil.
 */
enum class Haptico(val patron: LongArray) {
    LIGHT(longArrayOf(10)),
    MEDIUM(longArrayOf(30)),
    HEAVY(longArrayOf(50)),
    SUCCESS(longArrayOf(30, 20, 30)),
    ERROR(longArrayOf(80, 30, 80)),
    WARNING(longArrayOf(40, 30, 40, 30, 40)),
    SELECTION(longArrayOf(15, 10, 15)),
}

class Hapticos(contexto: Context) {
    private val vibrador: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (contexto.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        contexto.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    fun disparar(tipo: Haptico) {
        val v = vibrador?.takeIf { it.hasVibrator() } ?: return
        // navigator.vibrate([v, p, v…]) empieza vibrando; createWaveform empieza en pausa: se antepone un 0.
        val efecto = if (tipo.patron.size == 1) {
            VibrationEffect.createOneShot(tipo.patron[0], VibrationEffect.DEFAULT_AMPLITUDE)
        } else {
            VibrationEffect.createWaveform(longArrayOf(0) + tipo.patron, -1)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            v.vibrate(efecto, android.os.VibrationAttributes.createForUsage(android.os.VibrationAttributes.USAGE_TOUCH))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(efecto)
        }
    }
}

@Composable
fun rememberHapticos(): Hapticos {
    val contexto = LocalContext.current
    return remember(contexto) { Hapticos(contexto.applicationContext) }
}
