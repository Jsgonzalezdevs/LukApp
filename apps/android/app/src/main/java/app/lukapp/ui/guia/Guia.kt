package app.lukapp.ui.guia

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateRectAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/** Dónde está en pantalla cada elemento señalable. Es el único acoplamiento entre la guía y las pantallas. */
class AnclasGuia { val cajas = mutableStateMapOf<String, Rect>() }

val LocalAnclasGuia = staticCompositionLocalOf<AnclasGuia?> { null }

/** Marca un elemento como señalable por la guía (el `data-guia` de la web). Sin guía montada no cuesta nada. */
fun Modifier.anclaGuia(id: String): Modifier = composed {
    val anclas = LocalAnclasGuia.current
    if (anclas == null) this else {
        DisposableEffect(id) { onDispose { anclas.cajas.remove(id) } }
        this.onGloballyPositioned { anclas.cajas[id] = it.boundsInWindow() }
    }
}

private const val ANCHO_GLOBO = 320
private const val SEPARACION = 14
private const val ESPACIO_MINIMO = 210
private const val MARGEN = 16
private val VELO = Color(0xA80C0A09)

/**
 * GuiaApp.tsx: los globos que explican la app señalando la app. Oscurece todo menos el elemento señalado (con el
 * recorte animado) y le pone al lado una tarjeta que va debajo, o encima si no cabe. Con el ancla ausente la tarjeta
 * sale centrada y sin recorte. Diferencia: lo señalado no se puede tocar mientras dura el globo.
 */
@Composable
fun GuiaApp(pasos: List<PasoGuia>, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val anclas = LocalAnclasGuia.current
    var indice by remember { mutableIntStateOf(0) }
    val paso = pasos[indice.coerceIn(0, pasos.lastIndex)]
    val ultimo = indice >= pasos.lastIndex
    val d = LocalDensity.current
    var origen by remember { mutableStateOf(Offset.Zero) }

    // El ancla mide en coordenadas de la ventana; la capa puede empezar más abajo (barras del sistema).
    val bruta = anclas?.cajas?.get(paso.ancla)?.takeIf { it.width > 0 && it.height > 0 }
    val caja = bruta?.translate(-origen)
    val aire = with(d) { paso.aire.dp.toPx() }
    val destino = caja?.let { Rect(it.left - aire, it.top - aire, it.right + aire, it.bottom + aire) } ?: Rect.Zero
    val animada by animateRectAsState(destino, tween(420), label = "recorte")

    BoxWithConstraints(
        Modifier.fillMaxSize().onGloballyPositioned { origen = it.positionInWindow() }
            // Lo de debajo no recibe toques mientras el globo está abierto.
            .pointerInput(Unit) { detectTapGestures { } },
    ) {
        val anchoPx = with(d) { maxWidth.toPx() }
        val altoPx = with(d) { maxHeight.toPx() }
        Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
            drawRect(VELO)
            if (caja != null) {
                val radio = with(d) { paso.radio.dp.toPx() }.coerceAtMost(minOf(animada.width, animada.height) / 2)
                drawRoundRect(Color.Black, animada.topLeft, Size(animada.width, animada.height), CornerRadius(radio), blendMode = BlendMode.Clear)
                // Anillo blanco translúcido: el velo es oscuro en los dos temas, así que un borde claro se ve en ambos.
                drawRoundRect(Color.White.copy(alpha = 0.5f), animada.topLeft, Size(animada.width, animada.height), CornerRadius(radio), style = Stroke(with(d) { 2.dp.toPx() }))
            }
        }

        val ancho = minOf(ANCHO_GLOBO.dp, maxWidth - (MARGEN * 2).dp)
        val anchoGloboPx = with(d) { ancho.toPx() }
        val modificadorGlobo: Modifier = if (caja == null) Modifier.align(Alignment.Center) else {
            val abajo = altoPx - (caja.bottom)
            val debajo = abajo > with(d) { ESPACIO_MINIMO.dp.toPx() }
            val izquierda = (caja.center.x - anchoGloboPx / 2).coerceIn(with(d) { MARGEN.dp.toPx() }, maxOf(with(d) { MARGEN.dp.toPx() }, anchoPx - with(d) { MARGEN.dp.toPx() } - anchoGloboPx))
            if (debajo) Modifier.align(Alignment.TopStart).offset { androidx.compose.ui.unit.IntOffset(izquierda.toInt(), (caja.bottom + aire + with(d) { SEPARACION.dp.toPx() }).toInt()) }
            else Modifier.align(Alignment.BottomStart).offset { androidx.compose.ui.unit.IntOffset(izquierda.toInt(), -(altoPx - caja.top + aire + with(d) { SEPARACION.dp.toPx() }).toInt()) }
        }

        Column(
            modificadorGlobo.width(ancho).clip(Medidas.formaCard).background(c.card).padding(20.dp)
                .semantics { contentDescription = paso.titulo },
        ) {
            Text(paso.titulo, style = LukApp.tipo.de(17, 600, 1.3f, -0.02f), color = c.ink)
            Text(paso.texto, Modifier.padding(top = 6.dp), style = LukApp.tipo.de(14, 400, 1.6f), color = c.inkSoft)
            Row(Modifier.padding(top = 16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    pasos.indices.forEach { i -> Box(Modifier.width(if (i == indice) 16.dp else 6.dp).height(6.dp).clip(CircleShape).background(if (i == indice) c.ink else c.inkGhost)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (!ultimo) Text("Saltar", Modifier.clip(CircleShape).semantics { contentDescription = "Saltar" }.pulsable(alPulsar = alCerrar).padding(horizontal = 12.dp, vertical = 8.dp), style = LukApp.tipo.de(14, 600, 1.3f), color = c.inkFaint)
                    Text(
                        if (ultimo) "Entendido" else "Siguiente",
                        Modifier.clip(CircleShape).background(c.accent).semantics { contentDescription = if (ultimo) "Entendido" else "Siguiente" }
                            .pulsable(alPulsar = { if (ultimo) alCerrar() else indice += 1 }).padding(horizontal = 16.dp, vertical = 8.dp),
                        style = LukApp.tipo.de(14, 600, 1.3f), color = c.onAccent,
                    )
                }
            }
        }
    }
}
