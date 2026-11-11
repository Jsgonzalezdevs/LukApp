package app.lukapp.ui.anotar

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.isImeVisible
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.EntradaCategoria
import app.lukapp.dominio.Libro
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.nombreVisibleCuenta
import app.lukapp.dominio.voz.CuentaConocida
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.dominio.voz.aprenderDe
import app.lukapp.dominio.voz.parseTransaction
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.IconoCuenta
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import java.text.Normalizer
import kotlinx.coroutines.launch

/** `claveDescripcion` de Captura.tsx. */
private fun claveDescripcion(texto: String): String =
    Normalizer.normalize(texto, Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").trim().lowercase(java.util.Locale.forLanguageTag("es-CO"))

/**
 * Captura.tsx en su versión de teléfono (sin `escritorio`): pantalla completa
 * con teclado numérico propio. Pendiente: escanear comprobante desde aquí (OCR)
 * y el banner de "primer movimiento de prueba" del onboarding.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun PantallaCaptura(
    parsed: ParsedTransaction,
    libro: Libro,
    catalogo: Catalogo,
    cuentaPorDefecto: String?,
    alGuardar: suspend (Borrador) -> Boolean,
    alCancelar: () -> Unit,
    alReintentarVoz: (() -> Unit)?,
) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val alcance = rememberCoroutineScope()
    val cuentasActivas = remember(libro.cajitas) { libro.cajitas.filter { it.archivedAt == null && (it.tipo == "cuenta" || it.tipo == "tarjeta") } }
    var digitos by rememberSaveable { mutableStateOf(parsed.amount?.toString() ?: "") }
    var kind by rememberSaveable { mutableStateOf(parsed.kind) }
    var category by rememberSaveable { mutableStateOf(parsed.category) }
    var description by rememberSaveable { mutableStateOf(parsed.description) }
    var categoriaDetectada by rememberSaveable { mutableStateOf<String?>(null) }
    var editandoTexto by remember { mutableStateOf(false) }
    var editandoMonto by remember { mutableStateOf(false) }
    var desplegarCuentas by remember { mutableStateOf(false) }
    var pidiendoCuenta by remember { mutableStateOf(false) }
    var mostrarTodas by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var errorGuardado by remember { mutableStateOf(false) }
    var cuentaId by rememberSaveable {
        mutableStateOf(
            parsed.cuentaId?.takeIf { id -> cuentasActivas.any { it.id == id } }
                ?: cuentaPorDefecto?.takeIf { id -> cuentasActivas.any { it.id == id } },
        )
    }
    val cuentaSeleccionada = cuentasActivas.firstOrNull { it.id == cuentaId }
    val amountCop = digitos.toLongOrNull()
    val esGasto = kind == "gasto"
    val colorMonto = if (esGasto) c.salio else c.entro
    val esOCR = parsed.raw.startsWith("[OCR]")
    val s = parsed.signals
    val alertaRevision = when {
        esOCR -> null
        s.amountSource == "none" && parsed.amount != null -> "No escuché un monto; propuse el de un movimiento anterior. Confírmalo o cámbialo."
        s.amountSource == "none" -> "No pude identificar el monto. Escríbelo antes de guardar."
        s.ambiguousAmount -> "Escuché más de una cifra. Confirma que el monto grande sea el total correcto."
        s.kindSource == "default" -> "No quedó claro si el dinero entró o salió. Revisa Gasto o Ingreso."
        else -> null
    }
    val sugerencia = remember(description, kind, category, cuentaId, digitos, libro.transacciones) {
        val clave = claveDescripcion(description)
        if (clave.length < 3) null else {
            libro.transacciones.filter { claveDescripcion(it.description) == clave }.maxByOrNull { it.createdAt }?.takeIf { u ->
                u.kind != kind || u.category != category || u.cuentaId != cuentaId || (digitos.isEmpty() && u.amountCop > 0)
            }
        }
    }
    // Las categorías más usadas en este sentido primero; "otros" al final de los empates.
    val opciones = remember(catalogo, category, kind, libro.transacciones) {
        val frecuencia = libro.transacciones.filter { it.kind == kind }.groupingBy { it.category }.eachCount()
        val lista = if (catalogo.lista.any { it.clave == category }) catalogo.lista else catalogo.lista + catalogo.de(category)
        lista.sortedWith { a, b ->
            val fa = frecuencia[a.clave] ?: 0; val fb = frecuencia[b.clave] ?: 0
            when { fa != fb -> fb - fa; a.clave == "otros" -> 1; b.clave == "otros" -> -1; else -> 0 }
        }
    }
    val frecuentes = opciones.take(5).toMutableList<EntradaCategoria>().also { l ->
        if (l.none { it.clave == category } && l.isNotEmpty()) l[l.lastIndex] = catalogo.de(category)
    }
    val visibles = if (mostrarTodas) opciones else frecuentes

    fun alCambiarDescripcion(texto: String) {
        description = texto
        if (texto.trim().length >= 2) {
            val r = parseTransaction(texto, cuentasActivas.map { CuentaConocida(it.id, it.nombre) }, libro.categorias, aprenderDe(libro.transacciones), libro.transacciones)
            if (r.category.isNotEmpty() && r.category != "otros") { category = r.category; categoriaDetectada = r.category }
            if (r.signals.kindSource == "category-implied" || r.signals.kindSource == "keyword") kind = r.kind
            if (r.cuentaId != null && cuentaId == null) cuentaId = r.cuentaId
        }
    }

    fun ejecutarGuardado(idCuenta: String?) {
        val monto = amountCop ?: return
        if (monto == 0L || guardando) return
        guardando = true; errorGuardado = false
        alcance.launch {
            val ok = alGuardar(
                Borrador(
                    kind, monto, category, description.trim().ifEmpty { catalogo.de(category).nombre }, idCuenta,
                    parsed.raw, parsed.dateOverride, parsed.cuotasTotal, parsed.cuotaCop,
                ),
            )
            errorGuardado = !ok
            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
            guardando = false
        }
    }

    fun guardar() {
        if (amountCop == null || amountCop == 0L) { hapticos.disparar(Haptico.ERROR); return }
        if (cuentaId == null && cuentasActivas.isNotEmpty()) { hapticos.disparar(Haptico.SELECTION); pidiendoCuenta = true; return }
        ejecutarGuardado(cuentaId)
    }

    BackHandler(enabled = !guardando) { if (pidiendoCuenta) pidiendoCuenta = false else alCancelar() }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    val alfa by animateFloatAsState(if (visible) 1f else 0f, tween(150), label = "entrada")

    Box(Modifier.fillMaxSize().graphicsLayer { alpha = alfa }.background(c.bg).semantics { contentDescription = "Anotar un movimiento" }) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding().padding(horizontal = 16.dp).padding(top = 16.dp, bottom = 16.dp)) {
            // Cabecera: Gasto / Ingreso y cerrar.
            Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clip(CircleShape).background(c.soft).padding(4.dp)) {
                    listOf(Triple("gasto", "Gasto", Lucide.ArrowDownRight), Triple("ingreso", "Ingreso", Lucide.ArrowUpRight)).forEach { (k, texto, icono) ->
                        val activo = kind == k
                        Row(
                            Modifier.clip(CircleShape).background(if (activo) (if (k == "gasto") c.salio else c.entro) else Color.Transparent)
                                .pulsable(habilitado = !guardando) { hapticos.disparar(Haptico.SELECTION); kind = k }
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            val tinta = if (activo) c.onAccent else c.inkFaint
                            Icono(icono, tamano = 14.dp, grosor = 2.5f, color = tinta)
                            Text(texto, style = LukApp.tipo.de(13, 700, 1.5f), color = tinta)
                        }
                    }
                }
                Box(
                    Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar sin guardar" }.pulsable(habilitado = !guardando, alPulsar = alCancelar),
                    contentAlignment = Alignment.Center,
                ) { Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft) }
            }

            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                Text(
                    parsed.dateOverride?.let { it.substring(8) + "/" + it.substring(5, 7) } ?: "Hoy",
                    Modifier.padding(top = 8.dp).clip(CircleShape).background(c.soft).padding(horizontal = 12.dp, vertical = 8.dp),
                    style = LukApp.tipo.de(13, 500, 1.3f), color = c.inkSoft,
                )

                if (parsed.raw.isNotBlank() && !esOCR) {
                    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.card).border(1.dp, c.line, Medidas.formaCard).padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icono(Lucide.Ear, tamano = 14.dp, color = c.inkFaint)
                                Text("TU DICTADO", style = LukApp.tipo.de(13, 700, 1.3f, 0.05f), color = c.inkFaint)
                            }
                            if (alReintentarVoz != null) {
                                Row(
                                    Modifier.clip(CircleShape).background(c.soft).pulsable(habilitado = !guardando, alPulsar = alReintentarVoz).padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icono(Lucide.Mic, tamano = 14.dp, color = c.inkSoft)
                                    Text("Dictar otra vez", style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                                }
                            }
                        }
                        Text("“${parsed.raw.trim()}”", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 500, 1.625f), color = c.ink)
                        if (alertaRevision != null) {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icono(Lucide.AlertTriangle, Modifier.padding(top = 4.dp), tamano = 14.dp, grosor = 2.5f, color = c.warn)
                                Text(alertaRevision, style = LukApp.tipo.de(13, 600, 1.375f), color = c.warn)
                            }
                        }
                    }
                }
                if (parsed.cuotasTotal != null && parsed.cuotaCop != null) {
                    Text(
                        "Compra a ${parsed.cuotasTotal} cuotas de $${formatAmountInput(parsed.cuotaCop)} al mes. Se cargará a tu tarjeta cuando la elijas.",
                        Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).border(1.dp, c.warn.copy(.3f), Medidas.formaCard).padding(horizontal = 12.dp, vertical = 8.dp),
                        style = LukApp.tipo.de(13, 600, 1.4f), color = c.warnInk, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
                if (sugerencia != null) {
                    val cuentaSug = cuentasActivas.firstOrNull { it.id == sugerencia.cuentaId }
                    Row(
                        Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.soft).border(1.dp, c.accent.copy(.2f), Medidas.formaCard).padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icono(Lucide.Sparkles, tamano = 16.dp, grosor = 2.3f, color = c.accent)
                        Text(
                            buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.ink)) { append("Como la última vez:") }
                                append(" " + catalogo.de(sugerencia.category).nombre + (cuentaSug?.let { " · " + nombreVisibleCuenta(it) } ?: ""))
                            },
                            Modifier.weight(1f), style = LukApp.tipo.de(13, 400, 1.375f), color = c.inkSoft,
                        )
                        Text(
                            "Usar",
                            Modifier.clip(CircleShape).background(c.card).pulsable {
                                hapticos.disparar(Haptico.SELECTION)
                                kind = sugerencia.kind; category = sugerencia.category; cuentaId = sugerencia.cuentaId
                                if (digitos.isEmpty()) digitos = sugerencia.amountCop.toString()
                                categoriaDetectada = sugerencia.category
                            }.padding(horizontal = 12.dp, vertical = 8.dp),
                            style = LukApp.tipo.de(13, 700, 1.3f), color = c.ink,
                        )
                    }
                }

                if (cuentasActivas.isNotEmpty()) {
                    Box(Modifier.padding(top = 12.dp)) {
                        val forma = Medidas.formaControl
                        Row(
                            Modifier.fillMaxWidth().clip(forma)
                                .background(if (cuentaSeleccionada != null) c.card else c.warnBg)
                                .border(1.dp, if (cuentaSeleccionada != null) c.line else c.warn.copy(.3f), forma)
                                .pulsable(habilitado = !guardando) { desplegarCuentas = !desplegarCuentas }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (cuentaSeleccionada != null) IconoCuenta(cuentaSeleccionada, 18.dp, c.inkSoft) else Icono(Lucide.Wallet, tamano = 16.dp, color = c.warnInk)
                            Text(
                                cuentaSeleccionada?.let { nombreVisibleCuenta(it) } ?: "¿Desde qué cuenta o tarjeta?",
                                Modifier.weight(1f), style = LukApp.tipo.de(13, 600, 1.4f),
                                color = if (cuentaSeleccionada != null) c.ink else c.warnInk, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                            val giro by animateFloatAsState(if (desplegarCuentas) 180f else 0f, tween(200), label = "giro")
                            Icono(Lucide.ChevronDown, Modifier.rotate(giro), tamano = 16.dp, color = if (cuentaSeleccionada != null) c.inkFaint else c.warnInk)
                        }
                        androidx.compose.material3.DropdownMenu(
                            expanded = desplegarCuentas, onDismissRequest = { desplegarCuentas = false },
                            modifier = Modifier.background(c.surface).widthIn(min = 250.dp),
                        ) {
                            Text("CUENTA O TARJETA DE PAGO", Modifier.padding(horizontal = 12.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 700, 1.3f, 0.05f), color = c.inkFaint)
                            cuentasActivas.forEach { cta ->
                                OpcionCuenta(cta, cta.id == cuentaId, cta.id == cuentaPorDefecto) {
                                    hapticos.disparar(Haptico.SELECTION); cuentaId = cta.id; desplegarCuentas = false
                                }
                            }
                            Row(
                                Modifier.fillMaxWidth().background(if (cuentaId == null) c.soft else Color.Transparent)
                                    .pulsable { hapticos.disparar(Haptico.SELECTION); cuentaId = null; desplegarCuentas = false }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Sin cuenta (Solo registrar)", style = LukApp.tipo.de(13, if (cuentaId == null) 700 else 400), color = if (cuentaId == null) c.ink else c.inkFaint)
                                if (cuentaId == null) Icono(Lucide.Check, tamano = 14.dp, color = c.accent)
                            }
                        }
                    }
                }

                // Monto.
                Column(Modifier.padding(top = 16.dp)) {
                    Text("Monto en pesos colombianos", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                    val estiloCifra = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES, color = if (amountCop == null) c.inkGhost else colorMonto)
                    if (editandoMonto) {
                        val foco = remember { FocusRequester() }
                        LaunchedEffect(Unit) { foco.requestFocus() }
                        val tecladoVisible = WindowInsets.isImeVisible
                        var seAbrio by remember { mutableStateOf(false) }
                        LaunchedEffect(tecladoVisible) { if (tecladoVisible) seAbrio = true else if (seAbrio) editandoMonto = false }
                        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(if (esGasto) "−$" else "+$", style = estiloCifra)
                            BasicTextField(
                                value = formatAmountInput(amountCop),
                                onValueChange = { t -> digitos = t.filter(Char::isDigit).replaceFirst(Regex("^0+(?=\\d)"), "").take(12) },
                                textStyle = estiloCifra, singleLine = true, enabled = !guardando,
                                cursorBrush = SolidColor(colorMonto),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f).focusRequester(foco),
                            )
                        }
                        Text("Usar teclado de LukApp", Modifier.padding(top = 8.dp).pulsable { editandoMonto = false }, style = LukApp.tipo.de(14, 600), color = c.inkSoft)
                    } else {
                        Text(
                            (if (esGasto) "−$" else "+$") + formatAmountInput(amountCop),
                            Modifier.padding(top = 8.dp).fillMaxWidth().semantics { contentDescription = "Escribir el monto" }.pulsable(habilitado = !guardando) { editandoMonto = true },
                            style = estiloCifra,
                        )
                        Text("Toca el monto para escribirlo con tu teclado.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                    }
                }

                // Descripción.
                if (editandoTexto) {
                    val foco = remember { FocusRequester() }
                    LaunchedEffect(Unit) { foco.requestFocus() }
                    // El `onBlur` de la web: al cerrar el teclado del sistema (Atrás) se vuelve al teclado de LukApp.
                    val tecladoVisible = WindowInsets.isImeVisible
                    var seAbrio by remember { mutableStateOf(false) }
                    LaunchedEffect(tecladoVisible) { if (tecladoVisible) seAbrio = true else if (seAbrio) editandoTexto = false }
                    BasicTextField(
                        value = description, onValueChange = ::alCambiarDescripcion, enabled = !guardando,
                        textStyle = LukApp.tipo.de(20, 400, 1.4f).copy(color = c.ink), cursorBrush = SolidColor(c.accent),
                        modifier = Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(max = 128.dp).focusRequester(foco),
                        decorationBox = { interno ->
                            Box { if (description.isEmpty()) Text("¿En qué fue? Ej: Almuerzo, Uber, Mercado...", style = LukApp.tipo.de(20, 400, 1.4f), color = c.inkGhost); interno() }
                        },
                    )
                } else {
                    Text(
                        description.trim().ifEmpty { "¿En qué fue?" },
                        Modifier.padding(top = 12.dp).fillMaxWidth().pulsable(habilitado = !guardando) { editandoTexto = true },
                        style = LukApp.tipo.de(20, 400, 1.4f), color = if (description.isBlank()) c.inkGhost else c.ink,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }

                // Categorías.
                Column(Modifier.padding(top = 16.dp)) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("CATEGORÍA · ${catalogo.de(category).nombre.uppercase()}", Modifier.weight(1f), style = LukApp.tipo.de(13, 700, 1.3f, 0.05f), color = c.inkSoft)
                        val detectada = categoriaDetectada
                        if (detectada != null) {
                            Row(Modifier.clip(CircleShape).background(c.warnBg).padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icono(Lucide.Sparkles, tamano = 12.dp, color = c.warnInk)
                                Text("Detectada: ${catalogo.de(detectada).nombre}", style = LukApp.tipo.de(13, 700, 1.3f), color = c.warnInk)
                            }
                        }
                    }
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        visibles.forEach { e ->
                            val activa = category == e.clave
                            Row(
                                Modifier.then(if (activa) Modifier.shadow(1.dp, CircleShape) else Modifier).clip(CircleShape)
                                    .background(if (activa) c.cardHover else c.soft)
                                    .border(1.dp, if (activa) c.ink else Color.Transparent, CircleShape)
                                    .pulsable(habilitado = !guardando) { hapticos.disparar(Haptico.SELECTION); category = e.clave; categoriaDetectada = null }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Emoji(e.emoji, 17)
                                Text(e.nombre, style = LukApp.tipo.de(13, 600, 1.4f), color = if (activa) c.ink else c.inkSoft)
                            }
                        }
                    }
                    Text(
                        if (mostrarTodas) "Solo frecuentes" else "Ver todas las categorías",
                        Modifier.padding(top = 4.dp).pulsable(habilitado = !guardando) { mostrarTodas = !mostrarTodas }.padding(horizontal = 8.dp, vertical = 8.dp),
                        style = LukApp.tipo.de(14, 600), color = c.inkSoft,
                    )
                }
            }

            // Abajo: teclado y guardar.
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
                if (!editandoMonto && !editandoTexto) {
                    TecladoNumerico(
                        alDigito = { n -> if (!guardando) digitos = (digitos + n).replaceFirst(Regex("^0+(?=\\d)"), "").take(12) },
                        alBorrar = { if (!guardando) digitos = digitos.dropLast(1) },
                    )
                }
                if (errorGuardado) Text("No se pudo guardar. Tus datos siguen aquí para que puedas intentarlo de nuevo.", style = LukApp.tipo.de(14, 400), color = c.salio)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(48.dp).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Escribir la descripción" }
                            .pulsable(habilitado = !guardando) { editandoTexto = true },
                        contentAlignment = Alignment.Center,
                    ) { Icono(Lucide.Keyboard, tamano = 20.dp, grosor = 2f, color = c.inkSoft) }
                    val habilitado = !guardando && amountCop != null && amountCop != 0L
                    Row(
                        Modifier.weight(1f).height(48.dp).graphicsLayer { alpha = if (habilitado) 1f else 0.3f }.clip(Medidas.formaControl).background(c.accent)
                            .pulsable(habilitado = habilitado) { guardar() },
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icono(Lucide.Check, tamano = 20.dp, grosor = 2.5f, color = c.onAccent)
                        Text(if (guardando) "Guardando…" else "Guardar", style = LukApp.tipo.de(17, 600), color = c.onAccent)
                    }
                }
            }
        }

        // "¿De qué cuenta salió?" antes de guardar sin cuenta.
        AnimatedVisibility(pidiendoCuenta, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(.6f)).pulsable(escala = 1f) { pidiendoCuenta = false }, contentAlignment = Alignment.BottomCenter) {
                AnimatedVisibility(pidiendoCuenta, enter = slideInVertically(tween(200)) { it / 4 }, exit = slideOutVertically(tween(200)) { it / 4 }) {
                    Column(
                        Modifier.widthIn(max = 448.dp).fillMaxWidth().clip(Medidas.formaHoja).background(c.sobreFondo(c.card)).border(1.dp, c.line, Medidas.formaHoja)
                            .pulsable(escala = 1f) {}.navigationBarsPadding().padding(20.dp),
                    ) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(36.dp).clip(CircleShape).background(c.accent.copy(.15f)), contentAlignment = Alignment.Center) { Icono(Lucide.Wallet, tamano = 20.dp, color = c.accent) }
                                Column {
                                    Text(if (esGasto) "¿De qué cuenta salió?" else "¿En qué cuenta entró?", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                                    Text("Elige el banco para actualizar tu saldo:", style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkSoft)
                                }
                            }
                            Box(Modifier.size(36.dp).clip(CircleShape).pulsable { pidiendoCuenta = false }, contentAlignment = Alignment.Center) { Icono(Lucide.X, tamano = 20.dp, color = c.inkFaint) }
                        }
                        Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
                        Column(Modifier.padding(top = 16.dp).heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            cuentasActivas.forEach { cta ->
                                Row(
                                    Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).border(1.dp, c.line, Medidas.formaCard)
                                        .pulsable { cuentaId = cta.id; pidiendoCuenta = false; ejecutarGuardado(cta.id) }.padding(16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(Modifier.size(36.dp).clip(CircleShape).background(c.card), contentAlignment = Alignment.Center) { IconoCuenta(cta, 22.dp, c.ink) }
                                    Text(nombreVisibleCuenta(cta), Modifier.weight(1f), style = LukApp.tipo.de(15, 700), color = c.ink)
                                    if (cta.id == cuentaPorDefecto) Principal()
                                    Icono(Lucide.ArrowDownRight, tamano = 16.dp, color = c.inkFaint)
                                }
                            }
                            Text(
                                "Anotar sin cuenta bancaria (No mover saldo)",
                                Modifier.padding(top = 4.dp).fillMaxWidth().clip(Medidas.formaCard).pulsable { cuentaId = null; pidiendoCuenta = false; ejecutarGuardado(null) }.padding(12.dp),
                                style = LukApp.tipo.de(13, 600), color = c.inkSoft, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Principal() {
    val c = LukApp.colores
    Row(Modifier.clip(CircleShape).background(c.warnBg).padding(horizontal = 8.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icono(Lucide.Star, tamano = 12.dp, color = c.warnInk, relleno = Color(0xFFF59E0B))
        Text("Principal", style = LukApp.tipo.de(13, 700), color = c.warnInk)
    }
}

@Composable
private fun OpcionCuenta(cuenta: Cajita, activa: Boolean, principal: Boolean, alElegir: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaControl).background(if (activa) c.soft else Color.Transparent).pulsable(alPulsar = alElegir).padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        IconoCuenta(cuenta, 18.dp, c.inkSoft)
        Column(Modifier.weight(1f, fill = false)) {
            Text(nombreVisibleCuenta(cuenta), style = LukApp.tipo.de(15, if (activa) 700 else 400), color = if (activa) c.ink else c.inkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(etiquetaTipoCajita(cuenta), style = LukApp.tipo.de(13, 400), color = c.inkFaint)
        }
        if (principal) Principal()
        if (activa) Icono(Lucide.Check, tamano = 16.dp, color = c.accent)
    }
}

/** TecladoNumerico.tsx (compacto): 3 columnas de teclas de 48dp, con "000" y borrar. */
@Composable
private fun TecladoNumerico(alDigito: (String) -> Unit, alBorrar: () -> Unit) {
    val c = LukApp.colores
    val teclas = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.semantics { contentDescription = "Teclado de números" }) {
        teclas.chunked(3).forEach { fila ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                fila.forEach { t ->
                    Box(
                        Modifier.weight(1f).height(48.dp).clip(Medidas.formaControl).background(c.soft)
                            .then(if (t == "⌫") Modifier.semantics { contentDescription = "Borrar el último número" } else Modifier)
                            .pulsable(escala = 0.95f) { if (t == "⌫") alBorrar() else alDigito(t) },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (t == "⌫") Icono(Lucide.Delete, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                        else Text(t, style = LukApp.tipo.de(20, 600).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                    }
                }
            }
        }
    }
}
