package app.lukapp.ui.cuenta

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.nombreVisibleCuenta
import app.lukapp.dominio.parseSaldoInput
import app.lukapp.dominio.saldoDeCajita
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.IconoCuenta
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlinx.coroutines.launch
import kotlin.math.min

/**
 * HojaPanel + DetalleCajita.tsx. Hecho: saldo (tocar la cifra para cambiarlo), meta, cuenta principal,
 * historial de ajustes y eliminar. Pendiente (se omite, sin botones vacíos): editar la cuenta (nombre, ícono,
 * meta, rendimientos, tarjeta), enviar dinero a otra cuenta e importar extracto.
 */
@Composable
fun PantallaDetalleCuenta(
    cajita: Cajita,
    vista: VistaInicio,
    alCerrar: () -> Unit,
    alFijarSaldo: suspend (Long) -> Boolean,
    alAlternarFavorita: () -> Unit,
    alEliminar: suspend () -> Boolean,
    alTransferir: suspend (String, Long) -> Boolean,
) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val alcance = rememberCoroutineScope()
    BackHandler(onBack = alCerrar)
    val libro = vista.libro
    val saldo = saldoDeCajita(libro.movimientos, cajita.id, libro.transacciones, idsPasivos(listOf(cajita)))
    val propios = libro.movimientos.count { it.cajitaId == cajita.id }
    val esFavorita = vista.ajustes.cuentaFavoritaId == cajita.id
    var editandoSaldo by remember { mutableStateOf(false) }
    var textoSaldo by remember { mutableStateOf("") }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var mostrarAjustes by remember { mutableStateOf(false) }
    var confirmandoEliminar by remember { mutableStateOf(false) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    val p by animateFloatAsState(if (visible) 1f else 0f, tween(200), label = "entrada")

    Column(
        Modifier.fillMaxSize().graphicsLayer { alpha = p; translationY = (1 - p) * 16.dp.toPx() }.background(c.bg)
            .statusBarsPadding().navigationBarsPadding().imePadding(),
    ) {
        // Cabecera fija de HojaPanel: título (el nombre de la cuenta) y cerrar.
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(nombreVisibleCuenta(cajita), Modifier.weight(1f).padding(end = 12.dp), style = LukApp.tipo.tituloXl, color = c.ink, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(56.dp).clip(Medidas.formaCard).background(c.soft), contentAlignment = Alignment.Center) { IconoCuenta(cajita, 28.dp, c.inkSoft, grosor = 1.75f) }
                Column(Modifier.weight(1f)) {
                    Text(nombreVisibleCuenta(cajita), style = LukApp.tipo.titulo, color = c.ink, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    Text(etiquetaTipoCajita(cajita) + (cajita.tasaEaPct?.takeIf { it > 0 }?.let { " · ${if (it == Math.floor(it)) it.toLong() else it}% E.A." } ?: ""), Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                }
            }

            // Saldo actual: la cifra entera es el botón de editar.
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(20.dp)) {
                Text("SALDO ACTUAL", style = LukApp.tipo.de(13, 500, 1.3f, 0.05f), color = c.inkFaint)
                if (!editandoSaldo) {
                    Row(
                        Modifier.padding(top = 12.dp).fillMaxWidth().semantics { contentDescription = "Cambiar el saldo de ${nombreVisibleCuenta(cajita)}" }
                            .pulsable(escala = 0.98f) { textoSaldo = formatAmountInput(saldo); error = null; editandoSaldo = true },
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom,
                    ) {
                        Text(formatCop(saldo), Modifier.weight(1f, fill = false), style = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink, maxLines = 1)
                        Row(Modifier.padding(bottom = 6.dp).clip(CircleShape).background(c.soft).padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icono(Lucide.Pencil, tamano = 12.dp, grosor = 2.5f, color = c.inkSoft)
                            Text("Editar", style = LukApp.tipo.de(13, 500, 1.3f), color = c.inkSoft)
                        }
                    }
                    Text("Toca la cifra para actualizarla", Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                } else {
                    val foco = remember { FocusRequester() }
                    LaunchedEffect(Unit) { foco.requestFocus() }
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        BasicTextField(
                            value = textoSaldo, onValueChange = { textoSaldo = conPuntos(it) }, singleLine = true, enabled = !ocupado,
                            textStyle = LukApp.tipo.de(28, 700, 1.2f).copy(color = c.ink, fontFeatureSettings = CIFRAS_TABULARES), cursorBrush = SolidColor(c.accent),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth().focusRequester(foco).clip(Medidas.formaCard).border(2.dp, c.accent, Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 16.dp),
                            decorationBox = { interno -> Box { if (textoSaldo.isEmpty()) Text("Escribe 0 si está vacía", style = LukApp.tipo.de(17, 400, 1.3f), color = c.inkGhost); interno() } },
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                Modifier.weight(1f).clip(Medidas.formaControl).background(c.soft).pulsable { editandoSaldo = false }.padding(vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                            ) { Icono(Lucide.X, tamano = 16.dp, grosor = 2.5f, color = c.inkSoft); Text("Cancelar", style = LukApp.tipo.de(15, 600), color = c.inkSoft) }
                            val nuevo = parseSaldoInput(textoSaldo)
                            Row(
                                Modifier.weight(1f).graphicsLayer { alpha = if (!ocupado && nuevo != null) 1f else 0.4f }.clip(Medidas.formaControl).background(c.accent)
                                    .pulsable(habilitado = !ocupado && nuevo != null) {
                                        ocupado = true; error = null
                                        alcance.launch {
                                            val ok = alFijarSaldo(nuevo!!)
                                            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
                                            if (ok) editandoSaldo = false else error = "No se pudo guardar el saldo. Revisa la conexión e inténtalo de nuevo."
                                            ocupado = false
                                        }
                                    }.padding(vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                            ) { Icono(Lucide.Check, tamano = 16.dp, grosor = 2.5f, color = c.onAccent); Text("Guardar", style = LukApp.tipo.de(15, 600), color = c.onAccent) }
                        }
                        if (error != null) Text(error.orEmpty(), style = LukApp.tipo.de(14, 400), color = c.salio)
                    }
                }
                val meta = cajita.metaCop
                if (meta != null && meta > 0) {
                    Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(6.dp).clip(CircleShape).background(c.soft)) {
                        Box(Modifier.fillMaxWidth(min(1f, saldo.toFloat() / meta).coerceAtLeast(0f)).height(6.dp).clip(CircleShape).background(c.accent))
                    }
                    Text("${Math.round(saldo.toDouble() / meta * 100)}% de ${formatCop(meta)}", Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                }
            }

            if (cajita.tipo == "cuenta") {
                Row(
                    Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).border(1.dp, c.line, Medidas.formaCard).padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(40.dp).clip(CircleShape).background(if (esFavorita) c.warnBg else c.soft), contentAlignment = Alignment.Center) {
                        Icono(Lucide.Star, tamano = 20.dp, color = if (esFavorita) c.warnInk else c.inkFaint, relleno = if (esFavorita) Color(0xFFF59E0B) else null)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(if (esFavorita) "Cuenta principal activa" else "Usar como cuenta principal", style = LukApp.tipo.de(15, 700, 1.3f), color = c.ink, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        Text(
                            if (esFavorita) "Se preselecciona por defecto al anotar tus nuevos movimientos." else "Márcala para no tener que elegirla cada vez que anotes.",
                            style = LukApp.tipo.de(13, 400, 1.2f), color = c.inkSoft,
                        )
                    }
                    Text(
                        if (esFavorita) "Desmarcar" else "Activar ⭐",
                        Modifier.clip(CircleShape).background(if (esFavorita) c.warnBg else c.soft).border(1.dp, if (esFavorita) c.warn.copy(.3f) else c.line, CircleShape)
                            .pulsable { hapticos.disparar(Haptico.SELECTION); alAlternarFavorita() }.padding(horizontal = 16.dp, vertical = 8.dp),
                        style = LukApp.tipo.de(13, 700, 1.3f), color = if (esFavorita) c.warnInk else c.ink,
                    )
                }
            }

            Column {
                Row(
                    Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).pulsable { mostrarAjustes = !mostrarAjustes }.padding(horizontal = 16.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Historial de ajustes", style = LukApp.tipo.de(15, 500, 1.3f), color = c.ink)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("$propios", Modifier.clip(CircleShape).background(c.line).padding(horizontal = 8.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 600, 1.2f), color = c.inkFaint)
                        val giro by animateFloatAsState(if (mostrarAjustes) 180f else 0f, tween(200), label = "giro")
                        Icono(Lucide.ChevronDown, Modifier.rotate(giro), tamano = 16.dp, color = c.inkFaint)
                    }
                }
                if (mostrarAjustes) {
                    Text(
                        "$propios ajuste${if (propios != 1) "s" else ""} registrado${if (propios != 1) "s" else ""}",
                        Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(16.dp),
                        style = LukApp.tipo.xs, color = c.inkFaint,
                    )
                }
            }

            PanelTransferir(cajita, libro.cajitas, alTransferir)

            Row(
                Modifier.padding(top = 4.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.salioBg).border(1.dp, c.salio.copy(.3f), Medidas.formaControl)
                    .pulsable { confirmandoEliminar = true }.padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Trash2, tamano = 16.dp, color = c.salio)
                Text("Eliminar cuenta", style = LukApp.tipo.de(15, 600, 1.3f), color = c.salio)
            }
        }
    }

    if (confirmandoEliminar) {
        // El `confirm()` de la web: nada se borra sin preguntar, y se dice que no se puede deshacer.
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { if (!ocupado) confirmandoEliminar = false },
            title = { Text("¿Eliminar ${nombreVisibleCuenta(cajita)}?", style = LukApp.tipo.titulo) },
            text = { Text("Esta acción no se puede deshacer.", style = LukApp.tipo.secundario) },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmandoEliminar = false }, enabled = !ocupado) { Text("Cancelar") } },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    enabled = !ocupado,
                    onClick = {
                        ocupado = true
                        alcance.launch {
                            val ok = alEliminar()
                            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
                            ocupado = false; confirmandoEliminar = false
                            if (!ok) error = "No se pudo eliminar la cuenta. Revisa la conexión e inténtalo de nuevo."
                        }
                    },
                ) { Text(if (ocupado) "Eliminando…" else "Eliminar", color = c.salio) }
            },
        )
    }
}
