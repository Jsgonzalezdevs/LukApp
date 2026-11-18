package app.lukapp.ui.anotar

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.formatSigned
import app.lukapp.dominio.nombreVisibleCuenta
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** DetalleMovimiento.tsx: hoja inferior con la cifra, el dictado original y Editar / Borrar. */
@Composable
fun DetalleMovimiento(tx: Transaccion, catalogo: Catalogo, libro: Libro, hoy: String, alCerrar: () -> Unit, alEditar: () -> Unit, alBorrar: suspend () -> Boolean) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val alcance = rememberCoroutineScope()
    BackHandler(onBack = alCerrar)
    val entrada = catalogo.de(tx.category)
    val esIngreso = tx.kind == "ingreso"
    val esTransferencia = tx.kind == "transferencia"
    var errorBorrado by remember { mutableStateOf(false) }
    var borrando by remember { mutableStateOf(false) }
    val cuenta = libro.cajitas.firstOrNull { it.id == tx.cuentaId }
    Box(Modifier.fillMaxSize().background(c.scrim).pulsable(escala = 1f, alPulsar = alCerrar), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.widthIn(max = 448.dp).fillMaxWidth().clip(Medidas.formaHoja).background(c.sobreFondo(c.glassBg))
                .border(1.dp, c.glassBorder, Medidas.formaHoja).pulsable(escala = 1f) {}
                .navigationBarsPadding().padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 20.dp)
                .semantics { contentDescription = "Detalle de ${tx.description}" },
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
                }
            }
            Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(64.dp).clip(Medidas.formaCard).background(c.soft), contentAlignment = Alignment.Center) { Emoji(entrada.emoji, 28) }
                Text(
                    formatSigned(tx.amountCop, tx.kind), Modifier.padding(top = 16.dp),
                    style = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES),
                    color = if (esIngreso) c.entro else if (esTransferencia) c.inkSoft else c.salio,
                )
                Text(tx.description, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(20, 600, 1.4f), color = c.ink, textAlign = TextAlign.Center)
                Text(
                    "${entrada.nombre} · ${dayLabel(tx.occurredOn, hoy)}" + (cuenta?.let { " · " + nombreVisibleCuenta(it) } ?: ""),
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft, textAlign = TextAlign.Center,
                )
                if (tx.rawTranscript.isNotBlank() && tx.rawTranscript.trim() != tx.description.trim()) {
                    Text(
                        "Dijiste: «${tx.rawTranscript.trim()}»", Modifier.padding(top = 12.dp).clip(Medidas.formaControl).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp),
                        style = LukApp.tipo.de(13, 400, 1.4f).copy(fontStyle = FontStyle.Italic), color = c.inkSoft,
                    )
                }
            }
            if (esTransferencia) {
                Text(
                    "Es un traslado entre tus cuentas: no suma como gasto ni ingreso.",
                    Modifier.padding(top = 20.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp),
                    style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft, textAlign = TextAlign.Center,
                )
            } else {
                if (errorBorrado) Text("No se pudo borrar. El movimiento sigue guardado.", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(14, 400), color = c.salio)
                // Analizar (con IA) no está migrado: no hay botón vacío.
                Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AccionDetalle(Lucide.Pencil, "Editar", c.ink, Modifier.weight(1f)) { alEditar() }
                    AccionDetalle(Lucide.Trash2, if (borrando) "Borrando…" else "Borrar", c.salio, Modifier.weight(1f), habilitada = !borrando) {
                        borrando = true; errorBorrado = false
                        alcance.launch {
                            val ok = alBorrar()
                            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
                            errorBorrado = !ok; borrando = false
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccionDetalle(icono: IconoLucide, texto: String, color: Color, modifier: Modifier, habilitada: Boolean = true, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Column(
        modifier.clip(Medidas.formaControl).background(c.soft).pulsable(habilitado = habilitada, alPulsar = alPulsar).padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icono(icono, tamano = 20.dp, grosor = 2f, color = color)
        Text(texto, style = LukApp.tipo.de(13, 600, 1.3f), color = color)
    }
}

/**
 * ConfirmSheet.tsx en modo editar: monto, tipo, categoría, cuenta (solo cuentas, no tarjetas),
 * descripción y "Guardar cambios". El selector de fecha todavía no está migrado: la fecha se respeta.
 */
@Composable
fun HojaEditar(tx: Transaccion, libro: Libro, catalogo: Catalogo, alGuardar: suspend (Borrador) -> Boolean, alCancelar: () -> Unit) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val alcance = rememberCoroutineScope()
    BackHandler(onBack = alCancelar)
    var monto by rememberSaveable { mutableStateOf(conPuntos(tx.amountCop.toString())) }
    var kind by rememberSaveable { mutableStateOf(tx.kind) }
    var categoria by rememberSaveable { mutableStateOf(tx.category) }
    var descripcion by rememberSaveable { mutableStateOf(tx.description) }
    var cuentaId by rememberSaveable { mutableStateOf(tx.cuentaId) }
    var fecha by rememberSaveable { mutableStateOf(tx.occurredOn) }
    var eligiendoFecha by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    val cuentas = remember(libro.cajitas) { libro.cajitas.filter { it.archivedAt == null && it.tipo == "cuenta" } }
    val opciones = remember(catalogo, categoria) { if (catalogo.lista.any { it.clave == categoria }) catalogo.lista else catalogo.lista + catalogo.de(categoria) }
    val cantidad = parseAmountInput(monto)
    Box(Modifier.fillMaxSize().background(c.scrim), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.widthIn(max = 448.dp).fillMaxWidth().heightIn(max = 760.dp).clip(Medidas.formaHoja).background(c.sobreFondo(c.card))
                .navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 16.dp)
                .semantics { contentDescription = "Editar movimiento" },
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Emoji(catalogo.de(categoria).emoji, 20)
                    Text("Editar movimiento", style = LukApp.tipo.de(17, 600, 1.3f, -0.01f), color = c.ink)
                }
                Box(Modifier.size(32.dp).clip(Medidas.formaControl).semantics { contentDescription = "Cancelar" }.pulsable { hapticos.disparar(Haptico.LIGHT); alCancelar() }, contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 16.dp, grosor = 3f, color = c.inkFaint)
                }
            }
            Etiqueta("Monto", Modifier.padding(top = 20.dp))
            Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("$", style = LukApp.tipo.de(20, 600, 1.2f), color = c.inkFaint)
                BasicTextField(
                    value = monto, onValueChange = { monto = conPuntos(it) }, singleLine = true, enabled = !guardando,
                    textStyle = LukApp.tipo.de(20, 600, 1.2f).copy(color = c.ink, fontFeatureSettings = CIFRAS_TABULARES), cursorBrush = SolidColor(c.accent),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f),
                )
            }
            Etiqueta("Tipo", Modifier.padding(top = 20.dp))
            Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Triple("gasto", "Gasto", Lucide.ArrowDownCircle), Triple("ingreso", "Ingreso", Lucide.ArrowUpCircle)).forEach { (k, texto, icono) ->
                    val activo = kind == k
                    Row(
                        Modifier.weight(1f).clip(Medidas.formaControl).background(if (activo) (if (k == "gasto") c.salioBg else c.entroBg) else Color.Transparent)
                            .pulsable(escala = 0.95f) { hapticos.disparar(Haptico.SELECTION); kind = k }.padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        val tinta = if (activo) (if (k == "gasto") c.salio else c.entro) else c.inkFaint
                        Icono(icono, tamano = 20.dp, color = tinta)
                        Text(texto, style = LukApp.tipo.de(17, 600, 1.3f), color = tinta)
                    }
                }
            }
            Etiqueta("Categoría", Modifier.padding(top = 20.dp))
            androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                opciones.forEach { e ->
                    val activa = categoria == e.clave
                    Row(
                        Modifier.heightIn(min = 44.dp).clip(CircleShape).background(if (activa) c.cardHover else c.sobreFondo(c.card))
                            .border(2.dp, if (activa) c.ink else c.line, CircleShape)
                            .pulsable(escala = 0.94f) { hapticos.disparar(Haptico.SELECTION); categoria = e.clave }.padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Emoji(e.emoji, 17)
                        Text(e.nombre, style = LukApp.tipo.de(15, 600, 1.3f), color = if (activa) c.ink else c.inkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            if (cuentas.isNotEmpty()) {
                Etiqueta(if (kind == "ingreso") "¿A qué cuenta entró? (opcional)" else "¿De qué cuenta salió? (opcional)", Modifier.padding(top = 20.dp))
                var abierto by remember { mutableStateOf(false) }
                Box(Modifier.padding(top = 8.dp)) {
                    Row(
                        Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.sobreFondo(c.card)).pulsable { abierto = true }.padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(cuentas.firstOrNull { it.id == cuentaId }?.let { "${it.nombre} · ${etiquetaTipoCajita(it)}" } ?: "No indicar cuenta", style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Icono(Lucide.ChevronDown, tamano = 16.dp, color = c.inkFaint)
                    }
                    androidx.compose.material3.DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }, modifier = Modifier.background(c.surface)) {
                        androidx.compose.material3.DropdownMenuItem(text = { Text("No indicar cuenta", style = LukApp.tipo.de(15, 400)) }, onClick = { cuentaId = null; abierto = false })
                        cuentas.forEach { cta -> androidx.compose.material3.DropdownMenuItem(text = { Text("${cta.nombre} · ${etiquetaTipoCajita(cta)}", style = LukApp.tipo.de(15, 400)) }, onClick = { cuentaId = cta.id; abierto = false }) }
                    }
                }
                Text("Si la eliges, el saldo de esa cuenta se ajusta solo.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
            }
            Etiqueta("Descripción", Modifier.padding(top = 20.dp))
            BasicTextField(
                value = descripcion, onValueChange = { descripcion = it }, singleLine = true, enabled = !guardando,
                textStyle = LukApp.tipo.de(17, 400, 1.3f).copy(color = c.ink), cursorBrush = SolidColor(c.accent),
                modifier = Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.sobreFondo(c.card)).padding(horizontal = 16.dp, vertical = 12.dp),
            )
            // «Fecha», solo al editar: corregir el día de uno viejo (lo registré tarde, cayó en otra fecha). Sin fechas futuras.
            Etiqueta("Fecha", Modifier.padding(top = 20.dp))
            Row(
                Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.sobreFondo(c.card))
                    .semantics { contentDescription = "Fecha del movimiento" }.pulsable(habilitado = !guardando, escala = 1f) { eligiendoFecha = true }.padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(app.lukapp.dominio.fechaLarga(fecha), style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink)
                Icono(Lucide.CalendarDays, tamano = 16.dp, color = c.inkFaint)
            }
            if (eligiendoFecha) {
                val hoy = remember { app.lukapp.dominio.bogotaDate() }
                val estado = androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = java.time.LocalDate.parse(fecha).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli())
                androidx.compose.material3.DatePickerDialog(
                    onDismissRequest = { eligiendoFecha = false },
                    confirmButton = {
                        androidx.compose.material3.TextButton(onClick = {
                            eligiendoFecha = false
                            val ms = estado.selectedDateMillis ?: return@TextButton
                            fecha = java.time.Instant.ofEpochMilli(ms).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString().let { if (it > hoy) hoy else it }
                        }) { Text("Listo") }
                    },
                    dismissButton = { androidx.compose.material3.TextButton(onClick = { eligiendoFecha = false }) { Text("Cancelar") } },
                ) { androidx.compose.material3.DatePicker(state = estado) }
            }
            if (error) Text("No se pudo guardar. Tus datos siguen aquí para que puedas intentarlo de nuevo.", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(14, 400), color = c.salio)
            val habilitado = !guardando && cantidad != null
            Row(
                Modifier.padding(top = 20.dp).fillMaxWidth().graphicsLayer { alpha = if (habilitado) 1f else 0.3f }.clip(Medidas.formaPildora).background(c.accent)
                    .pulsable(habilitado = habilitado, escala = 0.98f) {
                        guardando = true; error = false
                        alcance.launch {
                            val ok = alGuardar(Borrador(kind, cantidad!!, categoria, descripcion.trim().ifEmpty { catalogo.de(categoria).nombre }, cuentaId, tx.rawTranscript, fecha, tx.cuotasTotal, tx.cuotaCop))
                            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
                            error = !ok; guardando = false
                        }
                    }.padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.CheckCircle2, tamano = 20.dp, color = c.onAccent)
                Text(if (guardando) "Guardando…" else "Guardar cambios", style = LukApp.tipo.de(17, 600), color = c.onAccent)
            }
        }
    }
}

