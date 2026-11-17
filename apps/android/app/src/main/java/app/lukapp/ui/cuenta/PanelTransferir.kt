package app.lukapp.ui.cuenta

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.parseAmountInput
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlinx.coroutines.launch

/**
 * «Enviar dinero a otra cuenta» de DetalleCajita.tsx. Los destinos son otras cuentas y ahorros vivos
 * (nunca deudas ni tarjetas). Con menos de dos, la web dice que hacen falta al menos 2 cuentas.
 */
@Composable
fun PanelTransferir(origen: Cajita, todas: List<Cajita>, alTransferir: suspend (String, Long) -> Boolean) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    val destinos = remember(todas, origen.id) {
        todas.filter { it.archivedAt == null && it.id != origen.id && (it.tipo == TipoCajita.CUENTA || it.tipo == TipoCajita.CAJITA) }
    }
    var abierto by remember { mutableStateOf(false) }
    var destinoId by remember { mutableStateOf("") }
    var monto by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun cerrar() { abierto = false; destinoId = ""; monto = ""; error = null }

    if (destinos.isEmpty()) {
        Text(
            "Necesitas al menos 2 cuentas para transferir",
            Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).padding(16.dp),
            style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center,
        )
        return
    }
    if (!abierto) {
        Row(
            Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.ink).semantics { contentDescription = "Enviar dinero a otra cuenta" }
                .pulsable(alPulsar = { destinoId = destinos.first().id; abierto = true }).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(Lucide.Send, tamano = 16.dp, grosor = 2.5f, color = c.bg)
            Text("Enviar dinero a otra cuenta", style = LukApp.tipo.de(15, 600, 1.3f), color = c.bg)
        }
        return
    }
    val valor = parseAmountInput(monto)
    val valido = valor != null && destinoId.isNotEmpty() && !ocupado
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(20.dp)) {
        Text("Enviar desde ${origen.nombre}", style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink)
        Text("HACIA", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(13, 500, 1.3f, 0.05f), color = c.inkFaint)
        Box(Modifier.padding(top = 8.dp)) {
            Row(
                Modifier.fillMaxWidth().semantics { contentDescription = "Cuenta destino" }.clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.bg)
                    .pulsable(escala = 1f, alPulsar = { menu = true }).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(destinos.firstOrNull { it.id == destinoId }?.nombre ?: "— Elige la cuenta destino —", Modifier.weight(1f), style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink, maxLines = 1)
                Icono(Lucide.ChevronDown, tamano = 16.dp, color = c.inkSoft)
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                destinos.forEach { d -> DropdownMenuItem(text = { Text(d.nombre) }, onClick = { destinoId = d.id; menu = false }) }
            }
        }
        Text("CUÁNTO", Modifier.padding(top = 20.dp), style = LukApp.tipo.de(13, 500, 1.3f, 0.05f), color = c.inkFaint)
        val estilo = LukApp.tipo.de(17, 400, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES)
        BasicTextField(
            value = monto, onValueChange = { monto = conPuntos(it); error = null }, singleLine = true, enabled = !ocupado,
            textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.padding(top = 8.dp).fillMaxWidth().semantics { contentDescription = "Monto a enviar" }.clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 12.dp),
            decorationBox = { interno -> Box { if (monto.isEmpty()) Text("0", style = estilo, color = c.inkGhost); interno() } },
        )
        error?.let { Text(it, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.warn) }
        Row(Modifier.padding(top = 24.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Cancelar", Modifier.weight(1f).clip(Medidas.formaControl).background(c.soft).pulsable(habilitado = !ocupado, alPulsar = ::cerrar).padding(vertical = 16.dp), style = LukApp.tipo.de(15, 600, 1.3f), color = c.ink, textAlign = TextAlign.Center)
            Row(
                Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent.copy(alpha = if (valido) 1f else 0.4f)).pulsable(habilitado = valido, alPulsar = {
                    ocupado = true; error = null
                    ambito.launch { if (alTransferir(destinoId, valor!!)) cerrar() else error = "No se pudo completar la transferencia. Inténtalo de nuevo."; ocupado = false }
                }).padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Send, tamano = 16.dp, grosor = 2.5f, color = c.onAccent)
                Text(if (ocupado) "Enviando…" else "Enviar", style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent)
            }
        }
    }
}
