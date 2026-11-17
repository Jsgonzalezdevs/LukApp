package app.lukapp.ui.inicio

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import app.lukapp.dominio.etiquetaDePeriodo
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.periodoAdyacente
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.BotonRedondo
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.Pildora
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import java.util.Locale

/** `formatMontoCompacto` de InicioView.tsx:80-91 (toFixed(1) y quitar el primer ".0"). */
internal fun formatMontoCompacto(monto: Long): String {
    if (monto == 0L) return "$0"
    if (monto >= 1_000_000) return "$" + String.format(Locale.ROOT, "%.1f", monto / 1_000_000.0).replaceFirst(".0", "") + "M"
    if (monto >= 1_000) return "$" + String.format(Locale.ROOT, "%.1f", monto / 1_000.0).replaceFirst(".0", "") + "K"
    return "$$monto"
}

/**
 * InicioView.tsx. Está lo que ya tiene sus datos migrados: cabecera con período,
 * racha, privacidad, buscar y ajustes; "Dinero disponible" del motor financiero;
 * bancos y efectivo; la pastilla de gastos e ingresos y la lista de movimientos.
 *
 * Lo que falta (ver docs/android/MIGRACION.md) se omite y no se simula:
 * próximos pagos, la decisión financiera y el carrusel de categorías (el desplegable solo trae Pulso Premium y «Para ti»),
 * novedades y el modal de racha. Buscar, ajustes y abrir un
 * movimiento llegan como lambdas opcionales: si su destino no existe todavía,
 * el botón no se muestra.
 */
