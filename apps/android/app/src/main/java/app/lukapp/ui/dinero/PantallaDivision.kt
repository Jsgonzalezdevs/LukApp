package app.lukapp.ui.dinero

import android.content.Intent
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.MAX_PERSONAS_DIVISION
import app.lukapp.dominio.ParticipanteDivision
import app.lukapp.dominio.PROPINAS_DIVISION
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.descripcionMiParte
import app.lukapp.dominio.dividirCuenta
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.mensajeDeCobro
import app.lukapp.dominio.parseSaldoInput
import app.lukapp.dominio.participantesIniciales
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/**
 * DivisionCuentasModal.tsx. La cuota por persona con propina (la cuota sube al peso para que nadie quede debiendo),
 * quién ya pagó, el mensaje de cobro para compartir y «Anotar mi parte», que abre el movimiento ya llenado.
 * Nada se guarda aquí: lo único que escribe es el movimiento que la persona confirme después.
 */
@Composable
fun PantallaDivision(alAnotarMiParte: (Long, String) -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val contexto = LocalContext.current
    var totalTexto by rememberSaveable { mutableStateOf("") }
    var lugar by rememberSaveable { mutableStateOf("") }
    var propina by rememberSaveable { mutableStateOf(10) }
    var participantes by remember { mutableStateOf(participantesIniciales(2)) }

    val r = dividirCuenta(parseSaldoInput(totalTexto) ?: 0L, propina, participantes.size)
    val puede = r.cuota > 0

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Dividir cuenta y propina", style = LukApp.tipo.titulo, color = c.ink)
                Text("Calcula la cuota por persona y anota tu parte", style = LukApp.tipo.xs, color = c.inkSoft)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column {
                Etiq("Monto total de la factura / cuenta")
                Box(Modifier.padding(top = 8.dp)) { CampoTexto(totalTexto, { totalTexto = conPuntos(it) }, "Ej. 120.000", "Monto total de la cuenta", numerico = true) }
            }
            Column {
                Etiq("Lugar o motivo (opcional)")
                Box(Modifier.padding(top = 8.dp)) { CampoTexto(lugar, { lugar = it }, "Ej. Crepes & Waffles, Asado, Almuerzo", "Lugar o motivo") }
            }
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Etiq("Propina")
                    Text(formatCop(r.propina), style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                }
                Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PROPINAS_DIVISION.forEach { pct ->
                        val sel = propina == pct
                        Box(
                            Modifier.weight(1f).clip(CircleShape).background(if (sel) c.accent else c.soft).semantics { contentDescription = "Propina $pct%" }
                                .pulsable(escala = 1f, alPulsar = { propina = pct }).padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(if (pct == 0) "Sin propina" else "$pct%${if (pct == 10) " (CO)" else ""}", style = LukApp.tipo.de(13, 700, 1.4f), color = if (sel) c.onAccent else c.inkSoft, maxLines = 1, textAlign = TextAlign.Center)
                        }
                    }
                }
            }
            Column {
                Etiq("Dividir entre personas")
                Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Paso(Lucide.Minus, "Una persona menos", participantes.size > 1) { if (participantes.size > 1) participantes = participantes.dropLast(1) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icono(Lucide.Users, tamano = 16.dp, color = c.inkSoft)
                        Text("${participantes.size} ${if (participantes.size == 1) "persona" else "personas"}", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                    }
                    Paso(Lucide.Plus, "Una persona más", participantes.size < MAX_PERSONAS_DIVISION) {
                        if (participantes.size < MAX_PERSONAS_DIVISION) participantes = participantes + ParticipanteDivision("Persona ${participantes.size + 1}")
                    }
                }
            }
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Etiq("¿Quién ya pagó?")
                    Text("Edita los nombres si hace falta", style = LukApp.tipo.xs, color = c.inkFaint)
                }
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    participantes.forEachIndexed { i, p ->
                        Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            BasicTextField(
                                value = p.nombre, singleLine = true, textStyle = LukApp.tipo.de(17, 600, 1.3f).copy(color = c.ink), cursorBrush = SolidColor(c.accent),
                                onValueChange = { n -> participantes = participantes.mapIndexed { j, q -> if (j == i) q.copy(nombre = n) else q } },
                                modifier = Modifier.weight(1f).semantics { contentDescription = "Nombre de la persona ${i + 1}" },
                            )
                            Text(
                                if (p.pagoConfirmado) "Pagó" else "Marcar pagado",
                                Modifier.clip(CircleShape).background(if (p.pagoConfirmado) c.entroBg else c.soft).semantics { contentDescription = "Pago de ${p.nombre}" }
                                    .pulsable(escala = 1f, alPulsar = { participantes = participantes.mapIndexed { j, q -> if (j == i) q.copy(pagoConfirmado = !q.pagoConfirmado) else q } })
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                style = LukApp.tipo.de(13, 700, 1.4f), color = if (p.pagoConfirmado) c.entro else c.inkSoft,
                            )
                        }
                    }
                }
            }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("CUOTA POR PERSONA", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkFaint)
                Text(formatCop(r.cuota), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(28, 700, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                Text("Total cuenta ${formatCop(r.totalConPropina)} entre ${participantes.size}", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.weight(1f).alpha(if (puede) 1f else 0.4f).clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).semantics { contentDescription = "Enviar cobro" }
                    .pulsable(alPulsar = {
                        if (puede) {
                            val texto = mensajeDeCobro(lugar, propina, r, participantes)
                            val envio = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, texto) }
                            contexto.startActivity(Intent.createChooser(envio, "Enviar cobro").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        }
                    }).padding(vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Share2, tamano = 16.dp, grosor = 2.5f, color = c.ink)
                Text("Enviar cobro", style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink)
            }
            Row(
                Modifier.weight(1f).alpha(if (puede) 1f else 0.4f).clip(Medidas.formaCard).background(c.accent).semantics { contentDescription = "Anotar mi parte" }
                    .pulsable(alPulsar = { if (puede) alAnotarMiParte(r.cuota, descripcionMiParte(lugar, participantes.size)) }).padding(vertical = 14.dp, horizontal = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Check, tamano = 16.dp, grosor = 3f, color = c.onAccent)
                Text("Anotar mi parte (${formatCop(r.cuota)})", style = LukApp.tipo.de(15, 700, 1.3f), color = c.onAccent, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun Etiq(texto: String) = Text(texto, style = LukApp.tipo.de(13, 600, 1.4f), color = LukApp.colores.inkSoft)

@Composable
private fun Paso(icono: app.lukapp.ui.iconos.IconoLucide, descripcion: String, activo: Boolean, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Box(Modifier.size(40.dp).alpha(if (activo) 1f else 0.4f).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = descripcion }.pulsable(escala = 1f, alPulsar = alPulsar), contentAlignment = Alignment.Center) {
        Icono(icono, tamano = 16.dp, grosor = 2.5f, color = c.inkSoft)
    }
}
