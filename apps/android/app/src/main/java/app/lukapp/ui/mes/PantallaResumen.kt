package app.lukapp.ui.mes

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.Tono
import app.lukapp.dominio.TarjetaResumen
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.monthKeyLabel
import app.lukapp.dominio.textoParaCompartir
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp

private val FONDO = Color(0xFF0B0B12)
private val BLANCO = Color(0xFFF5F3F0)
private val BIEN = Color(0xFFB6F246)
private val ATENTO = Color(0xFFFF5C92)

private fun colorTono(t: Tono): Color = when (t) { Tono.BIEN -> BIEN; Tono.ATENTO -> ATENTO; Tono.NEUTRAL -> BLANCO }


/** El `Marco` de ResumenWrapped.tsx: icono, etiqueta chica, cifra o frase grande y un detalle debajo. */
@Composable
private fun Marco(icono: IconoLucide, etiqueta: String, color: Color = BLANCO, detalle: String? = null, contenido: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
    ) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(color.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
            Icono(icono, tamano = 28.dp, grosor = 2f, color = color)
        }
        Text(etiqueta.uppercase(), style = LukApp.tipo.de(15, 600, 1.4f, 0.4f), color = Color.White.copy(alpha = 0.6f), textAlign = TextAlign.Center)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) { contenido() }
        if (detalle != null) Text(detalle, style = LukApp.tipo.de(15, 400, 1.6f), color = Color.White.copy(alpha = 0.7f), textAlign = TextAlign.Center)
    }
}

@Composable
private fun Cifra(texto: String, color: Color = BLANCO) {
    val ancho = LocalConfiguration.current.screenWidthDp
    val tamano = (ancho * 0.08f).coerceIn(24f, 56f)
    Text(
        texto, style = LukApp.tipo.cifra.copy(fontSize = tamano.sp, lineHeight = tamano.sp, fontFeatureSettings = CIFRAS_TABULARES),
        color = color, textAlign = TextAlign.Center,
    )
}

@Composable
private fun Titulo(texto: String) = Text(texto, style = LukApp.tipo.de(28, 700, 1.2f), color = Color.White, textAlign = TextAlign.Center)

@Composable
private fun Tarjeta(t: TarjetaResumen, catalogo: Catalogo, hoy: String) {
    when (t) {
        is TarjetaResumen.Portada -> Marco(Lucide.Sparkles, "Tu resumen") {
            Text("Así fue tu", style = LukApp.tipo.de(17, 400, 1.4f), color = Color.White.copy(alpha = 0.7f))
            Text(monthKeyLabel(t.mes).replaceFirstChar { it.uppercase() }, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(28, 700, 1.2f), color = Color.White)
        }
        is TarjetaResumen.Balance -> {
            val positivo = t.totals.balance >= 0
            val color = if (positivo) BIEN else ATENTO
            val ahorro = t.totals.tasaAhorro?.let { " · Ahorraste el ${pctJs(it)}%" } ?: ""
            Marco(
                if (positivo) Lucide.TrendingUp else Lucide.TrendingDown, if (positivo) "Te sobró" else "Te faltó", color,
                "Entró ${formatCop(t.totals.ingresos)} · Salió ${formatCop(t.totals.gastos)}$ahorro",
            ) { Cifra(formatCop(Math.abs(t.totals.balance)), color) }
        }
        is TarjetaResumen.CategoriaEstrella -> {
            val entrada = catalogo.de(t.slice.category); val color = colorHex(entrada.color)
            Marco(Lucide.Trophy, "Tu categoría del mes", color, "${pctJs(t.slice.pct)}% de lo que gastaste") {
                Titulo(entrada.nombre); Cifra(formatCop(t.slice.total), color)
            }
        }
        is TarjetaResumen.CambioCategoriaTarjeta -> {
            val principal = t.subida ?: t.bajada ?: return
            val esSubida = principal === t.subida
            val color = if (esSubida) ATENTO else BIEN
            Marco(
                if (esSubida) Lucide.TrendingUp else Lucide.TrendingDown, if (esSubida) "Lo que más subió" else "Lo que más bajaste", color,
                principal.deltaPct?.let { "${if (it > 0) "+" else ""}${pctJs(it)}% vs. el mes pasado" } ?: "No gastabas en esto el mes pasado",
            ) {
                Titulo(catalogo.de(principal.category).nombre)
                Cifra((if (esSubida) "+" else "") + formatCop(principal.deltaCop), color)
            }
        }
        is TarjetaResumen.GastoMasCaro -> {
            val entrada = catalogo.de(t.tx.category); val color = colorHex(entrada.color)
            Marco(Lucide.Wallet, "El gasto que más dolió", color, "${entrada.nombre} · ${dayLabel(t.tx.occurredOn, hoy)}") {
                if (t.tx.description.isNotEmpty()) Text(t.tx.description, Modifier.padding(bottom = 4.dp), style = LukApp.tipo.de(17, 400, 1.4f), color = Color.White.copy(alpha = 0.7f), textAlign = TextAlign.Center)
                Cifra(formatCop(t.tx.amountCop), color)
            }
        }
        is TarjetaResumen.DiasActivos -> Marco(Lucide.CalendarCheck, "Días con movimiento", detalle = "de ${t.totalDias} días este mes") { Cifra(t.activos.toString()) }
        is TarjetaResumen.Racha -> Marco(
            Lucide.Flame, "Tu racha más larga", BIEN,
            if (t.dias == 0) "Este mes, ni un solo día sin gastar" else "${if (t.dias == 1) "día" else "días"} seguidos sin registrar un gasto",
        ) { Cifra(t.dias.toString(), BIEN) }
        is TarjetaResumen.ComparadoConPromedio -> {
            val mas = t.deltaPct > 0
            val color = if (mas) ATENTO else BIEN
            Marco(
                if (mas) Lucide.TrendingUp else Lucide.TrendingDown, if (mas) "Gastaste más de lo normal" else "Gastaste menos de lo normal", color,
                "Contra tu promedio de los últimos ${t.meses} ${if (t.meses == 1) "mes" else "meses"} (${formatCop(t.promedioCop)})",
            ) { Cifra("${if (mas) "+" else ""}${pctJs(t.deltaPct)}%", color) }
        }
        is TarjetaResumen.Cierre -> Marco(Lucide.PartyPopper, "Balance final", colorTono(t.tono), t.frase) { Cifra(formatCop(t.totals.balance), colorTono(t.tono)) }
    }
}

