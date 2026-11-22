package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.RevisionDudosa
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.construirBandejaRevision
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.formatSigned
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch
import java.time.Instant

private const val AVISOS_POR_GRUPO = 5

private fun emojiDe(tipo: String) = when (tipo) { "documento" -> "🧾"; "transferencia" -> "🔄"; else -> "💸" }
private fun nombreDe(tipo: String) = when (tipo) { "documento" -> "Documento"; "transferencia" -> "Transferencia"; else -> "Movimiento" }

/** `toLocaleDateString('es-CO')`: día/mes/año sin ceros a la izquierda. */
private fun fechaCo(iso: String): String = iso.take(10).split("-").let { (y, m, d) -> "${d.toInt()}/${m.toInt()}/$y" }

/**
 * BandejaRevision.tsx («Revisar movimientos»): avisos de cobros iguales el mismo día, montos fuera de lo
 * normal y filas de extracto por confirmar. Marcar o descartar solo guarda la decisión; no toca saldos.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaRevisiones(vista: VistaInicio, alGuardar: suspend (RevisionDudosa) -> Boolean, alAbrirMovimiento: (Transaccion) -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ambito = rememberCoroutineScope()
    var visibles by rememberSaveable { mutableIntStateOf(AVISOS_POR_GRUPO) }
    var verResueltas by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val items = remember(vista.libro.transacciones, vista.libro.revisiones, vista.catalogo) { construirBandejaRevision(vista.libro.transacciones, vista.libro.revisiones, vista.catalogo) }
    val pendientes = items.filter { it.estado == "pendiente" }
    val resueltas = items.filter { it.estado != "pendiente" }
    val porId = remember(vista.libro.transacciones) { vista.libro.transacciones.associateBy { it.id } }

    fun resolver(item: RevisionDudosa, estado: String) = ambito.launch {
        val nueva = item.copy(
            estado = estado, updatedAt = Instant.now().toString(),
            resolucion = if (estado == "resuelta") "Revisado por la persona usuaria." else "Aviso descartado por la persona usuaria.",
        )
        error = if (alGuardar(nueva)) null else "No se pudo guardar. Inténtalo de nuevo."
    }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Revisar movimientos", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(16.dp)) {
                Text("Pendientes por revisar", style = LukApp.tipo.cuerpoB, color = c.ink)
                Text(
                    "Revisa movimientos repetidos o datos del extracto que quieras confirmar. Tus decisiones aquí no cambian los saldos.",
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.6f), color = c.inkSoft,
                )
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Clock3, tamano = 16.dp, color = c.inkSoft)
                    Text("${pendientes.size} aviso${if (pendientes.size == 1) "" else "s"} por revisar", style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                }
            }

            if (pendientes.isEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(horizontal = 20.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Emoji("✨", 30)
                Text("Todo revisado", Modifier.padding(top = 8.dp), style = LukApp.tipo.cuerpoB, color = c.ink)
                Text("Si aparece algo que merezca una segunda mirada, lo encontrarás aquí.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft)
            } else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                pendientes.take(visibles).forEach { item ->
                    val tx = item.referenciaId?.let { porId[it] }
                    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                            Box(Modifier.size(40.dp).clip(CircleShape).background(c.warnBg), contentAlignment = Alignment.Center) { Emoji(emojiDe(item.tipo), 20) }
                            Column(Modifier.weight(1f)) {
                                Text("${nombreDe(item.tipo)} · Por revisar", style = LukApp.tipo.de(13, 600, 1.3f), color = c.warnInk)
                                Text(item.titulo, Modifier.padding(top = 4.dp), style = LukApp.tipo.cuerpoB, color = c.ink)
                                Text(item.detalle, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.6f), color = c.inkSoft)
                                item.documento?.let { Text("📄 $it", Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint) }
                                tx?.let { Text("${dayLabel(it.occurredOn, vista.hoy)} · ${formatSigned(it.amountCop, it.kind)} · ${it.description}", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink) }
                            }
                        }
                        FlowRow(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (tx != null) Boton("Ver movimiento", null, borde = true) { alAbrirMovimiento(tx) }
                            Boton("Marcar revisado", Lucide.Check, relleno = true) { resolver(item, "resuelta") }
                            Boton("Descartar aviso", null) { resolver(item, "descartada") }
                        }
                    }
                }
            }

            if (visibles < pendientes.size) Text(
                "Mostrar ${minOf(AVISOS_POR_GRUPO, pendientes.size - visibles)} más", Modifier.align(Alignment.CenterHorizontally).clip(CircleShape).pulsable(alPulsar = { visibles += AVISOS_POR_GRUPO }).padding(horizontal = 20.dp, vertical = 12.dp),
                style = LukApp.tipo.de(14, 600, 1.3f), color = c.accent,
            )

            if (resueltas.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                Text(
                    "${if (verResueltas) "▾" else "▸"} Decisiones guardadas (${resueltas.size})", Modifier.fillMaxWidth().pulsable(escala = 1f, alPulsar = { verResueltas = !verResueltas }),
                    style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink,
                )
                if (verResueltas) Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    resueltas.forEach { item ->
                        Column {
                            Box(Modifier.fillMaxWidth().heightIn(min = 1.dp).background(c.line))
                            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Emoji(emojiDe(item.tipo), 20)
                                Column {
                                    Text(item.titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                                    Text("${item.resolucion ?: "Decisión guardada"} · ${fechaCo(item.updatedAt)}", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkSoft)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Boton(texto: String, icono: app.lukapp.ui.iconos.IconoLucide?, relleno: Boolean = false, borde: Boolean = false, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.heightIn(min = 44.dp).clip(CircleShape).then(if (borde) Modifier.border(1.dp, c.line, CircleShape) else Modifier).background(if (relleno) c.accent else androidx.compose.ui.graphics.Color.Transparent)
            .semantics { contentDescription = texto }.pulsable(alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icono != null) Icono(icono, tamano = 16.dp, grosor = 2.5f, color = if (relleno) c.onAccent else c.ink)
        Text(texto, style = LukApp.tipo.de(13, 600, 1.3f), color = if (relleno) c.onAccent else if (borde) c.ink else c.inkSoft)
    }
}