@Composable
fun PantallaInicio(
    vista: VistaInicio,
    alElegirPeriodo: (String) -> Unit,
    alAlternarPrivacidad: () -> Unit,
    alVerMes: () -> Unit,
    alAjustes: () -> Unit,
    alBuscar: (() -> Unit)? = null,
    alAbrirMovimiento: ((app.lukapp.dominio.Transaccion) -> Unit)? = null,
    alVerRacha: (() -> Unit)? = null,
    insights: ModeloInsights? = null,
    alConsultarAsesor: ((String) -> Unit)? = null,
    alVerPagos: (() -> Unit)? = null,
) {
    val c = LukApp.colores
    val privacidad = vista.ajustes.privacidad
    var categoriaFiltro by rememberSaveable { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxWidth().padding(bottom = 128.dp)) {
        // ── 1. Cabecera ──
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            SelectorPeriodo(vista, alElegirPeriodo)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                BotonRacha(vista.racha.rachaActual, alVerRacha)
                BotonRedondo(
                    if (privacidad) "Mostrar saldos" else "Ocultar saldos",
                    fondo = if (privacidad) c.warnBg else c.soft,
                    alPulsar = alAlternarPrivacidad,
                ) { Icono(if (privacidad) Lucide.EyeOff else Lucide.Eye, tamano = 16.dp, grosor = 2.2f, color = if (privacidad) c.warnInk else c.inkSoft) }
                if (alBuscar != null) {
                    BotonRedondo("Buscar movimientos y funciones", alPulsar = alBuscar) { Icono(Lucide.Search, tamano = 16.dp, grosor = 2.2f, color = c.inkSoft) }
                }
                BotonRedondo("Ajustes", alPulsar = alAjustes) { Icono(Lucide.Settings2, tamano = 16.dp, grosor = 2.2f, color = c.inkSoft) }
            }
        }

        // ── 3. Dinero disponible ──
        Column(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "DINERO DISPONIBLE",
                Modifier.clip(CircleShape).background(c.soft.copy(alpha = 0.75f)).padding(horizontal = 12.dp, vertical = 4.dp),
                style = LukApp.tipo.de(13, 700, 1.4f, 0.05f), color = c.inkSoft,
            )
            val cifra = vista.contexto.liquidez.dineroLibreCop
            // AnimatedNumber no interpola: re-monta la cifra con y 2→0 en 0.16s (AnimatedNumber.tsx:23-26).
            AnimatedContent(
                targetState = if (privacidad) "$ ••••••" else formatCop(cifra),
                transitionSpec = { (fadeIn(tween(160)) + slideInVertically(tween(160)) { 2 }) togetherWith fadeOut(tween(0)) },
                label = "cifra",
                modifier = Modifier.padding(top = 8.dp).semantics { contentDescription = "Ver el resumen de mi dinero" }.pulsable(escala = 0.98f, alPulsar = alVerMes),
            ) { texto ->
                Text(texto, style = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
            }
            Text(
                if (vista.preparacion.saldosCompletos) "Saldo total menos ahorros reservados y obligaciones."
                else "Las cuentas sin saldo cuentan como $0. Ajústalo cuando quieras.",
                Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center,
            )
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Desglose("Bancos", if (privacidad) "$ ••••••" else formatCop(vista.contexto.saldo.saldoBancosCop))
                Text("•", style = LukApp.tipo.xs, color = c.line)
                Desglose("Efectivo", if (privacidad) "$ ••••••" else formatCop(vista.contexto.saldo.saldoEfectivoCop))
            }
            Pildora(
                Modifier.padding(top = 14.dp).shadow(1.dp, CircleShape, ambientColor = Color.Black.copy(.05f))
                    .clip(CircleShape).pulsable(escala = 0.95f, etiqueta = "Ver desglose del periodo", alPulsar = alVerMes),
                separacion = 10.dp,
            ) {
                val estilo = LukApp.tipo.de(14, 700, 1.4f).copy(fontSize = androidx.compose.ui.unit.TextUnit(13.5f, androidx.compose.ui.unit.TextUnitType.Sp), fontFeatureSettings = CIFRAS_TABULARES)
                Text("↓ " + if (privacidad) "••••" else formatMontoCompacto(vista.totales.gastos), style = estilo, color = c.salio)
                Text("|", style = estilo, color = c.line)
                Text("↑ " + if (privacidad) "••••" else formatMontoCompacto(vista.totales.ingresos), style = estilo, color = c.entro)
            }
        }

        // ── 2b. Próximos pagos (se apaga desde Más → «Próximos pagos») ──
        if (vista.ajustes.proximosPagos) ProximosPagosInicio(vista, alVerPagos ?: alVerMes)

        // ── 6. Filtro por categoría ──
        val filtro = categoriaFiltro
        if (filtro != null) {
            Row(
                Modifier.padding(vertical = 8.dp).fillMaxWidth().clip(CircleShape).background(c.soft).padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    buildAnnotatedString {
                        append("Mostrando solo: ")
                        withStyle(SpanStyle(color = c.ink, fontWeight = FontWeight.Bold)) { append(filtro.replaceFirstChar { it.uppercase() }) }
                    },
                    style = LukApp.tipo.xs, color = c.inkSoft,
                )
                Row(Modifier.pulsable { categoriaFiltro = null }, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Ver todos", style = LukApp.tipo.de(13, 600), color = c.ink)
                    Icono(Lucide.X, tamano = 14.dp, color = c.ink)
                }
            }
        }

        // ── 7. Movimientos (historial completo, no solo el período: `historial={transacciones}`) ──
        Column(Modifier.padding(top = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Movimientos", style = LukApp.tipo.de(17, 600, 1.4f), color = c.ink)
                if (alBuscar != null) {
                    Box(Modifier.size(32.dp).clip(Medidas.formaControl).semantics { contentDescription = "Buscar en el historial" }.pulsable(alPulsar = alBuscar), contentAlignment = Alignment.Center) {
                        Icono(Lucide.Search, tamano = 16.dp, color = c.inkSoft)
                    }
                }
            }
            val historial = remember(vista.libro.transacciones, filtro) {
                (if (filtro != null) vista.libro.transacciones.filter { it.category == filtro } else vista.libro.transacciones)
                    .sortedWith(compareByDescending<app.lukapp.dominio.Transaccion> { it.occurredOn }.thenByDescending { it.createdAt })
            }
            if (historial.isEmpty()) {
                Text(
                    if (filtro != null) "No hay movimientos de ${vista.catalogo.de(filtro).nombre}." else "Aquí aparecerán tus movimientos.",
                    Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    style = LukApp.tipo.de(14, 400, 1.43f), color = c.inkSoft, textAlign = TextAlign.Center,
                )
            } else {
                ListaMovimientos(historial, vista.catalogo, privacidad, vista.hoy, alAbrirMovimiento)
            }
        }

        // ── 4. Análisis del período (debajo de la lista, como en la web): decisión, categorías, Pulso Premium y «Para ti» ──
        if (vista.preparacion.primerMovimiento) {
            val completos = vista.preparacion.saldosCompletos
            var visibles = emptyList<app.lukapp.dominio.Insight>()
            var pulso = false
            var cargando = false
            var refrescar: () -> Unit = {}
            if (insights != null) {
                val prest by insights.prestaciones.collectAsState()
                val ia by insights.insightsIa.collectAsState()
                val enCarga by insights.cargandoIa.collectAsState()
                val descartes by insights.descartados.collectAsState()
                // Anclado al mes calendario salvo con período mensual, como `mesCalendarioActivo` de LukAppApp.
                val mes = if (vista.ajustes.periodo.frecuencia == app.lukapp.dominio.FrecuenciaPeriodo.MENSUAL)
                    app.lukapp.dominio.monthKey(if (vista.clavePeriodo.length > 7) vista.clavePeriodo else vista.clavePeriodo + "-01")
                else app.lukapp.dominio.monthKey(vista.hoy)
                val locales = remember(vista.libro.transacciones, vista.libro.presupuestos, mes, vista.hoy, vista.catalogo, vista.ajustes.periodo, vista.ajustes.umbralAlertaPct) {
                    app.lukapp.dominio.insightsDelMes(vista.libro.transacciones, vista.libro.presupuestos, mes, vista.hoy, { vista.catalogo.de(it).nombre }, vista.ajustes.periodo, vista.ajustes.umbralAlertaPct)
                }
                val n = vista.libro.transacciones.size
                androidx.compose.runtime.LaunchedEffect(mes, n) { insights.actualizarPlan(mes, n) }
                visibles = (if (ia.isNotEmpty()) ia else locales).filter { it.id !in descartes }
                pulso = prest.pulsoPremium
                cargando = enCarga
                refrescar = { insights.refrescar(mes, n) }
            }
            BloqueAnalisis(
                vista, if (completos) visibles else emptyList(),
                decision = completos && vista.ajustes.decisiones, filtro = categoriaFiltro, alFiltrar = { categoriaFiltro = it },
                pulsoPremium = pulso && completos, cargandoIa = cargando,
                alRefrescar = refrescar, alDescartar = { insights?.descartar(it) }, alConsultar = { alConsultarAsesor?.invoke(it) },
            )
        }
    }
}

