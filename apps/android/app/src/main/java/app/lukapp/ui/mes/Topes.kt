package app.lukapp.ui.mes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.TonoPresupuesto
import app.lukapp.dominio.estadoDeTodos
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.tonoDe
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/**
 * PresupuestosView.tsx, la parte que lee: cada tope con lo gastado, la barra con aro de
 * aviso, y "Te quedan…" / "Te pasaste por…" / "A este ritmo cerrarías en…".
 * Crear, editar y quitar topes, y las alertas, siguen en la app publicada.
 */
@Composable
fun Topes(vista: VistaInicio) {
    val c = LukApp.colores
    val estados = remember(vista.libro, vista.clavePeriodo, vista.ajustes.periodo) {
        estadoDeTodos(vista.libro.presupuestos, vista.libro.transacciones, vista.clavePeriodo, vista.hoy, vista.ajustes.periodo)
    }
    if (estados.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        estados.forEach { e ->
            val entrada = vista.catalogo.de(e.categoria)
            val color = colorHex(entrada.color)
            val aro = if (vista.ajustes.alertasPresupuesto) when (tonoDe(e, vista.ajustes.umbralAlertaPct.toDouble())) {
                TonoPresupuesto.ATENTO -> c.warn
                TonoPresupuesto.EXCEDIDO -> c.salio
                else -> null
            } else null
            Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(color.copy(alpha = 0x26 / 255f)), contentAlignment = Alignment.Center) {
                    Icono(Lucide.porNombre[entrada.icono] ?: Lucide.Package, tamano = 18.dp, color = color)
                }
                Column(Modifier.weight(1f)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                        Text(entrada.nombre, Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
                        Text(
                            buildAnnotatedString {
                                withStyle(SpanStyle(color = c.ink, fontWeight = FontWeight.Bold)) { append(formatCop(e.gastadoCop)) }
                                append(" de ${formatCop(e.topeCop)}")
                            },
                            style = LukApp.tipo.de(13, 400, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft,
                        )
                    }
                    Box(
                        Modifier.padding(top = 8.dp).fillMaxWidth().height(8.dp)
                            .then(if (aro != null) Modifier.border(1.5.dp, aro, CircleShape) else Modifier)
                            .clip(CircleShape).background(c.soft)
                            .semantics { contentDescription = "${entrada.nombre}: ${pctJs(e.pctUsado)}% del presupuesto" },
                    ) {
                        Box(Modifier.fillMaxWidth((e.pctUsado.toFloat() / 100f).coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(color))
                    }
                    // La proyección va siempre aparte del gasto real y nunca en su lugar: es una suposición.
                    when {
                        e.excedidoCop > 0 -> Text("Te pasaste por ${formatCop(e.excedidoCop)}.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.salio)
                        e.vaARebasar -> Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Top) {
                            Icono(Lucide.TrendingUp, Modifier.padding(top = 3.dp), tamano = 12.dp, grosor = 3f, color = c.warn)
                            Text("A este ritmo cerrarías en ${formatCop(e.proyectadoCop ?: 0)}.", style = LukApp.tipo.de(13, 400, 1.6f), color = c.warn)
                        }
                        else -> Text("Te quedan ${formatCop(e.disponibleCop)}.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
                    }
                }
            }
        }
    }
}
