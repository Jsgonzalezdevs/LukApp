package app.lukapp.ui.mes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.EscenarioForecast
import app.lukapp.dominio.ForecastFinanciero
import app.lukapp.dominio.formatCop
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

private fun valor(v: Long?): String = if (v == null) "No disponible" else formatCop(v)

/**
 * ForecastResumen.tsx dentro del panel «Proyección financiera»: liquidez, disponible diario y flujo
 * neto a 7, 30 y 90 días del escenario base. Conservador y favorable dicen «no disponible» mientras
 * no haya una hipótesis respaldada: no se inventan.
 */
@Composable
fun PantallaProyeccion(forecast: ForecastFinanciero?, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Proyección financiera", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp).semantics { contentDescription = "Situación esperada" }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                    Text("Situación esperada", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                    Text("Escenario base", style = LukApp.tipo.xs, color = c.inkFaint)
                }
                if (forecast == null) {
                    Text("Forecast no disponible.", Modifier.padding(top = 12.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                } else {
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        forecast.horizontes.forEach { h ->
                            val b = h.base
                            Column(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(12.dp)) {
                                Text("${h.dias} días", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                                Dato("Liquidez", valor(b.liquidezCop), 8)
                                Dato("Disponible diario", valor(b.disponibleDiarioCop), 4)
                                Dato("Flujo neto", valor(b.flujoNetoCop), 4)
                                Text(
                                    "Confianza: ${b.confianza} · ${b.evidencia.firstOrNull() ?: "Sin evidencia adicional"}",
                                    Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint,
                                )
                                Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(1.dp).background(c.line))
                                Text(
                                    "Conservador: ${escenario(h.conservador)} · Favorable: ${escenario(h.favorable)}",
                                    Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun escenario(e: EscenarioForecast): String = if (e.confianza == "desconocida") "no disponible por falta de datos" else valor(e.liquidezCop)

@Composable
private fun Dato(etiqueta: String, v: String, arriba: Int) {
    val c = LukApp.colores
    Text(etiqueta, Modifier.padding(top = arriba.dp), style = LukApp.tipo.xs, color = c.inkFaint)
    Text(v, style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
}
