package app.lukapp.ui.tema

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.dp

/** Lo que el usuario elige en Más → Apariencia; mismo valor que `finanzas:tema` en la web. */
enum class PreferenciaTema(val valor: String) {
    SISTEMA("sistema"), CLARO("claro"), OSCURO("oscuro");

    companion object {
        fun de(valor: String?) = entries.firstOrNull { it.valor == valor } ?: SISTEMA
    }
}

/** Radios y medidas de lukapp.css:166-189. */
object Medidas {
    val rControl = 12.dp
    val rCard = 20.dp
    val rSheet = 32.dp
    val tap = 44.dp
    val navAlto = 60.dp
    val formaControl = RoundedCornerShape(rControl)
    val formaCard = RoundedCornerShape(rCard)
    val formaHoja = RoundedCornerShape(topStart = rSheet, topEnd = rSheet)
    val formaPildora = RoundedCornerShape(percent = 50)
}

private val LocalColores = staticCompositionLocalOf { ColoresClaros }

object LukApp {
    val colores: ColoresLukApp
        @Composable @ReadOnlyComposable get() = LocalColores.current
    val tipo = TipografiaLukApp
}

/**
 * Tema de LukApp. Material 3 queda solo como infraestructura (ripple, campos de
 * texto, diálogos del sistema); sus colores se alimentan de los tokens propios
 * para que ningún componente de Material aparezca con el morado de Google.
 */
@Composable
fun TemaLukApp(preferencia: PreferenciaTema, contenido: @Composable () -> Unit) {
    val oscuro = when (preferencia) {
        PreferenciaTema.SISTEMA -> isSystemInDarkTheme()
        PreferenciaTema.CLARO -> false
        PreferenciaTema.OSCURO -> true
    }
    val destino = if (oscuro) ColoresOscuros else ColoresClaros
    // La web cambia de tema con una transición de 0.3s (useTema.ts:44-52); se anima solo el fondo y la tinta,
    // que es lo que el ojo percibe; el resto cambia al instante como en un navegador lento.
    val fondo by animateColorAsState(destino.bg, tween(300), label = "fondo")
    val tinta by animateColorAsState(destino.ink, tween(300), label = "tinta")
    val colores = destino.copy(bg = fondo, ink = tinta)

    val esquema = if (oscuro) {
        darkColorScheme(primary = colores.accent, onPrimary = colores.onAccent, background = colores.bg,
            surface = colores.surface, onSurface = colores.ink, onBackground = colores.ink, error = colores.salio,
            outline = colores.line, surfaceVariant = colores.soft, onSurfaceVariant = colores.inkSoft)
    } else {
        lightColorScheme(primary = colores.accent, onPrimary = colores.onAccent, background = colores.bg,
            surface = colores.surface, onSurface = colores.ink, onBackground = colores.ink, error = colores.salio,
            outline = colores.line, surfaceVariant = colores.soft, onSurfaceVariant = colores.inkSoft)
    }
    CompositionLocalProvider(LocalColores provides colores) {
        MaterialTheme(colorScheme = esquema) {
            CompositionLocalProvider(LocalTextStyle provides TipografiaLukApp.cuerpo.copy(color = colores.ink)) {
                contenido()
            }
        }
    }
}
