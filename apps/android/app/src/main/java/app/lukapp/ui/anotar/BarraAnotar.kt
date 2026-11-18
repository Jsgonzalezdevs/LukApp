package app.lukapp.ui.anotar

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import app.lukapp.ui.guia.anclaGuia
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.sobreFondo

/**
 * BotonAnotar.tsx (versión no Premium): cápsula `.fin-glass` con los accesos
 * rápidos y el micrófono rojo de 64dp con sombra `0 10px 28px -8px rgb(190 18 60/.6)`.
 *
 * De los tres accesos rápidos solo está "Anotar a mano": escanear con la cámara
 * (OCR) y Buscar todavía no están migrados y no se muestran botones vacíos.
 */
@Composable
fun BarraAnotar(
    escuchando: Boolean,
    procesando: Boolean,
    bloqueado: Boolean,
    alManual: () -> Unit,
    alMicrofono: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(
            Modifier
                .anclaGuia("anotar")
                .shadow(20.dp, CircleShape, ambientColor = Color.Black.copy(.28f), spotColor = Color.Black.copy(.28f))
                .clip(CircleShape)
                .background(c.sobreFondo(c.glassBg))
                .border(1.dp, c.glassBorder, CircleShape)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(
                Modifier.size(width = 56.dp, height = 48.dp).clip(CircleShape)
                    .semantics { contentDescription = "Anotar a mano" }
                    .pulsable(escala = 0.9f) { hapticos.disparar(Haptico.LIGHT); alManual() },
                contentAlignment = Alignment.Center,
            ) { Icono(Lucide.Keyboard, tamano = 20.dp, grosor = 2.5f, color = c.ink) }
        }
        Box {
            // `animate-pulse` mientras escucha: opacidad 1 → .5 → 1 cada 2 s.
            val pulso = rememberInfiniteTransition(label = "pulso")
            val alfaPulso by pulso.animateFloat(1f, 0.5f, infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "alfa")
            Box(
                Modifier
                    .size(64.dp)
                    .graphicsLayer { alpha = if (procesando || bloqueado) 0.5f else if (escuchando) alfaPulso else 1f }
                    .shadow(28.dp, CircleShape, ambientColor = Color(0xFFBE123C).copy(.6f), spotColor = Color(0xFFBE123C).copy(.6f))
                    .clip(CircleShape)
                    .background(c.salio)
                    .semantics { contentDescription = if (procesando) "Transcribiendo" else if (escuchando) "Dejar de escuchar" else "Anotar hablando" }
                    .pulsable(escala = 0.95f, alPulsar = alMicrofono),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    procesando -> app.lukapp.ui.acceso.Girando(Lucide.Loader2, 24.dp, c.onOut)
                    escuchando -> Icono(Lucide.Square, tamano = 24.dp, grosor = 3f, color = c.onOut)
                    else -> Icono(Lucide.Mic, tamano = 28.dp, grosor = 2.5f, color = c.onOut)
                }
            }
            if (bloqueado) {
                Box(
                    Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-8).dp).size(20.dp).clip(CircleShape).background(c.warn)
                        .semantics { contentDescription = "Micrófono bloqueado" },
                    contentAlignment = Alignment.Center,
                ) { Text("✕", style = LukApp.tipo.de(13, 700, 1f), color = Color.White) }
            }
        }
    }
}
