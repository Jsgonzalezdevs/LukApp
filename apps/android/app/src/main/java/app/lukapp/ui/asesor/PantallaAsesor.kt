package app.lukapp.ui.asesor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
fun PantallaAsesor(modelo: ModeloAsesor, vista: app.lukapp.ui.VistaInicio, alFijarPresupuesto: suspend (String, Long) -> Boolean, alCrearMeta: suspend (String, Long, String?) -> Boolean, alRevisarMovimiento: (app.lukapp.dominio.voz.ParsedTransaction) -> Unit, modifier: Modifier = Modifier) {
    val c = LukApp.colores
    val mensajes by modelo.mensajes.collectAsState()
    val pensando by modelo.pensando.collectAsState()
    val conexion by modelo.conexion.collectAsState()
    val error by modelo.error.collectAsState()
    val valoraciones by modelo.valoraciones.collectAsState()
    val premium by modelo.premium.collectAsState()
    LaunchedEffect(Unit) { modelo.actualizarPlan() }
    val contexto = androidx.compose.ui.platform.LocalContext.current
    val lector = remember { LectorVoz(contexto) }
    androidx.compose.runtime.DisposableEffect(lector) { onDispose { lector.liberar() } }
    val hablandoId by lector.hablando.collectAsState()
    val avisoLector by lector.aviso.collectAsState()
    LaunchedEffect(avisoLector) { avisoLector?.let { android.widget.Toast.makeText(contexto, it, android.widget.Toast.LENGTH_SHORT).show(); lector.aviso.value = null } }
    var entrada by remember { mutableStateOf("") }
    val fase by modelo.faseDictado.collectAsState()
    val errorDictado by modelo.errorDictado.collectAsState()
    val textoDictado by modelo.textoDictado.collectAsState()
    // `manejarDictadoFinal`: lo dictado se suma a lo que ya había escrito y NO se envía solo.
    LaunchedEffect(textoDictado) { textoDictado?.let { entrada = listOf(entrada.trim(), it).filter(String::isNotEmpty).joinToString(" "); modelo.consumirTextoDictado() } }
    val pedirMicrofono = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { concedido -> if (concedido) modelo.alternarDictado() }
    val alternarDictado = {
        if (fase != ModeloAsesor.FaseDictadoAsesor.REPOSO || androidx.core.content.ContextCompat.checkSelfPermission(contexto, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) modelo.alternarDictado()
        else pedirMicrofono.launch(android.Manifest.permission.RECORD_AUDIO)
    }
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
            if (premium) Row(
                Modifier.clip(Medidas.formaPildora).background(c.accent.copy(alpha = 0.1f)).border(1.dp, c.accent.copy(alpha = 0.2f), Medidas.formaPildora).padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Sparkles, tamano = 12.dp, grosor = 2f, color = c.accent)
                Text("Premium", style = LukApp.tipo.de(10, 700, 1.4f), color = c.accent)
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
                        if (!m.esUsuario && m.texto.isNotBlank()) AccionesMensaje(m.texto, valoraciones[m.id], pensando, { u -> modelo.valorar(m.id, u) }, { modelo.regenerar(m.id, vista) }, hablandoId == m.id, { lector.alternar(m.id, m.texto) })
                        m.accion?.let { EfectoMovimiento(it, "Revisar y editar movimiento", vista) { alRevisarMovimiento(it) } }
                        m.acciones.forEachIndexed { i, a -> EfectoMovimiento(a, "Revisar y editar movimiento ${i + 1}", vista) { alRevisarMovimiento(a) } }
                        if (m.propuesta != null) TarjetaPropuesta(m, vista, vista.catalogo, alEditar = { f -> modelo.editarPropuesta(m.id, f) }, alConfirmar = { modelo.confirmarPropuesta(m.id, alFijarPresupuesto, alCrearMeta) })
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
        if (fase != ModeloAsesor.FaseDictadoAsesor.REPOSO || errorDictado != null) Text(
            errorDictado ?: if (fase == ModeloAsesor.FaseDictadoAsesor.PROCESANDO) "Transcribiendo tu pregunta…" else "Te escucho… toca el botón para terminar",
            Modifier.padding(top = 12.dp).fillMaxWidth(), style = LukApp.tipo.de(13, 500, 1.4f), color = if (errorDictado != null) c.salio else c.inkSoft, textAlign = TextAlign.Center,
        )
        Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaPildora).background(c.soft).padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (entrada.isEmpty()) Text(if (fase == ModeloAsesor.FaseDictadoAsesor.ESCUCHANDO) "Te escucho…" else "Pregúntale a tu asesor...", style = LukApp.tipo.cuerpo, color = c.inkFaint)
                BasicTextField(
                    entrada, { entrada = it }, Modifier.fillMaxWidth(), textStyle = LukApp.tipo.cuerpo.copy(color = c.ink), cursorBrush = SolidColor(c.ink),
                    enabled = fase == ModeloAsesor.FaseDictadoAsesor.REPOSO,
                    singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { enviar(entrada) }),
                )
            }
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(if (fase == ModeloAsesor.FaseDictadoAsesor.ESCUCHANDO) c.salio else androidx.compose.ui.graphics.Color.Transparent)
                    .semantics { contentDescription = when (fase) { ModeloAsesor.FaseDictadoAsesor.PROCESANDO -> "Transcribiendo"; ModeloAsesor.FaseDictadoAsesor.ESCUCHANDO -> "Dejar de escuchar"; else -> "Preguntar hablando" } }
                    .pulsable(habilitado = fase != ModeloAsesor.FaseDictadoAsesor.PROCESANDO, alPulsar = alternarDictado),
                contentAlignment = Alignment.Center,
            ) {
                when (fase) {
                    ModeloAsesor.FaseDictadoAsesor.PROCESANDO -> app.lukapp.ui.acceso.Girando(Lucide.Loader2, 20.dp, c.inkSoft)
                    ModeloAsesor.FaseDictadoAsesor.ESCUCHANDO -> Icono(Lucide.Square, tamano = 16.dp, grosor = 3f, color = c.onOut)
                    else -> Icono(Lucide.Mic, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
                }
            }
            val puede = entrada.isNotBlank() && !pensando && fase == ModeloAsesor.FaseDictadoAsesor.REPOSO
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(c.accent.copy(alpha = if (puede) 1f else 0.3f)).semantics { contentDescription = "Enviar pregunta" }.pulsable(habilitado = puede, alPulsar = { enviar(entrada) }),
                contentAlignment = Alignment.Center,
            ) { Icono(Lucide.Send, tamano = 16.dp, grosor = 2.5f, color = c.onAccent) }
        }
        Text("LukApp es una IA y puede cometer errores. Verifica cualquier consejo sobre dinero antes de actuar.", Modifier.padding(top = 8.dp).fillMaxWidth(), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center)
    }
}
