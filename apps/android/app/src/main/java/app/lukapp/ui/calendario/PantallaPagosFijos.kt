package app.lukapp.ui.calendario

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
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
import app.lukapp.dominio.Pendiente
import app.lukapp.dominio.Recurrente
import app.lukapp.dominio.TipoTx
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.detectarSuscripciones
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.pendientesDelMes
import app.lukapp.dominio.proximosRecurrentes
import app.lukapp.dominio.totalMensual
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlinx.coroutines.launch

/** Lo que Pagos fijos escribe en el libro; cada una devuelve si se guardó. */
class AccionesPagosFijos(
    val crear: suspend (nombre: String, kind: String, monto: Long, categoria: String, cuentaId: String?, dia: Int) -> Boolean,
    val actualizar: suspend (Recurrente) -> Boolean,
    val borrar: suspend (String) -> Boolean,
    val confirmar: suspend (Pendiente) -> Boolean,
)

/**
 * RecurrentesView.tsx. La app propone y tú confirmas, siempre: registrar sola un cobro que quizá no
 * ocurrió deja el saldo mintiendo. Cada mes + proyección, próximos cobros a 60 días, patrones que
 * podrían volverse pagos fijos, «Ya pasó la fecha de…» con «Sí pasó», formulario de nuevo y la lista.
 */
