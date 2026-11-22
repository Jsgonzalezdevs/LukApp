package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/**
 * FuncionesSolicitadasView.tsx: cualquiera propone una idea y vota las de los demás; lo más votado se construye
 * primero. El voto es optimista y se revierte si el servidor no lo guarda.
 */
@Composable
fun PantallaFunciones(modelo: ModeloFunciones, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    LaunchedEffect(Unit) { modelo.cargar() }
    val funciones by modelo.funciones.collectAsState()
    val misVotos by modelo.misVotos.collectAsState()
    val votando by modelo.votando.collectAsState()
    val enviando by modelo.enviando.collectAsState()
    val error by modelo.error.collectAsState()
    val ambito = rememberCoroutineScope()
    var abierto by rememberSaveable { mutableStateOf(false) }
    var titulo by rememberSaveable { mutableStateOf("") }
    var descripcion by rememberSaveable { mutableStateOf("") }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.Lightbulb, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                Text("Funciones solicitadas", style = LukApp.tipo.titulo, color = c.ink)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Vota las ideas que quieres ver, o propón una nueva. Lo más votado se construye primero.", Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            error?.let { Text(it, Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.salioInk) }

            if (funciones == null && error == null) Text("Cargando…", Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            funciones?.forEach { f ->
                val votado = f.id in misVotos
                Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Column(
                        Modifier.alpha(if (f.id in votando) 0.6f else 1f).clip(Medidas.formaControl).background(if (votado) c.accent else c.soft)
                            .semantics { contentDescription = if (votado) "Quitar voto" else "Votar esta idea"; selected = votado }
                            .pulsable(habilitado = f.id !in votando, alPulsar = { modelo.votar(f.id) }).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icono(Lucide.ChevronUp, tamano = 16.dp, grosor = 3f, color = if (votado) c.onAccent else c.ink)
                        Text(f.votos.toString(), style = LukApp.tipo.de(15, 700, 1.2f), color = if (votado) c.onAccent else c.ink)
                    }
                    Column(Modifier.weight(1f).padding(top = 4.dp)) {
                        Text(f.titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                        f.descripcion?.let { Text(it, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft) }
                    }
                }
            }

            if (funciones != null) {
                if (abierto) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Otras ideas", style = LukApp.tipo.de(13, 600, 1.3f), color = c.ink)
                        Box(Modifier.size(24.dp).semantics { contentDescription = "Cerrar formulario" }.pulsable(alPulsar = { abierto = false; titulo = ""; descripcion = "" }), contentAlignment = Alignment.Center) {
                            Icono(Lucide.X, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                        }
                    }
                    CampoTexto(titulo, { titulo = it }, "¿Qué te gustaría que hiciera LukApp?", "Título de la idea")
                    CampoTexto(descripcion, { descripcion = it }, "Cuéntanos un poco más (opcional)", "Descripción de la idea")
                    val listo = titulo.isNotBlank() && !enviando
                    Box(
                        Modifier.fillMaxWidth().alpha(if (listo) 1f else 0.5f).clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Enviar idea" }
                            .pulsable(habilitado = listo, alPulsar = { ambito.launch { if (modelo.proponer(titulo, descripcion)) { titulo = ""; descripcion = ""; abierto = false } } }).padding(horizontal = 16.dp, vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text(if (enviando) "Enviando…" else "Enviar idea", style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent) }
                } else Row(
                    Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).semantics { contentDescription = "¿Otras ideas?" }.pulsable(alPulsar = { abierto = true }).padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = c.inkSoft)
                    Text("¿Otras ideas?", style = LukApp.tipo.de(15, 600, 1.3f), color = c.inkSoft)
                }
            }
        }
    }
}
