package app.lukapp.ui.asesor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ConexionIA
import app.lukapp.dominio.POSES_LUKI
import app.lukapp.dominio.SALUDO_ASESOR
import app.lukapp.dominio.SUGERENCIAS_ASESOR
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import coil3.compose.AsyncImage

private fun etiquetaConexion(c: ConexionIA) = when (c) {
    ConexionIA.EN_LINEA -> "IA en línea"
    ConexionIA.DESPERTANDO -> "Despertando la IA…"
    ConexionIA.LOCAL -> "Respuestas locales"
}

@Composable
private fun Luki(archivo: String, descripcion: String, tamano: androidx.compose.ui.unit.Dp) {
    AsyncImage(model = "file:///android_asset/brand/$archivo", contentDescription = descripcion, contentScale = ContentScale.Fit, modifier = Modifier.size(tamano))
}

/** AsesorView.tsx (primer corte): chat con la IA del servidor, sin motor local ni historial guardado. */
@Composable
fun PantallaAsesor(modelo: ModeloAsesor, vista: app.lukapp.ui.VistaInicio, modifier: Modifier = Modifier) {
    val c = LukApp.colores
    val mensajes by modelo.mensajes.collectAsState()
    val pensando by modelo.pensando.collectAsState()
    val conexion by modelo.conexion.collectAsState()
    val error by modelo.error.collectAsState()
    var entrada by remember { mutableStateOf("") }
    val lista = rememberLazyListState()
    LaunchedEffect(mensajes.size, pensando) { if (mensajes.isNotEmpty()) lista.animateScrollToItem(mensajes.size + (if (pensando) 0 else -1)) }
    fun enviar(t: String) { modelo.enviar(t, vista); entrada = "" }

    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.clip(Medidas.formaPildora).background(if (conexion == ConexionIA.EN_LINEA) c.soft else androidx.compose.ui.graphics.Color.Transparent)
                    .semantics { contentDescription = "Verificar disponibilidad de IA" }.pulsable(habilitado = conexion != ConexionIA.DESPERTANDO, alPulsar = modelo::verificar)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(when (conexion) { ConexionIA.EN_LINEA -> c.accent; ConexionIA.DESPERTANDO -> c.warn; else -> c.inkFaint }))
                Text(etiquetaConexion(conexion), style = LukApp.tipo.de(13, if (conexion == ConexionIA.EN_LINEA) 600 else 400, 1.4f), color = if (conexion == ConexionIA.EN_LINEA) c.ink else c.inkSoft)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Ver conversaciones anteriores" }.pulsable(alPulsar = modelo::abrirHistorial), contentAlignment = Alignment.Center) {
                Icono(Lucide.History, tamano = 16.dp, grosor = 2f, color = c.inkSoft)
            }
            Box(Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Nueva conversación" }.pulsable(alPulsar = modelo::nuevaConversacion), contentAlignment = Alignment.Center) {
                Icono(Lucide.Plus, tamano = 16.dp, grosor = 2f, color = c.inkSoft)
            }
            }
        }

        if (mensajes.isEmpty()) {
            Column(Modifier.weight(1f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val (archivo, alt) = POSES_LUKI[modelo.poseLuki]
                Luki(archivo, alt, 144.dp)
                Text(SALUDO_ASESOR, style = LukApp.tipo.de(15, 400, 1.35f), color = c.inkSoft, textAlign = TextAlign.Center)
                FlowRow(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SUGERENCIAS_ASESOR.forEach { s ->
                        Text(s, Modifier.clip(Medidas.formaPildora).background(c.soft).pulsable(alPulsar = { enviar(s) }).padding(horizontal = 12.dp, vertical = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                    }
                }
            }
        } else {
            LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = lista, verticalArrangement = Arrangement.spacedBy(24.dp)) {
                items(mensajes, key = { it.id }) { m ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, if (m.esUsuario) Alignment.End else Alignment.Start), verticalAlignment = Alignment.Bottom) {
                        if (!m.esUsuario) Luki("luki-nutria-saludo-transparente.png", "Luki, mascota del asesor", 40.dp)
                        val forma = RoundedCornerShape(20.dp, 20.dp, if (m.esUsuario) 0.dp else 20.dp, if (m.esUsuario) 20.dp else 0.dp)
                        Column(Modifier.widthIn(max = 280.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            m.texto, Modifier.clip(forma).background(if (m.esUsuario) c.accent else c.soft).padding(12.dp),
                            style = LukApp.tipo.de(15, if (m.esUsuario) 500 else 400, 1.6f), color = if (m.esUsuario) c.onAccent else c.ink,
                        )
                        if (m.sugerencias.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            m.sugerencias.forEach { s -> Text(s, Modifier.clip(Medidas.formaPildora).background(c.soft).pulsable(habilitado = !pensando, alPulsar = { enviar(s) }).padding(horizontal = 12.dp, vertical = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink) }
                        }
                        }
                    }
                }
                if (pensando) item {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Luki("luki-pensando-transparente.webp", "Luki, pensando", 40.dp)
                        Text("Analizando tus finanzas...", Modifier.clip(RoundedCornerShape(20.dp, 20.dp, 20.dp, 0.dp)).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.xs, color = c.inkSoft)
                    }
                }
            }
        }

        error?.let { e ->
            Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(e, Modifier.weight(1f), style = LukApp.tipo.xs, color = c.inkSoft)
                Text("Reintentar con IA", Modifier.clip(Medidas.formaPildora).background(c.accent).pulsable(habilitado = !pensando, alPulsar = { modelo.reintentar(vista) }).padding(horizontal = 12.dp, vertical = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent)
            }
        }
        Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaPildora).background(c.soft).padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (entrada.isEmpty()) Text("Pregúntale a tu asesor...", style = LukApp.tipo.cuerpo, color = c.inkFaint)
                BasicTextField(
                    entrada, { entrada = it }, Modifier.fillMaxWidth(), textStyle = LukApp.tipo.cuerpo.copy(color = c.ink), cursorBrush = SolidColor(c.ink),
                    singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { enviar(entrada) }),
                )
            }
            val puede = entrada.isNotBlank() && !pensando
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(c.accent.copy(alpha = if (puede) 1f else 0.3f)).semantics { contentDescription = "Enviar pregunta" }.pulsable(habilitado = puede, alPulsar = { enviar(entrada) }),
                contentAlignment = Alignment.Center,
            ) { Icono(Lucide.Send, tamano = 16.dp, grosor = 2.5f, color = c.onAccent) }
        }
        Text("LukApp es una IA y puede cometer errores. Verifica cualquier consejo sobre dinero antes de actuar.", Modifier.padding(top = 8.dp).fillMaxWidth(), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center)
    }
}