@Composable
private fun Desglose(etiqueta: String, valor: String) {
    val c = LukApp.colores
    Text(
        buildAnnotatedString {
            append("$etiqueta: ")
            withStyle(SpanStyle(color = c.ink, fontWeight = FontWeight.SemiBold, fontFeatureSettings = CIFRAS_TABULARES)) { append(valor) }
        },
        style = LukApp.tipo.xs, color = c.inkSoft,
    )
}

@Composable
private fun BotonRacha(dias: Int, alPulsar: (() -> Unit)?) {
    val c = LukApp.colores
    val activa = dias > 0
    val unidad = if (dias == 1) "día" else "días"
    Row(
        Modifier
            .height(34.dp)
            .clip(CircleShape)
            .background(if (activa) c.warnBg else c.soft)
            .border(1.dp, if (activa) c.warn.copy(alpha = 0.35f) else c.line, CircleShape)
            .semantics { contentDescription = if (activa) "Racha activa: $dias $unidad" else "Sin racha activa. Ver tu racha" }
            .then(if (alPulsar != null) Modifier.pulsable(escala = 0.95f, alPulsar = alPulsar) else Modifier)
            .padding(horizontal = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // IconoSimbolo "Flame" es el emoji 🔥; sin racha la web lo pone en gris al 70%.
        Box(
            Modifier
                .graphicsLayer { alpha = if (activa) 1f else 0.7f; compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
                .then(if (activa) Modifier else Modifier.drawWithContent {
                    drawContent()
                    // `grayscale` de CSS: se le quita la saturación al emoji pintando gris en modo Saturation.
                    drawRect(Color.Gray, blendMode = androidx.compose.ui.graphics.BlendMode.Saturation)
                }),
        ) { Emoji("🔥", 16) }
        val estilo = LukApp.tipo.de(12, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES)
        Text("$dias $unidad", style = estilo, color = if (activa) c.warnInk else c.inkSoft)
        if (activa) Text("Activa", style = estilo, color = c.warnInk)
    }
}

@Composable
private fun SelectorPeriodo(vista: VistaInicio, alElegir: (String) -> Unit) {
    val c = LukApp.colores
    var abierto by remember { mutableStateOf(false) }
    val giro by animateFloatAsState(if (abierto) 180f else 0f, tween(160), label = "chevron")
    Box {
        Pildora(
            Modifier.clip(CircleShape).semantics { contentDescription = "Cambiar período" }.pulsable { abierto = !abierto },
        ) {
            Emoji("🗓️", 13, Modifier.graphicsLayer { alpha = 0.8f })
            Text(
                etiquetaDePeriodo(vista.clavePeriodo, vista.ajustes.periodo).replaceFirstChar { it.uppercase() },
                style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink, maxLines = 1,
            )
            Icono(Lucide.ChevronDown, Modifier.rotate(giro), tamano = 14.dp, grosor = 2.5f, color = c.inkFaint)
        }
        if (abierto) {
            Popup(
                offset = androidx.compose.ui.unit.IntOffset(0, 0),
                alignment = Alignment.TopStart,
                onDismissRequest = { abierto = false },
                properties = PopupProperties(focusable = true),
            ) {
                // Resorte de framer: stiffness 720, damping 32, mass 0.42 → razón ≈ 0.91.
                var visible by remember { mutableStateOf(false) }
                androidx.compose.runtime.LaunchedEffect(Unit) { visible = true }
                val p by animateFloatAsState(if (visible) 1f else 0f, spring(dampingRatio = 0.91f, stiffness = 720f / 0.42f), label = "menu")
                Column(
                    Modifier
                        .padding(top = 48.dp)
                        // `min-w-[190px]` y ancho según el contenido, no el de la pantalla.
                        .width(androidx.compose.foundation.layout.IntrinsicSize.Max)
                        .widthIn(min = 190.dp)
                        .graphicsLayer {
                            alpha = p
                            scaleY = 0.72f + 0.28f * p
                            translationY = (1 - p) * -5.dp.toPx()
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
                        }
                        .shadow(42.dp, Medidas.formaCard, ambientColor = Color.Black.copy(.42f), spotColor = Color.Black.copy(.42f))
                        .clip(Medidas.formaCard)
                        .background(Brush.linearGradient(listOf(c.soft, mezclarOpaco(c.card, c.bg), c.bg)))
                        .border(1.dp, Color.White.copy(alpha = 0.15f), Medidas.formaCard)
                        .padding(8.dp),
                ) {
                    (0 until 13).map { periodoAdyacente(vista.maxClavePeriodo, -it, vista.ajustes.periodo) }.forEach { clave ->
                        val actual = clave == vista.clavePeriodo
                        Text(
                            etiquetaDePeriodo(clave, vista.ajustes.periodo).replaceFirstChar { it.uppercase() },
                            Modifier
                                .fillMaxWidth()
                                .clip(Medidas.formaControl)
                                .background(if (actual) c.accent else Color.Transparent)
                                .pulsable { alElegir(clave); abierto = false }
                                .padding(horizontal = 12.dp, vertical = 12.dp),
                            style = LukApp.tipo.de(13, 600), color = if (actual) c.onAccent else c.ink,
                        )
                    }
                }
            }
        }

    }
}

/** --fin-card es translúcido; dentro del gradiente se compone sobre el fondo para no transparentar la lista. */
private fun mezclarOpaco(arriba: Color, abajo: Color): Color {
    val a = arriba.alpha
    return Color(arriba.red * a + abajo.red * (1 - a), arriba.green * a + abajo.green * (1 - a), arriba.blue * a + abajo.blue * (1 - a), 1f)
}
