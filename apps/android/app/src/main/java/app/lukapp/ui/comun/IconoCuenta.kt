package app.lukapp.ui.comun

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.ClaseCuenta
import app.lukapp.dominio.EntidadFinanciera
import app.lukapp.dominio.claseDeCuenta
import app.lukapp.dominio.entidadDeCuenta
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import coil3.compose.AsyncImage

/** `#RRGGBB` → Color. */
fun colorHex(hex: String): Color = Color(android.graphics.Color.parseColor(hex))

/** `REGISTRO` de cajitaIconos.ts: íconos permitidos para cajitas; cualquier otro valor cae en PiggyBank. */
private val ICONOS_CAJITA = setOf("Wallet", "PiggyBank", "Tent", "Car", "Home", "GraduationCap", "Laptop", "Gift", "LifeBuoy", "Gem", "Plane", "Target")

fun iconoDeCajita(nombre: String?): IconoLucide =
    nombre?.takeIf { it in ICONOS_CAJITA }?.let { Lucide.porNombre[it] } ?: Lucide.PiggyBank

/**
 * El logo de la entidad pintado con un color, como la máscara CSS de IconoCuenta.tsx:
 * se toma la forma (alfa) del archivo y se rellena con `color`. Para los logos con
 * `luminanciaLogo` (Rappi) la forma sale del brillo, como `mask-mode: luminance`.
 */
private fun filtroMascara(color: Color, porLuminancia: Boolean): ColorFilter {
    val r = color.red * 255; val g = color.green * 255; val b = color.blue * 255
    val alfa = if (porLuminancia) floatArrayOf(0.2126f, 0.7152f, 0.0722f, 0f, 0f) else floatArrayOf(0f, 0f, 0f, 1f, 0f)
    return ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(
        0f, 0f, 0f, 0f, r,
        0f, 0f, 0f, 0f, g,
        0f, 0f, 0f, 0f, b,
    ) + alfa))
}

@Composable
private fun LogoEntidad(entidad: EntidadFinanciera, tamano: Dp, color: Color) {
    val filtro = remember(color, entidad.luminanciaLogo) { filtroMascara(color, entidad.luminanciaLogo) }
    // `encajeLogo: 'auto N%'` = alto al N % y ancho proporcional; `posicionLogo` alinea (izquierda en Davivienda).
    val porcentaje = entidad.encajeLogo?.let { Regex("""auto (\d+)%""").find(it)?.groupValues?.get(1)?.toFloatOrNull() }
    val alineacion = if (entidad.posicionLogo?.startsWith("left") == true) Alignment.CenterStart else Alignment.Center
    Box(Modifier.size(tamano).clipToBounds(), contentAlignment = alineacion) {
        AsyncImage(
            model = "file:///android_asset${entidad.logo}",
            contentDescription = null,
            colorFilter = filtro,
            // Con `auto N%` el logo se escala por el alto y lo que sobra a lo ancho se recorta, como la máscara CSS.
            contentScale = if (porcentaje != null) ContentScale.FillHeight else ContentScale.Fit,
            alignment = alineacion,
            modifier = if (porcentaje != null) Modifier.fillMaxWidth().fillMaxHeight(porcentaje / 100f) else Modifier.size(tamano),
        )
    }
}

/** IconoCuenta.tsx: logo de la entidad si se reconoce, si no el ícono según la clase de cuenta o el de la cajita. */
@Composable
fun IconoCuenta(cuenta: Cajita, tamano: Dp = 20.dp, color: Color, grosor: Float = 1.8f) {
    val entidad = entidadDeCuenta(cuenta)
    if (entidad != null) {
        LogoEntidad(entidad, tamano, color)
        return
    }
    val clase = claseDeCuenta(cuenta)
    val icono = if (cuenta.tipo == "cuenta" && cuenta.icon == "PiggyBank") {
        when (clase) { ClaseCuenta.EFECTIVO -> Lucide.Wallet; ClaseCuenta.BILLETERA -> Lucide.Smartphone; else -> Lucide.Landmark }
    } else iconoDeCajita(cuenta.icon)
    Icono(icono, tamano = tamano, grosor = grosor, color = color)
}
