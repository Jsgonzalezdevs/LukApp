package app.lukapp.ui.anotar

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.totalesMultiples
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/**
 * MultiCapturaModal.tsx: «N movimientos detectados». Cada uno se puede quitar (sin ninguno se cancela), muestra el
 * total que sale y el que entra, y «Guardar los N movimientos» los registra todos juntos.
 */
@Composable
fun MultiCapturaModal(
    detectados: List<ParsedTransaction>, cajitas: List<Cajita>, catalogo: Catalogo,
    alGuardar: suspend (List<ParsedTransaction>) -> Boolean, alCancelar: () -> Unit,
) {
    val c = LukApp.colores
    BackHandler(onBack = alCancelar)
    val ambito = rememberCoroutineScope()
    val items = remember { detectados.toMutableStateList() }
    var guardando by remember { mutableStateOf(false) }
    val (gastos, ingresos) = totalesMultiples(items)

    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)).statusBarsPadding().navigationBarsPadding(), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().clip(Medidas.formaHoja).border(1.dp, c.line, Medidas.formaHoja).background(c.card).padding(20.dp)
                .semantics { contentDescription = "${items.size} movimientos detectados" },
        ) {
            Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).clip(Medidas.formaControl).background(c.warnBg), contentAlignment = Alignment.Center) { Icono(Lucide.Sparkles, tamano = 20.dp, color = c.warnInk) }
                    Column {
                        Text("${items.size} movimientos detectados", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                        Text("Detectamos varios registros en tu mensaje", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                    }
                }
                Box(Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCancelar), contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 16.dp, color = c.inkSoft)
                }
            }
            Box(Modifier.fillMaxWidth().padding(bottom = 16.dp).background(c.line).size(width = 0.dp, height = 1.dp))

            Column(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items.forEachIndexed { idx, item ->
                    val cat = catalogo.de(item.category)
                    val gasto = item.kind == "gasto"
                    val cuenta = cajitas.firstOrNull { it.id == item.cuentaId }
                    Row(
                        Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line.copy(alpha = 0.6f), Medidas.formaCard).background(c.bg).padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(40.dp).clip(Medidas.formaControl).background(runCatching { colorHex(cat.color) }.getOrDefault(if (gasto) c.salio else c.entro)), contentAlignment = Alignment.Center) { Emoji(if (gasto) "💸" else "💰", 20) }
                        Column(Modifier.weight(1f)) {
                            Text(item.description.ifEmpty { cat.nombre }, style = LukApp.tipo.de(15, 700, 1.3f), color = c.ink, maxLines = 1)
                            Text(cat.nombre + (cuenta?.let { " • ${it.nombre}" } ?: ""), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkSoft, maxLines = 1)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text((if (gasto) "-" else "+") + formatCop(item.amount ?: 0L), style = LukApp.tipo.de(15, 700, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (gasto) c.salio else c.entro)
                            Text(if (gasto) "GASTO" else "INGRESO", style = LukApp.tipo.de(13, 700, 1.3f), color = c.inkFaint)
                        }
                        Box(
                            Modifier.size(36.dp).semantics { contentDescription = "Eliminar este movimiento" }.pulsable(alPulsar = {
                                items.removeAt(idx)
                                if (items.isEmpty()) alCancelar()
                            }),
                            contentAlignment = Alignment.Center,
                        ) { Icono(Lucide.Trash2, tamano = 16.dp, color = c.inkFaint) }
                    }
                }
            }

            Box(Modifier.fillMaxWidth().padding(top = 16.dp).background(c.line).size(width = 0.dp, height = 1.dp))
            Row(Modifier.fillMaxWidth().padding(top = 12.dp, start = 4.dp, end = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Total a registrar:", style = LukApp.tipo.de(13, 500, 1.3f), color = c.inkSoft)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (gastos > 0) Text("-${formatCop(gastos)}", style = LukApp.tipo.de(13, 700, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                    if (ingresos > 0) Text("+${formatCop(ingresos)}", style = LukApp.tipo.de(13, 700, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.entro)
                }
            }

            Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier.weight(1f).clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).semantics { contentDescription = "Cancelar" }.pulsable(alPulsar = alCancelar).padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("Cancelar", style = LukApp.tipo.de(15, 600, 1.3f), color = c.ink) }
                Row(
                    Modifier.weight(2f).alpha(if (guardando) 0.6f else 1f).clip(Medidas.formaCard).background(c.accent).semantics { contentDescription = "Guardar los ${items.size} movimientos" }
                        .pulsable(habilitado = !guardando, alPulsar = { guardando = true; ambito.launch { try { alGuardar(items.toList()) } finally { guardando = false } } }).padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Check, tamano = 16.dp, grosor = 3f, color = c.onAccent)
                    Text(if (guardando) "Guardando…" else "Guardar los ${items.size} movimientos", style = LukApp.tipo.de(15, 700, 1.3f), color = c.onAccent)
                }
            }
        }
    }
}
