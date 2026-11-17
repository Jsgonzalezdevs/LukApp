package app.lukapp.ui.inicio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Insight
import app.lukapp.dominio.formatCop
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.delay

/**
 * El desplegable «Análisis y categorías del período» de InicioView.tsx, con lo que ya existe en nativo:
 * el Pulso Premium y la franja de «Para ti». Faltan dentro de él la decisión financiera y el carrusel de categorías.
 * Tocar un insight o el Pulso manda la pregunta al Asesor (`handleConsultarTipEnAsesor`).
 */
@Composable
fun BloqueAnalisis(
    vista: VistaInicio,
    insights: List<Insight>,
    pulsoPremium: Boolean,
    cargandoIa: Boolean,
    alRefrescar: () -> Unit,
    alDescartar: (String) -> Unit,
    alConsultar: (String) -> Unit,
) {
    val c = LukApp.colores
    var abierto by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.padding(top = 20.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
        Row(
            Modifier.fillMaxWidth().semantics { contentDescription = "Análisis y categorías del período" }.pulsable(escala = 1f, alPulsar = { abierto = !abierto }),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Análisis y categorías del período", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
            Icono(Lucide.ChevronDown, tamano = 16.dp, color = c.inkSoft, modifier = Modifier.rotate(if (abierto) 180f else 0f))
        }
        if (!abierto) return@Column

        var indice by remember { mutableIntStateOf(0) }
        // Una a una, cada 45 s, como el temporizador de InicioView.
        LaunchedEffect(insights.size) { while (insights.size > 1) { delay(45_000); indice = (indice + 1) % insights.size } }
        val actual = insights.getOrNull(if (insights.size > 1) indice % insights.size else 0)
        val privacidad = vista.ajustes.privacidad

        if (pulsoPremium) {
            val l = vista.contexto.liquidez
            Column(
                Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.accent.copy(alpha = 0.25f), Medidas.formaCard).background(c.card)
                    .semantics { contentDescription = "Abrir el análisis de este Pulso Premium en el Asesor" }
                    .pulsable(escala = 0.985f, alPulsar = { alConsultar(app.lukapp.dominio.promptPulsoPremium(l.disponibleDiarioCop, l.diasRestantesPeriodo, actual)) })
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icono(Lucide.Sparkles, tamano = 14.dp, grosor = 2.4f, color = c.accent)
                        Text("PULSO PREMIUM", style = LukApp.tipo.de(13, 700, 1.4f, 0.08f), color = c.accent)
                    }
                    Text(if (l.confianza == "alta") "Datos al día" else "Cálculo estimado", style = LukApp.tipo.de(13, 500, 1.4f), color = c.inkFaint)
                }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                    Text(
                        buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = LukApp.tipo.de(20, 700, 1.3f).fontSize, color = c.ink)) { append(if (privacidad) "$ ••••••" else formatCop(l.disponibleDiarioCop)) }
                            withStyle(SpanStyle(color = c.inkSoft)) { append(" para usar hoy") }
                        },
                        style = LukApp.tipo.xs,
                    )
                    Text(if (l.diasRestantesPeriodo == 1) "Queda 1 día" else "Quedan ${l.diasRestantesPeriodo} días", style = LukApp.tipo.xs, color = c.inkFaint)
                }
                Text(
                    if (privacidad) "Calculado tras separar tus pagos y reservas conocidos." else "${formatCop(l.dineroLibreCop)} libres después de separar pagos y reservas conocidos.",
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkSoft,
                )
                Box(Modifier.padding(top = 12.dp).fillMaxWidth().height(1.dp).background(c.line))
                Text(
                    buildAnnotatedString {
                        if (actual != null) {
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.ink)) { append("${actual.titulo}:") }
                            append(" ${actual.detalle} ")
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.accent)) { append("Analizar con IA →") }
                        } else withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.accent)) { append("Toca para analizar tu margen con IA →") }
                    },
                    Modifier.padding(top = 10.dp), style = LukApp.tipo.xs, color = c.inkSoft,
                )
            }
        } else if (actual != null) {
            Row(
                Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.accent.copy(alpha = 0.2f), Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(Modifier.weight(1f).pulsable(escala = 1f, alPulsar = { alConsultar(app.lukapp.dominio.promptDeInsight(actual)) }), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                    Icono(Lucide.Sparkles, tamano = 14.dp, color = c.accent, modifier = Modifier.padding(top = 2.dp))
                    Text(
                        buildAnnotatedString {
                            if (actual.origenIa) { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.accent)) { append("IA · PREMIUM ") } }
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.ink)) { append("${actual.titulo}:") }
                            append(" ${actual.detalle}")
                        },
                        style = LukApp.tipo.xs, color = c.inkSoft,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(28.dp).semantics { contentDescription = "Actualizar resumen Premium" }.pulsable(alPulsar = alRefrescar), contentAlignment = Alignment.Center) {
                        Icono(Lucide.RefreshCw, tamano = 12.dp, color = if (cargandoIa) c.accent else c.inkFaint)
                    }
                    Box(Modifier.size(28.dp).semantics { contentDescription = "Descartar" }.pulsable(alPulsar = { alDescartar(actual.id) }), contentAlignment = Alignment.Center) {
                        Icono(Lucide.X, tamano = 14.dp, color = c.inkFaint)
                    }
                }
            }
        } else {
            Text("Aún no hay nada que destacar de este período.", Modifier.padding(top = 12.dp), style = LukApp.tipo.xs, color = c.inkFaint)
        }
    }
}