/**
 * ResumenWrapped.tsx: el mes como historia, una tarjeta por toque a pantalla completa. Fondo oscuro
 * fijo a propósito (no usa los colores del tema): es una experiencia aparte. Un tercio izquierdo
 * retrocede (menos del 30 %), el resto avanza; en la última salen Compartir y Cerrar.
 */
@Composable
fun PantallaResumen(tarjetas: List<TarjetaResumen>, catalogo: Catalogo, hoy: String, alCerrar: () -> Unit) {
    if (tarjetas.isEmpty()) return
    BackHandler(onBack = alCerrar)
    var indice by rememberSaveable { mutableIntStateOf(0) }
    val contexto = LocalContext.current
    var anchoPx by remember { mutableIntStateOf(1) }
    val i = indice.coerceIn(0, tarjetas.size - 1)
    val esUltima = i >= tarjetas.size - 1

    Column(Modifier.fillMaxSize().background(FONDO).statusBarsPadding().navigationBarsPadding().semantics { contentDescription = "Tu resumen del mes" }) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f).semantics { contentDescription = "Tarjeta ${i + 1} de ${tarjetas.size}" }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                tarjetas.indices.forEach { n ->
                    Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (n <= i) Color.White else Color.White.copy(alpha = 0.25f)))
                }
            }
            Box(
                Modifier.size(32.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar),
                contentAlignment = Alignment.Center,
            ) { Icono(Lucide.X, tamano = 16.dp, grosor = 2.5f, color = Color.White) }
        }
        Box(
            Modifier.weight(1f).fillMaxWidth()
                .onSizeChanged { anchoPx = maxOf(1, it.width) }
                .pointerInput(tarjetas.size) {
                    detectTapGestures { p ->
                        indice = if (p.x / anchoPx < 0.3f) maxOf(i - 1, 0) else minOf(i + 1, tarjetas.size - 1)
                    }
                },
        ) {
            Crossfade(targetState = i, animationSpec = tween(180), label = "tarjeta") { n ->
                Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { Box(Modifier.fillMaxWidth().fillMaxHeight()) { Tarjeta(tarjetas[n], catalogo, hoy) } }
            }
            if (i == 0) Text(
                "Toca para seguir", Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
                style = LukApp.tipo.xs, color = Color.White.copy(alpha = 0.4f),
            )
        }
        if (esUltima) Row(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 24.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.weight(1f).clip(androidx.compose.foundation.shape.RoundedCornerShape(16.dp)).background(Color.White).pulsable(alPulsar = {
                    val texto = textoParaCompartir(tarjetas) { catalogo.de(it).nombre }
                    val envio = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, texto) }
                    contexto.startActivity(Intent.createChooser(envio, "Compartir resumen").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }).padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Share2, tamano = 16.dp, grosor = 2.5f, color = Color.Black)
                Text("Compartir", style = LukApp.tipo.de(17, 600, 1.2f), color = Color.Black)
            }
            Box(
                Modifier.clip(androidx.compose.foundation.shape.RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.1f)).pulsable(alPulsar = alCerrar).padding(horizontal = 20.dp, vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) { Text("Cerrar", style = LukApp.tipo.de(17, 600, 1.2f), color = Color.White) }
        }
    }
}
