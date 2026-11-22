package app.lukapp.ui.comun

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.graphics.Shape
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.material3.Text
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.lukapp.ui.tema.LukApp

/**
 * Toque con el mismo hundimiento que `button:active { transform: scale(.97) }`
 * (lukapp.css:769-772, 80 ms) y sin el ripple gris de Material, que en la web no existe.
 * `escala` permite las variantes `active:scale-95` / `active:scale-90` de cada botón.
 */
fun Modifier.pulsable(
    habilitado: Boolean = true,
    escala: Float = 0.97f,
    rol: Role = Role.Button,
    etiqueta: String? = null,
    alPulsar: () -> Unit,
): Modifier = composed {
    val interaccion = remember { MutableInteractionSource() }
    val presionado by interaccion.collectIsPressedAsState()
    val s by animateFloatAsState(if (presionado && habilitado) escala else 1f, tween(80), label = "pulsar")
    this
        .graphicsLayer { scaleX = s; scaleY = s }
        .clickable(interaccion, indication = null, enabled = habilitado, role = rol, onClickLabel = etiqueta, onClick = alPulsar)
}

/** Botón redondo de cabecera (h-8.5 w-8.5 = 34px, fondo --fin-soft). */
@Composable
fun BotonRedondo(
    descripcion: String,
    modifier: Modifier = Modifier,
    tamano: Dp = 34.dp,
    fondo: Color = LukApp.colores.soft,
    alPulsar: () -> Unit,
    contenido: @Composable () -> Unit,
) {
    Box(
        modifier
            .size(tamano)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .background(fondo)
            .pulsable(escala = 0.95f, etiqueta = descripcion, alPulsar = alPulsar)
            .then(Modifier.semanticsDescripcion(descripcion)),
        contentAlignment = Alignment.Center,
    ) { contenido() }
}

fun Modifier.semanticsDescripcion(texto: String): Modifier =
    this.semantics(mergeDescendants = true) { contentDescription = texto }

/** Pastilla (`rounded-full`) con contenido en fila. */
@Composable
fun Pildora(
    modifier: Modifier = Modifier,
    fondo: Color = LukApp.colores.soft,
    relleno: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    forma: Shape = androidx.compose.foundation.shape.CircleShape,
    separacion: Dp = 8.dp,
    contenido: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier.clip(forma).background(fondo).padding(relleno),
        horizontalArrangement = Arrangement.spacedBy(separacion),
        verticalAlignment = Alignment.CenterVertically,
        content = contenido,
    )
}

/** Emoji con la fuente de color del sistema y line-height 1 (lukapp.css:517-522). */
@Composable
fun Emoji(texto: String, tamano: Int, modifier: Modifier = Modifier) {
    Text(
        texto,
        modifier,
        style = TextStyle(fontSize = tamano.sp, lineHeight = tamano.sp, fontWeight = FontWeight.Normal),
        maxLines = 1,
        overflow = TextOverflow.Clip,
    )
}