@Composable
private fun Etiqueta(texto: String, modifier: Modifier = Modifier) {
    Text(texto, modifier, style = LukApp.tipo.de(13, 600, 1.3f), color = LukApp.colores.inkSoft)
}

/**
 * AvisoGuardado.tsx: tarjeta de cristal sobre la barra, 5 s de cuenta atrás en «Deshacer»,
 * y se cierra deslizándola hacia abajo (72 px o velocidad 520).
 */
@Composable
fun AvisoGuardado(guardado: Guardado?, estado: String, alDeshacer: suspend (String) -> Boolean, alCerrar: () -> Unit, modifier: Modifier = Modifier) {
    val c = LukApp.colores
    val alcance = rememberCoroutineScope()
    var deshaciendo by remember(guardado?.id) { mutableStateOf(false) }
    var errorDeshacer by remember(guardado?.id) { mutableStateOf(false) }
    var restante by remember(guardado?.id) { mutableStateOf(5) }
    var arrastre by remember(guardado?.id) { mutableStateOf(0f) }
    LaunchedEffect(guardado?.id, deshaciendo) {
        if (guardado == null || deshaciendo || guardado.esError) return@LaunchedEffect
        restante = 5
        repeat(5) { delay(1000); restante -= 1 }
        alCerrar()
    }
    AnimatedVisibility(guardado != null, modifier = modifier, enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { 20 }, exit = fadeOut(tween(200)) + slideOutVertically(tween(200)) { 20 }) {
        val g = guardado ?: return@AnimatedVisibility
        Row(
            Modifier.padding(horizontal = 16.dp).widthIn(max = 384.dp).fillMaxWidth()
                .graphicsLayer { translationY = arrastre.coerceAtLeast(0f); alpha = if (arrastre > 0f) 0.82f else 1f }
                .clip(Medidas.formaCard).background(c.sobreFondo(c.glassBg)).border(1.dp, c.glassBorder, Medidas.formaCard)
                .pointerInput(g.id) {
                    detectVerticalDragGestures(
                        onDragEnd = { if (arrastre > 72f) alCerrar(); arrastre = 0f },
                        onDragCancel = { arrastre = 0f },
                    ) { _, d -> arrastre = (arrastre + d).coerceAtMost(110f) }
                }
                .semantics { liveRegion = LiveRegionMode.Polite }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(if (g.esError) Lucide.AlertTriangle else Lucide.Check, tamano = 20.dp, grosor = if (g.esError) 1.8f else 3f, color = if (g.esError) c.salio else c.accent)
            Column(Modifier.weight(1f)) {
                Text(g.texto, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (g.detalle != null) Text(g.detalle, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkFaint, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (!g.esError) Text(estado, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkSoft)
                if (errorDeshacer) Text("No se pudo deshacer. El movimiento sigue guardado.", style = LukApp.tipo.de(14, 400), color = c.salio)
                if (g.aviso != null) Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icono(Lucide.AlertTriangle, Modifier.padding(top = 1.dp), tamano = 14.dp, grosor = 2.5f, color = c.warn)
                    Text(g.aviso, style = LukApp.tipo.de(13, 400, 1.3f), color = c.warn)
                }
            }
            if (g.permitirDeshacer && !g.esError) {
                Row(
                    Modifier.clip(CircleShape).background(c.soft).pulsable(habilitado = !deshaciendo) {
                        deshaciendo = true; errorDeshacer = false
                        alcance.launch { if (!alDeshacer(g.id)) errorDeshacer = true; deshaciendo = false }
                    }.padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Undo2, tamano = 14.dp, grosor = 2.5f, color = c.ink)
                    Text(if (deshaciendo) "Deshaciendo…" else "Deshacer", style = LukApp.tipo.de(13, 600, 1.3f), color = c.ink)
                    Text("$restante", style = LukApp.tipo.de(13, 400, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint)
                }
            }
        }
    }
}
