package app.lukapp.ui.iconos

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.lukapp.ui.tema.LukApp

/** Un ícono de lucide: trazos en una caja de 24×24, como en la web. */
class IconoLucide(val nombre: String, trazos: List<String>) {
    val caminos: List<Path> by lazy { trazos.map { PathParser().parsePathString(it).toPath() } }
}

/**
 * Dibuja un ícono lucide con el mismo trazo que `<Icon strokeWidth>` de la web:
 * extremos y uniones redondeados, sin relleno, grosor en unidades de la caja de 24.
 * Por defecto 1.8, que es lo que fuerza `.fin-page .lucide` (lukapp.css:851).
 */
@Composable
fun Icono(
    icono: IconoLucide,
    modifier: Modifier = Modifier,
    tamano: Dp = 24.dp,
    grosor: Float = 1.8f,
    color: Color = LukApp.colores.ink,
    descripcion: String? = null,
) {
    val semantica = if (descripcion != null) Modifier.semantics { contentDescription = descripcion } else Modifier
    val caminos = remember(icono) { icono.caminos }
    Canvas(modifier.size(tamano).then(semantica)) {
        val escala = size.minDimension / 24f
        scale(escala, pivot = androidx.compose.ui.geometry.Offset.Zero) {
            val trazo = Stroke(width = grosor, cap = StrokeCap.Round, join = StrokeJoin.Round)
            caminos.forEach { drawPath(it, color, style = trazo) }
        }
    }
}
