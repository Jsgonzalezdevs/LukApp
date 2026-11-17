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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.promedioPorPeriodoCategoria
import app.lukapp.ui.comun.pulsable
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
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
import app.lukapp.ui.tema.sobreFondo

/** Lo que Topes necesita escribir: el libro (fijar, quitar) y los ajustes de la cuenta (alertas y umbral). */
class AccionesTopes(
    val fijar: suspend (String, Long) -> Boolean,
    val quitar: suspend (String) -> Boolean,
    val alertas: (Boolean) -> Unit,
    val umbral: (Int) -> Unit,
)

/**
 * PresupuestosView.tsx: alertas con su umbral, crear un tope tocando una categoría sin tope
 * (con «Sueles gastar…»), editarlo y quitarlo desde el menú de cada fila, y la lectura de
 * cada uno: lo gastado, la barra con aro de aviso y «Te quedan…» / «Te pasaste por…» /
 * «A este ritmo cerrarías en…». Falta el atajo «Nueva transacción» del menú.
 */
@Composable
fun Topes(vista: VistaInicio, acciones: AccionesTopes) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    val estados = remember(vista.libro, vista.clavePeriodo, vista.ajustes.periodo) {
        estadoDeTodos(vista.libro.presupuestos, vista.libro.transacciones, vista.clavePeriodo, vista.hoy, vista.ajustes.periodo)
    }
    val sinTope = remember(vista.libro.presupuestos, vista.catalogo) {
        val ya = vista.libro.presupuestos.map { it.categoria }.toSet()
        vista.catalogo.lista.filter { it.clave !in ya }
    }
    /** Categoría cuyo formulario está abierto, y si es edición (true) o creación (false). */
    var formulario by rememberSaveable { mutableStateOf<String?>(null) }
    var editando by rememberSaveable { mutableStateOf(false) }
    var monto by rememberSaveable { mutableStateOf("") }
    var menu by rememberSaveable { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val umbralGuardado = vista.ajustes.umbralAlertaPct
    var umbralLocal by remember(umbralGuardado) { mutableStateOf(umbralGuardado.toFloat()) }
    val alertas = vista.ajustes.alertasPresupuesto

    fun guardar() {
        val cat = formulario ?: return
        val valor = parseAmountInput(monto) ?: return
        guardando = true; error = null
        ambito.launch {
            if (acciones.fijar(cat, valor)) { formulario = null; monto = "" } else error = "No se pudo guardar el presupuesto. Inténtalo de nuevo."
            guardando = false
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }

        // Alertas y umbral (solo si hay algo que alertar tiene sentido, pero la web lo muestra siempre).
        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth().semantics { contentDescription = "Alertas de presupuesto" }.pulsable(escala = 1f, alPulsar = { acciones.alertas(!alertas) }),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft), contentAlignment = Alignment.Center) { Icono(Lucide.Bell, tamano = 16.dp, color = c.inkSoft) }
                Text("Alertas de presupuesto", Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                Switch(checked = alertas, onCheckedChange = null, colors = SwitchDefaults.colors(checkedTrackColor = c.accent, checkedThumbColor = c.onAccent))
            }
            if (alertas) {
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Umbral de alerta", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                    Text("${umbralLocal.toInt()}%", style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                }
                // De 10 a 100 de 5 en 5, como el rango de la web; se guarda al soltar, no en cada paso.
                Slider(
                    value = umbralLocal, onValueChange = { umbralLocal = it }, valueRange = 10f..100f, steps = 17,
                    onValueChangeFinished = { acciones.umbral(umbralLocal.toInt()) },
                    colors = SliderDefaults.colors(thumbColor = c.accent, activeTrackColor = c.accent, inactiveTrackColor = c.soft),
                    modifier = Modifier.semantics { contentDescription = "Umbral de alerta de presupuesto" },
                )
            }
        }

        // Formulario de crear (para una categoría sin tope); el de editar va dentro de su fila.
        val creando = formulario?.takeIf { !editando }
        if (creando != null) FormularioTope(vista, creando, monto, { monto = conPuntos(it) }, guardando, ::guardar) { formulario = null; monto = "" }

        estados.forEach { e ->
            val entrada = vista.catalogo.de(e.categoria)
            val color = colorHex(entrada.color)
            if (formulario == e.categoria && editando) {
                FormularioTope(vista, e.categoria, monto, { monto = conPuntos(it) }, guardando, ::guardar) { formulario = null; monto = "" }
                return@forEach
            }
            val aro = if (alertas) when (tonoDe(e, umbralGuardado.toDouble())) {
                TonoPresupuesto.ATENTO -> c.warn
                TonoPresupuesto.EXCEDIDO -> c.salio
                else -> null
            } else null
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                Row(
                    Modifier.fillMaxWidth().semantics { contentDescription = "Opciones del presupuesto de ${entrada.nombre}" }.pulsable(escala = 1f, alPulsar = { menu = if (menu == e.categoria) null else e.categoria }),
                    horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
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
                if (menu == e.categoria) {
                    Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.soft)) {
                        OpcionTope("Editar presupuesto", Lucide.Pencil, c.ink) { menu = null; editando = true; formulario = e.categoria; monto = conPuntos(e.topeCop.toString()) }
                        Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
                        OpcionTope("Quitar presupuesto", Lucide.Trash2, c.salio) {
                            menu = null
                            ambito.launch { if (!acciones.quitar(e.categoria)) error = "No se pudo quitar el presupuesto. Inténtalo de nuevo." }
                        }
                    }
                }
            }
        }

        if (sinTope.isNotEmpty()) {
            Text("Sin presupuesto establecido", Modifier.padding(start = 4.dp, top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card)) {
                sinTope.forEachIndexed { i, cat ->
                    val color = colorHex(cat.color)
                    val sugerido = remember(vista.libro.transacciones, cat.clave, vista.clavePeriodo, vista.ajustes.periodo) {
                        promedioPorPeriodoCategoria(vista.libro.transacciones, cat.clave, vista.clavePeriodo, vista.ajustes.periodo)
                    }
                    Row(
                        Modifier.fillMaxWidth().semantics { contentDescription = "Poner presupuesto a ${cat.nombre}" }
                            .pulsable(escala = 1f, alPulsar = { editando = false; formulario = cat.clave; monto = ""; menu = null })
                            .padding(horizontal = 16.dp, vertical = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(color.copy(alpha = 0x26 / 255f)), contentAlignment = Alignment.Center) {
                            Icono(Lucide.porNombre[cat.icono] ?: Lucide.Package, tamano = 18.dp, color = color)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(cat.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                if (sugerido != null) {
                                    Icono(Lucide.Sparkles, tamano = 12.dp, grosor = 2.5f, color = c.inkFaint)
                                    Text("Sueles gastar ${formatCop(sugerido)}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                                } else Text("Sin presupuesto establecido", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                            }
                        }
                        Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                    }
                    if (i < sinTope.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
                }
            }
        }

        if (estados.isEmpty() && sinTope.isEmpty()) {
            Text(
                "Ponle un tope a una categoría y aquí te digo cómo vas — y si al ritmo actual te vas a pasar antes de que acabe el período.",
                Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), style = LukApp.tipo.xs, color = c.inkFaint,
            )
        }
    }
}

@Composable
private fun OpcionTope(texto: String, icono: app.lukapp.ui.iconos.IconoLucide, color: androidx.compose.ui.graphics.Color, alPulsar: () -> Unit) {
    Row(Modifier.fillMaxWidth().pulsable(escala = 1f, alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icono(icono, tamano = 14.dp, grosor = 2.5f, color = color)
        Text(texto, style = LukApp.tipo.de(15, 600, 1.4f), color = color)
    }
}

/** El mismo formulario para crear y editar: «Máximo por período», con lo que sueles gastar a la derecha. */
@Composable
private fun FormularioTope(vista: VistaInicio, categoria: String, monto: String, alCambiar: (String) -> Unit, guardando: Boolean, alGuardar: () -> Unit, alCancelar: () -> Unit) {
    val c = LukApp.colores
    val entrada = vista.catalogo.de(categoria)
    val color = colorHex(entrada.color)
    val promedio = remember(vista.libro.transacciones, categoria, vista.clavePeriodo, vista.ajustes.periodo) {
        promedioPorPeriodoCategoria(vista.libro.transacciones, categoria, vista.clavePeriodo, vista.ajustes.periodo)
    }
    val foco = remember { androidx.compose.ui.focus.FocusRequester() }
    androidx.compose.runtime.LaunchedEffect(categoria) { runCatching { foco.requestFocus() } }
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(color.copy(alpha = 0x26 / 255f)), contentAlignment = Alignment.Center) {
                Icono(Lucide.porNombre[entrada.icono] ?: Lucide.Package, tamano = 18.dp, color = color)
            }
            Text(entrada.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text("Máximo por período", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
            if (promedio != null) Text("Sueles gastar ${formatCop(promedio)}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
        }
        val estilo = LukApp.tipo.de(17, 400, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES)
        BasicTextField(
            value = monto, onValueChange = alCambiar, singleLine = true, enabled = !guardando,
            textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.padding(top = 8.dp).fillMaxWidth().focusRequester(foco).semantics { contentDescription = "Máximo por período" }
                .clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).padding(horizontal = 12.dp, vertical = 12.dp),
            decorationBox = { interno -> Box { if (monto.isEmpty()) Text("0", style = estilo, color = c.inkGhost); interno() } },
        )
        val valido = parseAmountInput(monto) != null && !guardando
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (guardando) "Guardando…" else "Guardar",
                Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent.copy(alpha = if (valido) 1f else 0.4f)).pulsable(habilitado = valido, alPulsar = alGuardar).padding(vertical = 12.dp),
                style = LukApp.tipo.de(15, 600, 1.4f), color = c.onAccent, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Text(
                "Cancelar", Modifier.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).pulsable(habilitado = !guardando, alPulsar = alCancelar).padding(horizontal = 16.dp, vertical = 12.dp),
                style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft,
            )
        }
    }
}
