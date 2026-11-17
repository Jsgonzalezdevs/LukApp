package app.lukapp.ui.asesor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.PropuestaAsesor
import app.lukapp.dominio.claveDePeriodo
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.daysBetween
import app.lukapp.dominio.gastadoEnCategoria
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlin.math.ceil

/** `toLocaleString('es-CO')` de un entero, con signo (los puntos de conPuntos no lo llevan). */
private fun miles(n: Long) = (if (n < 0) "-" else "") + conPuntos(kotlin.math.abs(n).toString())

private val FECHA = Regex("""^\d{4}-\d{2}-\d{2}$""")

@Composable
private fun Campo(etiqueta: String, valor: String, habilitado: Boolean, numerico: Boolean, descripcion: String, alCambiar: (String) -> Unit) {
    val c = LukApp.colores
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(etiqueta, style = LukApp.tipo.de(12, 600, 1.4f), color = c.inkFaint)
        BasicTextField(
            valor, alCambiar, Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.card).border(1.dp, c.line, Medidas.formaControl).padding(horizontal = 12.dp, vertical = 10.dp).semantics { contentDescription = descripcion },
            enabled = habilitado, singleLine = true, textStyle = LukApp.tipo.cuerpo.copy(color = if (habilitado) c.ink else c.inkFaint), cursorBrush = SolidColor(c.ink),
            keyboardOptions = KeyboardOptions(keyboardType = if (numerico) KeyboardType.Number else KeyboardType.Text),
        )
    }
}

/** «💡 Propuesta para revisar» de AsesorView: editable, y solo guarda al pulsar Confirmar. */
@Composable
fun TarjetaPropuesta(m: MensajeAsesor, vista: VistaInicio, catalogo: Catalogo, alEditar: ((app.lukapp.dominio.PropuestaAsesor) -> app.lukapp.dominio.PropuestaAsesor) -> Unit, alConfirmar: () -> Unit) {
    val c = LukApp.colores
    val p = m.propuesta ?: return
    val bloqueada = m.propuestaConfirmada
    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.bg).border(1.dp, c.line, Medidas.formaControl).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("💡 Propuesta para revisar", style = LukApp.tipo.de(14, 600, 1.4f), color = c.ink)
        when (p) {
            is PropuestaAsesor.Presupuesto -> {
                val clave = claveDePeriodo(vista.hoy, vista.ajustes.periodo)
                val gastado = gastadoEnCategoria(vista.libro.transacciones, clave, vista.ajustes.periodo, p.categoria)
                val actual = vista.libro.presupuestos.firstOrNull { it.categoria == p.categoria }?.montoCop
                Text("Tope de ${catalogo.de(p.categoria).nombre}${if (actual != null && actual > 0) " · hoy ${miles(actual)} COP" else ""}; en el período llevas ${miles(gastado)} COP.", style = LukApp.tipo.xs, color = c.inkSoft)
                var abierto by remember { mutableStateOf(false) }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Categoría", style = LukApp.tipo.de(12, 600, 1.4f), color = c.inkFaint)
                    Box {
                        Text(
                            "${catalogo.de(p.categoria).emoji} ${catalogo.de(p.categoria).nombre}",
                            Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.card).border(1.dp, c.line, Medidas.formaControl).pulsable(habilitado = !bloqueada, alPulsar = { abierto = true }).padding(horizontal = 12.dp, vertical = 12.dp).semantics { contentDescription = "Categoría del presupuesto" },
                            style = LukApp.tipo.cuerpo, color = if (bloqueada) c.inkFaint else c.ink,
                        )
                        DropdownMenu(abierto, { abierto = false }, Modifier.heightIn(max = 320.dp)) {
                            catalogo.lista.forEach { cat -> DropdownMenuItem(text = { Text("${cat.emoji} ${cat.nombre}") }, onClick = { abierto = false; alEditar { x -> if (x is PropuestaAsesor.Presupuesto) x.copy(categoria = cat.clave) else x } }) }
                        }
                    }
                }
                Campo("Nuevo tope mensual (COP)", p.montoCop.toString(), !bloqueada, true, "Nuevo tope mensual en COP") { t -> alEditar { x -> if (x is PropuestaAsesor.Presupuesto) x.copy(montoCop = maxOf(1L, t.filter(Char::isDigit).toLongOrNull() ?: 1L)) else x } }
                Text("Con ese tope, quedarían ${miles(p.montoCop - gastado)} COP disponibles en el período.", style = LukApp.tipo.xs, color = c.inkSoft)
            }
            is PropuestaAsesor.Meta -> {
                var fecha by remember(m.id) { mutableStateOf(p.fechaObjetivo.orEmpty()) }
                Campo("Nombre de la meta", p.nombre, !bloqueada, false, "Nombre de la meta") { t -> alEditar { x -> if (x is PropuestaAsesor.Meta) x.copy(nombre = t) else x } }
                Campo("Objetivo total (COP)", p.objetivoCop.toString(), !bloqueada, true, "Objetivo total de la meta en COP") { t -> alEditar { x -> if (x is PropuestaAsesor.Meta) x.copy(objetivoCop = maxOf(1L, t.filter(Char::isDigit).toLongOrNull() ?: 1L)) else x } }
                Campo("Fecha objetivo (opcional, AAAA-MM-DD)", fecha, !bloqueada, false, "Fecha objetivo de la meta") { t -> fecha = t; alEditar { x -> if (x is PropuestaAsesor.Meta) x.copy(fechaObjetivo = t.takeIf { FECHA.matches(it) }) else x } }
                Text("La meta empezará con \$0 ahorrados; el objetivo será ${miles(p.objetivoCop)} COP.", style = LukApp.tipo.xs, color = c.inkSoft)
                p.fechaObjetivo?.let { f ->
                    val dias = daysBetween(vista.hoy, f)
                    Text(if (dias > 0) "Para llegar a tiempo, necesitarías ahorrar cerca de ${miles(ceil(p.objetivoCop / (dias / 30.44)).toLong())} COP al mes." else "La fecha debe estar en el futuro para calcular un aporte.", style = LukApp.tipo.xs, color = c.inkSoft)
                }
            }
        }
        m.propuestaError?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
        if (m.propuestaConfirmada) Text("✅ Guardado. Puedes verlo en Dinero.", style = LukApp.tipo.de(13, 600, 1.4f), color = c.entro)
        else Box(
            Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(Medidas.formaControl).background(c.accent.copy(alpha = if (m.propuestaGuardando) 0.5f else 1f)).pulsable(habilitado = !m.propuestaGuardando, alPulsar = alConfirmar),
            contentAlignment = Alignment.Center,
        ) { Text(if (m.propuestaGuardando) "Guardando…" else "Confirmar ${if (p is PropuestaAsesor.Presupuesto) "presupuesto" else "meta"}", style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent) }
    }
}
