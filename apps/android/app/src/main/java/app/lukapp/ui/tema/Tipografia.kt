package app.lukapp.ui.tema

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.lukapp.R

/** Poppins con los mismos pesos que carga index.html desde Google Fonts. */
val Poppins = FontFamily(
    Font(R.font.poppins_regular, FontWeight.Normal),
    Font(R.font.poppins_medium, FontWeight.Medium),
    Font(R.font.poppins_semibold, FontWeight.SemiBold),
    Font(R.font.poppins_bold, FontWeight.Bold),
    Font(R.font.poppins_extrabold, FontWeight.ExtraBold),
    Font(R.font.poppins_italic, FontWeight.Normal, FontStyle.Italic),
)

// CSS centra el texto dentro del line-height; Compose por defecto agrega el
// relleno de la fuente arriba y abajo. Sin esto todo queda 1–2 px corrido.
private val alineacionCss = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

private fun estilo(peso: Int, tamano: Int, alto: Float, tracking: Float = 0f) = TextStyle(
    fontFamily = Poppins,
    fontWeight = FontWeight(peso),
    fontSize = tamano.sp,
    lineHeight = (tamano * alto).sp,
    letterSpacing = tracking.em,
    lineHeightStyle = alineacionCss,
)

/** La escala `--fin-t-*` (lukapp.css:148-161) y los tamaños Tailwind más usados. */
@Immutable
object TipografiaLukApp {
    val cifra = estilo(700, 44, 1f, -0.03f)
    val tituloXl = estilo(600, 28, 1.15f, -0.02f)
    val titulo = estilo(600, 20, 1.2f, -0.01f)
    val cuerpoB = estilo(600, 17, 1.3f)
    val cuerpo = estilo(400, 17, 1.4f)
    val secundario = estilo(400, 15, 1.35f)
    val pie = estilo(400, 13, 1.3f)

    /** `text-xs` forzado a 13px/1.4 dentro de .fin-page (lukapp.css:843). */
    val xs = estilo(400, 13, 1.4f)

    fun de(tamano: Int, peso: Int = 400, alto: Float = 1.4f, tracking: Float = 0f) = estilo(peso, tamano, alto, tracking)
}