@Composable
fun PantallaPagosFijos(vista: VistaInicio, acciones: AccionesPagosFijos, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ambito = rememberCoroutineScope()
    val mes = vista.hoy.take(7)
    val recs = vista.libro.recurrentes
    val vivos = remember(recs) { recs.filter { it.archivedAt == null } }
    val pendientes = remember(recs, vista.libro.transacciones, mes, vista.hoy) { pendientesDelMes(recs, vista.libro.transacciones, mes, vista.hoy) }
    val total = remember(vivos) { totalMensual(vivos) }
    val sugerencias = remember(vista.libro.transacciones, recs, vista.hoy) { detectarSuscripciones(vista.libro.transacciones, recs, vista.hoy) }
    val proximos = remember(vivos, vista.hoy, vista.libro.transacciones) { proximosRecurrentes(vivos, vista.hoy, vista.libro.transacciones) }
    var creando by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun guardado(bloque: suspend () -> Boolean) { ambito.launch { error = if (bloque()) null else "No se pudo guardar. Inténtalo de nuevo." } }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.Repeat, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                Text("Pagos fijos", style = LukApp.tipo.titulo, color = c.ink)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Repeat, tamano = 14.dp, grosor = 2.5f, color = c.inkSoft)
                    Text("Cada mes", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                }
                Text(formatCop(total.gastoCop), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(44, 600, 1.1f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                Text(
                    "sale fijo en ${vivos.size} ${if (vivos.size == 1) "cosa" else "cosas"}" + if (total.ingresoCop > 0) " · entran ${formatCop(total.ingresoCop)}" else "",
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint,
                )
            }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.bg).padding(16.dp)) {
                Text("📊 Tu proyección de pagos fijos", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                Text("${formatCop(total.gastoCop)} al mes · ${formatCop(total.gastoCop * 12)} al año, si todos se mantienen.", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                Text("Es una estimación; solo se registra un cobro cuando lo confirmas.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkGhost)
            }

            if (proximos.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.CalendarDays, tamano = 16.dp, color = c.ink)
                    Text("Próximos cobros · 60 días", style = LukApp.tipo.de(14, 600, 1.4f), color = c.ink)
                }
                proximos.take(6).forEach { p ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${dayLabel(p.fecha, vista.hoy)} · ${p.recurrente.nombre}", Modifier.weight(1f), style = LukApp.tipo.xs, color = c.inkSoft, maxLines = 1)
                        Text(formatCop(p.recurrente.amountCop), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                    }
                }
            }

            if (sugerencias.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
                Text("💡 Patrones que podrías volver pagos fijos", style = LukApp.tipo.de(14, 600, 1.4f), color = c.ink)
                Text("LukApp detectó cobros parecidos en tres meses seguidos. Tú decides; no se crea nada sin confirmación.", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                sugerencias.forEach { s ->
                    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(s.nombre, style = LukApp.tipo.de(14, 600, 1.4f), color = c.ink, maxLines = 1)
                                Text(
                                    if (s.cambioPrecio) "El último cobro cambió de ${formatCop(s.recurrenteExistente?.amountCop ?: 0)} a ${formatCop(s.amountCop)}."
                                    else "${s.meses} meses · promedio ${formatCop(s.promedioCop)} · último ${dayLabel(s.ultimaFecha, vista.hoy)}",
                                    style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkFaint,
                                )
                            }
                            Text(formatCop(s.amountCop), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                        }
                        Text(
                            if (s.cambioPrecio) "Actualizar precio" else "Sí, añadir a mis pagos fijos",
                            Modifier.padding(top = 8.dp).clip(Medidas.formaPildora).background(c.accent).pulsable(alPulsar = {
                                val ex = s.recurrenteExistente
                                guardado { if (ex != null) acciones.actualizar(ex.copy(amountCop = s.amountCop)) else acciones.crear(s.nombre, s.kind, s.amountCop, s.categoria, s.cuentaId, s.diaDelMes) }
                            }).padding(horizontal = 16.dp, vertical = 12.dp),
                            style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent,
                        )
                    }
                }
            }

            if (pendientes.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.bg).padding(16.dp)) {
                Text("Ya pasó la fecha de ${pendientes.size} ${if (pendientes.size == 1) "movimiento" else "movimientos"}", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                Text("Confirma solo los que de verdad ocurrieron.", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                pendientes.forEach { p ->
                    Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.card).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(p.recurrente.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
                            Text("${dayLabel(p.fecha, vista.hoy)} · ${formatCop(p.recurrente.amountCop)}", style = LukApp.tipo.xs, color = c.inkFaint)
                        }
                        Row(
                            Modifier.clip(Medidas.formaPildora).background(c.accent).semantics { contentDescription = "Sí pasó: ${p.recurrente.nombre}" }.pulsable(alPulsar = { guardado { acciones.confirmar(p) } }).padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icono(Lucide.Check, tamano = 12.dp, grosor = 3f, color = c.onAccent)
                            Text("Sí pasó", style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent)
                        }
                    }
                }
            }

            if (creando) FormularioPagoFijo(vista, acciones, alListo = { creando = false }) else Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).pulsable(alPulsar = { creando = true }).padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Plus, tamano = 16.dp, grosor = 3f, color = c.inkSoft)
                Text("Nuevo recurrente", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
            }

            if (vivos.isEmpty()) Text(
                "El arriendo, Netflix, el gimnasio. La app te los recuerda cada mes y tú confirmas si de verdad pasaron — no los registra sola.",
                Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint,
            ) else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                vivos.forEach { r ->
                    val e = vista.catalogo.de(r.categoria)
                    Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icono(Lucide.porNombre[e.icono] ?: Lucide.Package, tamano = 16.dp, color = colorHex(e.color))
                        Column(Modifier.weight(1f)) {
                            Text(r.nombre, style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink, maxLines = 1)
                            Text("el ${r.diaDelMes} de cada mes · ${e.nombre}", style = LukApp.tipo.xs, color = c.inkFaint)
                        }
                        Text(
                            (if (r.kind == TipoTx.INGRESO) "+" else "−") + formatCop(r.amountCop),
                            style = LukApp.tipo.de(17, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (r.kind == TipoTx.INGRESO) c.entro else c.salio,
                        )
                        Box(Modifier.size(36.dp).semantics { contentDescription = "Eliminar ${r.nombre}" }.pulsable(alPulsar = { guardado { acciones.borrar(r.id) } }), contentAlignment = Alignment.Center) {
                            Icono(Lucide.Trash2, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FormularioPagoFijo(vista: VistaInicio, acciones: AccionesPagosFijos, alListo: () -> Unit) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    var nombre by rememberSaveable { mutableStateOf("") }
    var monto by rememberSaveable { mutableStateOf("") }
    var dia by rememberSaveable { mutableStateOf("1") }
    var kind by rememberSaveable { mutableStateOf(TipoTx.GASTO) }
    var categoria by rememberSaveable { mutableStateOf("otros") }
    var cuentaId by rememberSaveable { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val cuentas = remember(vista.libro.cajitas) { vista.libro.cajitas.filter { it.archivedAt == null && (it.tipo == "cuenta" || it.tipo == "tarjeta") } }
    val valor = parseAmountInput(monto)
    val valido = nombre.isNotBlank() && valor != null && !guardando

    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Etiquetado("¿Qué es?") { CampoTexto(nombre, { nombre = it }, "Ej: Arriendo", "Nombre") }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Etiquetado("Cuánto", Modifier.weight(1f)) { CampoTexto(monto, { monto = conPuntos(it) }, "0", "Monto", numerico = true) }
            Etiquetado("Qué día", Modifier.weight(1f)) { CampoTexto(dia, { dia = it.filter(Char::isDigit).take(2) }, "1", "Día del mes", numerico = true) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Etiquetado("Tipo", Modifier.weight(1f)) {
                Desplegable(if (kind == TipoTx.GASTO) "Sale" else "Entra", listOf("Sale" to TipoTx.GASTO, "Entra" to TipoTx.INGRESO), "Tipo") { kind = it }
            }
            Etiquetado("Categoría", Modifier.weight(1f)) {
                Desplegable(vista.catalogo.de(categoria).nombre, vista.catalogo.lista.map { it.nombre to it.clave }, "Categoría") { categoria = it }
            }
        }
        if (cuentas.isNotEmpty()) Etiquetado("¿De qué cuenta? (opcional)") {
            Desplegable(cuentas.firstOrNull { it.id == cuentaId }?.nombre ?: "No indicar", listOf("No indicar" to "") + cuentas.map { it.nombre to it.id }, "Cuenta") { cuentaId = it.ifEmpty { null } }
        }
        error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (guardando) "Guardando…" else "Guardar",
                Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent.copy(alpha = if (valido) 1f else 0.4f)).pulsable(habilitado = valido, alPulsar = {
                    guardando = true; error = null
                    ambito.launch {
                        // Igual que la web: el día se acota a 1..31 y un día vacío vale 1.
                        val d = (dia.toIntOrNull() ?: 1).coerceIn(1, 31)
                        if (acciones.crear(nombre.trim(), kind, valor!!, categoria, cuentaId, d)) alListo() else error = "No se pudo guardar. Inténtalo de nuevo."
                        guardando = false
                    }
                }).padding(vertical = 12.dp),
                style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent, textAlign = TextAlign.Center,
            )
            Text("Cancelar", Modifier.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).pulsable(habilitado = !guardando, alPulsar = alListo).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
        }
    }
}

