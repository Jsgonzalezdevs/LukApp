package app.lukapp.ui.anotar

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp

/** `.fin-dictado-bg` (premium-effects.css:127-131). */
private val FondoDictado = listOf(Color(0xFFFF5C92), Color(0xFFD4025A), Color(0xFF9A4FC7), Color(0xFF772AEA))

/**
 * DictadoOverlay.tsx: pantalla completa con el degradado rosa-morado que
 * "respira" (9 s), la onda que sigue la voz, el texto que se revela y los
 * botones Cancelar / Terminé / Revisar movimiento.
 */
@Composable
fun CapaDictado(
    estado: EstadoDictado,
    alCancelar: () -> Unit,
    alTerminar: () -> Unit,
    alContinuar: () -> Unit,
    alEscribir: () -> Unit,
) {
    BackHandler(onBack = alCancelar)
    val respirar = rememberInfiniteTransition(label = "respirar")
    val t by respirar.animateFloat(0f, 1f, infiniteRepeatable(tween(4500, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "t")
    val palabras = estado.texto.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    Column(
        Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(
                // radial-gradient(120% 90% at 25% 8%) que se desplaza de 0% 0% a 100% 60%.
                Brush.radialGradient(FondoDictado, center = Offset(250f + 700f * t, 150f + 900f * t), radius = 2200f),
            )
            .semantics { contentDescription = "Dictando movimiento" },
    ) {
        Column(
            Modifier.weight(1f).fillMaxWidth().statusBarsPadding().padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when {
                estado.fase == FaseDictado.ERROR -> {
                    Icono(Lucide.AlertTriangle, tamano = 32.dp, grosor = 2f, color = Color.White.copy(.9f))
                    Text(estado.error ?: "Algo no salió bien.", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(20, 600, 1.375f), color = Color.White, textAlign = TextAlign.Center)
                    Text(
                        "Escribir el movimiento",
                        Modifier.padding(top = 20.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).pulsable(alPulsar = alEscribir).padding(horizontal = 16.dp, vertical = 12.dp),
                        style = LukApp.tipo.de(16, 600), color = Color.Black,
                    )
                }
                palabras.isNotEmpty() -> {
                    Text(
                        when (estado.fase) { FaseDictado.ESCUCHANDO -> "SIGO ESCUCHANDO"; FaseDictado.PROCESANDO -> "PREPARANDO EL TEXTO"; else -> "ESTO FUE LO QUE ENTENDÍ" },
                        Modifier.clip(CircleShape).background(Color.Black.copy(.15f)).padding(horizontal = 16.dp, vertical = 8.dp),
                        style = LukApp.tipo.de(13, 700, 1.3f, 0.12f), color = Color.White.copy(.85f),
                    )
                    val definitivo = estado.fase == FaseDictado.REVELANDO
                    Text(
                        estado.texto.trim(),
                        Modifier.padding(top = 20.dp).heightIn(max = 380.dp).verticalScroll(rememberScrollState()),
                        style = LukApp.tipo.de(28, 700, 1.25f).copy(fontStyle = if (definitivo) FontStyle.Normal else FontStyle.Italic),
                        color = if (definitivo) Color.White else Color.White.copy(.6f), textAlign = TextAlign.Center,
                    )
                    Text(
                        "Si quedó bien, confirma para revisar el movimiento antes de guardarlo.",
                        Modifier.padding(top = 20.dp).widthIn(max = 384.dp),
                        style = LukApp.tipo.de(15, 500, 1.625f), color = Color.White.copy(.75f), textAlign = TextAlign.Center,
                    )
                }
                else -> {
                    Text(
                        if (estado.fase == FaseDictado.PROCESANDO) "Un momento…" else "Cuéntame qué gastaste o qué te llegó",
                        style = LukApp.tipo.de(20, 600, 1.375f), color = Color.White.copy(.75f), textAlign = TextAlign.Center,
                    )
                    if (estado.fase == FaseDictado.ESCUCHANDO) {
                        Text(
                            "También puedes abonar tarjetas, mover plata entre cuentas y cajitas, actualizar saldos o registrar rendimientos.",
                            Modifier.padding(top = 12.dp).widthIn(max = 384.dp),
                            style = LukApp.tipo.de(15, 500, 1.625f), color = Color.White.copy(.65f), textAlign = TextAlign.Center,
                        )
                        Text(
                            "Habla con calma. Al terminar, toca Terminé para ver el texto.",
                            Modifier.padding(top = 20.dp).clip(CircleShape).background(Color.Black.copy(.15f)).padding(horizontal = 16.dp, vertical = 8.dp),
                            style = LukApp.tipo.de(13, 600, 1.3f), color = Color.White.copy(.85f), textAlign = TextAlign.Center,
                        )
                    }
                    Row(Modifier.padding(top = 40.dp).height(64.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (estado.fase == FaseDictado.PROCESANDO) {
                            val salto = rememberInfiniteTransition(label = "puntos")
                            (0..2).forEach { i ->
                                val y by salto.animateFloat(0f, -10f, infiniteRepeatable(tween(450, delayMillis = i * 150), RepeatMode.Reverse), label = "y$i")
                                Box(Modifier.offset(y = y.dp).size(12.dp).clip(CircleShape).background(Color.White.copy(.8f)))
                            }
                        } else {
                            listOf(0.35f, 0.6f, 1f, 0.6f, 0.35f).forEach { base ->
                                val alto by animateDpAsState((14 + base * estado.nivel * 46 + base * 10).dp, tween(90), label = "onda")
                                Box(Modifier.width(8.dp).height(alto).clip(CircleShape).background(Color.White))
                            }
                        }
                    }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 32.dp, end = 32.dp, bottom = 24.dp),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(56.dp).clip(CircleShape).background(Color.White.copy(.2f)).semantics { contentDescription = "Cancelar dictado" }.pulsable(escala = 0.9f, alPulsar = alCancelar),
                contentAlignment = Alignment.Center,
            ) { Icono(Lucide.X, tamano = 24.dp, grosor = 2.5f, color = Color.White) }
            AnimatedContent(
                targetState = estado.fase,
                transitionSpec = { (fadeIn(tween(200)) + scaleIn(tween(200), 0.7f)) togetherWith (fadeOut(tween(200)) + scaleOut(tween(200), 0.7f)) },
                label = "accion",
            ) { fase ->
                when (fase) {
                    FaseDictado.ESCUCHANDO -> BotonCapa("Terminé", Lucide.Square, "Terminé de hablar", relleno = true, alPulsar = alTerminar)
                    FaseDictado.REVELANDO -> BotonCapa("Revisar movimiento", Lucide.Check, "Confirmar texto y revisar movimiento", alPulsar = alContinuar)
                    else -> Spacer(Modifier.size(64.dp))
                }
            }
        }
    }
}

@Composable
private fun BotonCapa(texto: String, icono: app.lukapp.ui.iconos.IconoLucide, descripcion: String, relleno: Boolean = false, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.height(64.dp).shadow(28.dp, CircleShape, ambientColor = Color.Black.copy(.35f)).clip(CircleShape).background(c.salio)
            .semantics { contentDescription = descripcion }.pulsable(escala = 0.9f, alPulsar = alPulsar).padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Icono(icono, tamano = if (relleno) 16.dp else 20.dp, grosor = if (relleno) 2.5f else 3f, color = Color.White, relleno = if (relleno) Color.White else null)
        Text(texto, style = LukApp.tipo.de(15, 700), color = Color.White)
    }
}
