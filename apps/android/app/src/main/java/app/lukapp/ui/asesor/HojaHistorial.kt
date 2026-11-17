package app.lukapp.ui.asesor

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val formatoFecha = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.forLanguageTag("es-CO"))

private fun fechaLegible(iso: String) = runCatching { formatoFecha.format(Instant.parse(iso).atZone(ZoneId.systemDefault())) }.getOrDefault("")

/** Hoja lateral «Conversaciones» del Asesor: velo del 45 %, ancho min(88 %, 352dp) pegado a la derecha. */
@Composable
fun HojaHistorial(modelo: ModeloAsesor) {
    val c = LukApp.colores
    val conversaciones by modelo.conversaciones.collectAsState()
    val activa by modelo.conversacionId.collectAsState()
    val cargando by modelo.cargandoConversacion.collectAsState()
    val aviso by modelo.aviso.collectAsState()
    BackHandler(onBack = modelo::cerrarHistorial)
    val ancho = (LocalConfiguration.current.screenWidthDp * 0.88f).coerceAtMost(352f).dp
    Row(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f))) {
        Box(Modifier.weight(1f).fillMaxHeight().semantics { contentDescription = "Cerrar historial" }.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = modelo::cerrarHistorial))
        Column(Modifier.width(ancho).fillMaxHeight().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Conversaciones", style = LukApp.tipo.cuerpoB, color = c.ink)
                    Text("Tus chats guardados con el asesor", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                }
                Box(Modifier.size(36.dp).clip(CircleShape).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = modelo::cerrarHistorial), contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 20.dp, grosor = 2f, color = c.inkSoft)
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
            Row(
                Modifier.padding(12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.accent).pulsable(alPulsar = modelo::nuevaConversacion).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Plus, tamano = 16.dp, grosor = 2f, color = c.onAccent)
                Text("Nueva conversación", style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent)
            }
            aviso?.let { Text(it, Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = LukApp.tipo.xs, color = c.salio) }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (conversaciones.isEmpty()) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icono(Lucide.MessageSquareText, tamano = 32.dp, grosor = 2f, color = c.inkFaint)
                        Text("Todavía no tienes conversaciones guardadas.", Modifier.padding(top = 12.dp), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center)
                    }
                } else conversaciones.forEach { conv ->
                    Column(
                        Modifier.fillMaxWidth().clip(Medidas.formaControl).background(if (conv.id == activa) c.soft else Color.Transparent)
                            .pulsable(habilitado = !cargando, alPulsar = { modelo.abrirConversacion(conv) }).padding(12.dp),
                    ) {
                        Text(conv.titulo.ifBlank { "Conversación sin título" }, style = LukApp.tipo.de(13, 600, 1.4f), color = if (conv.id == activa) c.ink else c.inkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(fechaLegible(conv.actualizadoEn), Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                    }
                }
            }
        }
    }
}

