package app.lukapp.ui.asesor

import android.content.ClipData
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import kotlinx.coroutines.delay

/** Copiar y compartir una respuesta de Luki. Compartir manda solo el texto, sin datos de la cuenta. */
@Composable
fun AccionesMensaje(texto: String) {
    val c = LukApp.colores
    val contexto = LocalContext.current
    var copiado by remember { mutableStateOf(false) }
    LaunchedEffect(copiado) { if (copiado) { delay(2000); copiado = false } }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Copiar respuesta" }.pulsable(alPulsar = {
                val cm = contexto.getSystemService(android.content.ClipboardManager::class.java)
                cm?.setPrimaryClip(ClipData.newPlainText("Respuesta de Luki", texto))
                copiado = true
            }),
            contentAlignment = Alignment.Center,
        ) { Icono(if (copiado) Lucide.Check else Lucide.Copy, tamano = 16.dp, grosor = 2f, color = if (copiado) c.accent else c.inkSoft) }
        Box(
            Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Compartir respuesta" }.pulsable(alPulsar = {
                val envio = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, texto) }
                contexto.startActivity(Intent.createChooser(envio, "Compartir respuesta").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }),
            contentAlignment = Alignment.Center,
        ) { Icono(Lucide.Share2, tamano = 16.dp, grosor = 2f, color = c.inkSoft) }
        if (copiado) Text("Copiado", style = LukApp.tipo.xs, color = c.inkSoft)
    }
}
