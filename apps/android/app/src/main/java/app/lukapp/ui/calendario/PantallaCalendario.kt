package app.lukapp.ui.calendario

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.EventoFinanciero
import app.lukapp.dominio.eventosDelContexto
import app.lukapp.dominio.formatCop
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo

private enum class Vista(val etiqueta: String) { DIA("Día"), SEMANA("Semana"), MES("Mes") }

private fun etiquetaFecha(e: EventoFinanciero) = e.fecha ?: e.periodo?.let { "Período $it" } ?: "Fecha no determinada"

/**
 * CalendarioFinancieroView.tsx. Pendiente (se omite, no se simula): el botón «Añadir» de
 * pago fijo, porque abre Pagos fijos, que aún no existe en Android. Como en la web,
 * «Semana» agrupa igual que «Mes» (por YYYY-MM).
 */
@Composable
fun PantallaCalendario(vista: VistaInicio, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    var modo by remember { mutableStateOf(Vista.MES) }
    val eventos = remember(vista.contexto, vista.hoy) { eventosDelContexto(vista.contexto, vista.hoy) }
    val fechados = eventos.filter { it.fecha != null }
    val sinFecha = eventos.filter { it.fecha == null }
    val grupos = fechados.groupBy { if (modo == Vista.DIA) it.fecha!!.take(10) else it.fecha!!.take(7) }
    var entra by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entra = true }
    val p by animateFloatAsState(if (entra) 1f else 0f, tween(200), label = "entrada")

    Column(Modifier.fillMaxSize().graphicsLayer { alpha = p; translationY = (1 - p) * 16.dp.toPx() }.background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.CalendarDays, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                Column {
                    Text("Calendario financiero", style = LukApp.tipo.titulo, color = c.ink)
                    Text("Qué entra, qué sale y qué tan seguro es", style = LukApp.tipo.xs, color = c.inkFaint)
                }
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Vista.entries.forEach { o ->
                    val activa = modo == o
                    Box(
                        Modifier.weight(1f).clip(Medidas.formaControl).background(if (activa) c.sobreFondo(c.card) else androidx.compose.ui.graphics.Color.Transparent)
                            .pulsable(alPulsar = { modo = o }).padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text(o.etiqueta, style = LukApp.tipo.de(13, 600, 1.4f), color = if (activa) c.ink else c.inkSoft) }
                }
            }
            grupos.forEach { (clave, filas) ->
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(horizontal = 16.dp)) {
                    Text(clave, Modifier.padding(vertical = 12.dp), style = LukApp.tipo.de(13, 700, 1.4f), color = c.inkSoft)
                    filas.forEachIndexed { i, e -> FilaEvento(e, ultimo = i == filas.lastIndex) }
                }
            }
            if (sinFecha.isNotEmpty()) {
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).padding(horizontal = 16.dp)) {
                    Text("Sin fecha exacta", Modifier.padding(vertical = 12.dp), style = LukApp.tipo.de(13, 700, 1.4f), color = c.warnInk)
                    sinFecha.forEachIndexed { i, e -> FilaEvento(e, ultimo = i == sinFecha.lastIndex) }
                }
            }
            if (eventos.isEmpty()) {
                Text(
                    "No hay eventos futuros conocidos. Añade un pago fijo para proyectarlo.",
                    Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(20.dp),
                    style = LukApp.tipo.secundario, color = c.inkFaint, textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun FilaEvento(e: EventoFinanciero, ultimo: Boolean) {
    val c = LukApp.colores
    val entrada = e.impacto == "entrada"
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icono(if (entrada) Lucide.CircleDollarSign else Lucide.CircleAlert, tamano = 20.dp, grosor = 2f, color = if (entrada) c.entro else c.salio, modifier = Modifier.padding(top = 4.dp))
            Column(Modifier.weight(1f)) {
                Text(e.concepto, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                Text("${etiquetaFecha(e)} · ${e.estado} · ${e.precision}", style = LukApp.tipo.xs, color = c.inkFaint)
            }
            Text(
                e.montoCop?.let { formatCop(it) } ?: "Monto no determinado",
                Modifier.widthIn(max = 120.dp),
                style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (entrada) c.entro else c.salio, textAlign = TextAlign.End,
            )
        }
        if (!ultimo) Box(Modifier.fillMaxWidth().size(width = 1.dp, height = 1.dp).background(c.line))
    }
}