@Composable
internal fun Etiquetado(texto: String, modifier: Modifier = Modifier, contenido: @Composable () -> Unit) {
    Column(modifier) {
        Text(texto, style = LukApp.tipo.de(15, 600, 1.4f), color = LukApp.colores.inkSoft)
        Box(Modifier.padding(top = 8.dp)) { contenido() }
    }
}

@Composable
internal fun CampoTexto(valor: String, alCambiar: (String) -> Unit, marcador: String, descripcion: String, numerico: Boolean = false) {
    val c = LukApp.colores
    val estilo = LukApp.tipo.de(17, 400, 1.3f)
    BasicTextField(
        value = valor, onValueChange = alCambiar, singleLine = true, textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent),
        keyboardOptions = KeyboardOptions(keyboardType = if (numerico) KeyboardType.Number else KeyboardType.Text),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = descripcion }.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).padding(horizontal = 12.dp, vertical = 12.dp),
        decorationBox = { interno -> Box { if (valor.isEmpty()) Text(marcador, style = estilo, color = c.inkGhost); interno() } },
    )
}

@Composable
internal fun Desplegable(actual: String, opciones: List<Pair<String, String>>, descripcion: String, alElegir: (String) -> Unit) {
    val c = LukApp.colores
    var abierto by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.fillMaxWidth().semantics { contentDescription = descripcion }.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).pulsable(escala = 1f, alPulsar = { abierto = true }).padding(horizontal = 12.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(actual, Modifier.weight(1f), style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink, maxLines = 1)
            Icono(Lucide.ChevronDown, tamano = 16.dp, color = c.inkSoft)
        }
        DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            opciones.forEach { (texto, valor) -> DropdownMenuItem(text = { Text(texto) }, onClick = { abierto = false; alElegir(valor) }) }
        }
    }
}
