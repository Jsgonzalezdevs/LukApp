package app.lukapp.ui.mes

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.PuntoMensual
import app.lukapp.dominio.RangoTendencia
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.compararCategorias
import app.lukapp.dominio.compararRangos
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.monthKeyLabel
import app.lukapp.dominio.monthKeyShort
import app.lukapp.dominio.promedioMensual
import app.lukapp.dominio.serieMensual
import app.lukapp.dominio.shiftMonth
import app.lukapp.dominio.ultimosMeses
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlin.math.abs
import kotlin.math.max

private const val ANCHO = 340f
private const val ALTO = 150f
private const val PAD_X = 10f
private const val PAD_ARRIBA = 14f
private const val PAD_ABAJO = 22f

/** TendenciasView.tsx: «Cómo vienes», «Promedio mensual» y «Contra el mes pasado». */
@Composable
fun Tendencias(transacciones: List<Transaccion>, mes: String, catalogo: Catalogo) {
    val c = LukApp.colores
    var rango by rememberSaveable { mutableStateOf(RangoTendencia.SEMESTRE) }
    var elegido by rememberSaveable(mes) { mutableStateOf<String?>(null) }
    val serie = remember(transacciones, mes, rango) { serieMensual(transacciones, ultimosMeses(mes, rango.meses)) }
    val comparacion = remember(transacciones, mes, rango) { compararRangos(transacciones, mes, rango.meses) }
    val promedio = promedioMensual(serie)
    val mesAnterior = shiftMonth(mes, -1)
    val cambios = remember(transacciones, mes) { compararCategorias(transacciones, mes, mesAnterior) }
    val activo = elegido?.takeIf { e -> serie.any { it.month == e } } ?: serie.lastOrNull()?.month ?: mes
    val punto = serie.firstOrNull { it.month == activo }

    if (serie.none { it.ingresos > 0 || it.gastos > 0 }) {
        Column(
            Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(horizontal = 24.dp, vertical = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icono(Lucide.TrendingUp, tamano = 40.dp, grosor = 1.5f, color = c.inkGhost)
            Text("Aún no hay suficientes meses para comparar.", Modifier.padding(top = 12.dp), style = LukApp.tipo.cuerpoB, color = c.ink, textAlign = TextAlign.Center)
            Text("Registra movimientos en al menos dos meses distintos.", Modifier.padding(top = 4.dp), style = LukApp.tipo.secundario, color = c.inkFaint, textAlign = TextAlign.Center)
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.TrendingUp, tamano = 16.dp, color = c.inkSoft)
                    Text("Cómo vienes", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                }
                Row(Modifier.clip(CircleShape).background(c.bg).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    RangoTendencia.entries.forEach { r ->
                        val on = r == rango
                        Text(
                            r.corto,
                            Modifier.clip(CircleShape).background(if (on) c.accent else Color.Transparent)
                                .semantics { contentDescription = "Último ${r.largo}" }
                                .pulsable { rango = r }.padding(horizontal = 12.dp, vertical = 4.dp),
                            style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (on) c.onAccent else c.inkSoft,
                        )
                    }
                }
            }
            Box(Modifier.padding(top = 16.dp)) { GraficaLineas(serie, activo) { elegido = it } }
            if (punto != null) {
                Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text(monthKeyLabel(punto.month).replaceFirstChar { it.uppercase() }, style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                    // `flex-wrap gap-x-5 gap-y-1`: si no caben en una fila, la segunda baja en vez de partir la cifra.
                    @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
                    androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LeyendaCifra("Ingresos", formatCop(punto.ingresos), c.entro)
                        LeyendaCifra("Gastos", formatCop(punto.gastos), c.salio)
                    }
                }
            }
            Text(
                "📊 Estas líneas resumen movimientos guardados; los pagos programados y los importes estimados se muestran aparte en Calendario y Proyección.",
                Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint,
            )
            val nombre = rango.largo
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    if (comparacion.hayComparacion) {
                        append("En este $nombre llevas "); negrita(c.ink) { append(formatCop(comparacion.actual.gastos)) }
                        append(" de gasto. Vienes gastando "); negrita(c.ink) { append(formatCop(comparacion.gastoMensualActual)) }
                        append(" al mes, ")
                        if (comparacion.deltaGastos == 0L) append("igual que el $nombre anterior.") else {
                            negrita(if (comparacion.deltaGastos > 0) c.salio else c.entro) {
                                append(formatCop(abs(comparacion.deltaGastos)) + if (comparacion.deltaGastos > 0) " más" else " menos")
                            }
                            append(" que en el $nombre anterior")
                            comparacion.deltaGastosPct?.let { append(" (${if (it > 0) "+" else ""}${pctJs(it)}%)") }
                            append(".")
                        }
                    } else append("Todavía no hay un $nombre anterior con movimientos contra el cual comparar.")
                },
                Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft,
            )
        }

        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.Scale, tamano = 16.dp, color = c.inkSoft)
                Text("Promedio mensual", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            }
            Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(Triple("Ingresos", promedio.ingresos, c.entro), Triple("Gastos", promedio.gastos, c.salio), Triple("Balance", promedio.balance, if (promedio.balance >= 0) c.entro else c.salio)).forEach { (e, v, col) ->
                    Column {
                        Text(e, style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkFaint)
                        Text(formatCop(v), style = LukApp.tipo.de(17, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = col)
                    }
                }
            }
            Text("Solo se cuentan los meses con movimientos registrados. (${promedio.meses})", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
        }

        if (cambios.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Search, tamano = 16.dp, color = c.inkSoft)
                    Text("Contra el mes pasado", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                }
                Text("${monthKeyLabel(mes)} vs ${monthKeyLabel(mesAnterior)}".replaceFirstChar { it.uppercase() }, Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    cambios.forEach { cb ->
                        val e = catalogo.de(cb.category)
                        val color = colorHex(e.color)
                        val subio = cb.deltaCop > 0
                        val nuevo = cb.deltaPct == null && cb.anteriorCop == 0L
                        val desaparecio = cb.actualCop == 0L && cb.anteriorCop > 0
                        Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.bg).padding(horizontal = 12.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icono(Lucide.porNombre[e.icono] ?: Lucide.Package, tamano = 16.dp, color = color)
                            Column(Modifier.weight(1f)) {
                                Text(e.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = color, maxLines = 1)
                                Text("${formatCop(cb.anteriorCop)} → ${formatCop(cb.actualCop)}", style = LukApp.tipo.de(13, 400, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text((if (subio) "+" else "−") + formatCop(abs(cb.deltaCop)), style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (subio) c.salio else c.entro)
                                Text(
                                    if (nuevo) "nuevo este mes" else if (desaparecio) "ya no aparece" else cb.deltaPct?.let { "${if (subio) "subió" else "bajó"} ${pctJs(abs(it))}%" } ?: "",
                                    style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkFaint,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun androidx.compose.ui.text.AnnotatedString.Builder.negrita(color: Color, bloque: androidx.compose.ui.text.AnnotatedString.Builder.() -> Unit) {
    pushStyle(androidx.compose.ui.text.SpanStyle(color = color, fontWeight = FontWeight.SemiBold)); bloque(); pop()
}

/** Un decimal de JS: 200 se escribe "200", 12.5 se escribe "12.5". */
internal fun pctJs(v: Double): String = if (v == Math.floor(v)) v.toLong().toString() else v.toString()

@Composable
private fun LeyendaCifra(etiqueta: String, valor: String, color: Color) {
    val c = LukApp.colores
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(width = 16.dp, height = 8.dp).clip(CircleShape).background(color))
        Text(etiqueta, style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkFaint)
        Text(valor, style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = color, softWrap = false)
    }
}

/** GraficaLineas.tsx: mismo lienzo de 340×150, áreas con degradado, dos líneas, guía del mes elegido. */
@Composable
private fun GraficaLineas(serie: List<PuntoMensual>, seleccionado: String, alSeleccionar: (String) -> Unit) {
    val c = LukApp.colores
    val medidor = rememberTextMeasurer()
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(ANCHO / ALTO)
            .semantics { contentDescription = "Ingresos y gastos de los últimos ${serie.size} meses" }
            .pointerInput(serie) {
                detectTapGestures { toque ->
                    // La zona que se toca es el ancho de una columna entera, no el punto de 3px.
                    val x = toque.x / size.width * ANCHO
                    val paso = if (serie.size > 1) (ANCHO - PAD_X * 2) / (serie.size - 1) else ANCHO
                    val i = if (serie.size > 1) Math.round((x - PAD_X) / paso).toInt().coerceIn(0, serie.size - 1) else 0
                    alSeleccionar(serie[i].month)
                }
            },
    ) {
        val k = size.width / ANCHO
        val techo = max(1L, serie.maxOf { max(it.ingresos, it.gastos) }).toFloat()
        val paso = if (serie.size > 1) (ANCHO - PAD_X * 2) / (serie.size - 1) else 0f
        val base = ALTO - PAD_ABAJO
        fun x(i: Int) = (PAD_X + paso * i) * k
        fun y(v: Long) = (base - v / techo * (ALTO - PAD_ARRIBA - PAD_ABAJO)) * k
        drawLine(c.line, Offset(PAD_X * k, base * k), Offset((ANCHO - PAD_X) * k, base * k), strokeWidth = 1f * k)
        fun trazo(sel: (PuntoMensual) -> Long) = Path().apply { serie.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(sel(p))) else lineTo(x(i), y(sel(p))) } }
        fun area(sel: (PuntoMensual) -> Long, color: Color) {
            if (serie.size < 2) return
            val p = trazo(sel).apply { lineTo(x(serie.lastIndex), base * k); lineTo(x(0), base * k); close() }
            drawPath(p, Brush.verticalGradient(listOf(color.copy(alpha = 0.22f), color.copy(alpha = 0f)), startY = 0f, endY = base * k))
        }
        area({ it.gastos }, c.salio); area({ it.ingresos }, c.entro)
        val linea = Stroke(width = 2.5f * k, cap = StrokeCap.Round, join = StrokeJoin.Round)
        drawPath(trazo { it.gastos }, c.salio, style = linea); drawPath(trazo { it.ingresos }, c.entro, style = linea)
        serie.forEachIndexed { i, p ->
            val on = p.month == seleccionado
            if (on) drawLine(c.inkGhost, Offset(x(i), (PAD_ARRIBA - 6) * k), Offset(x(i), base * k), strokeWidth = 1f * k, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f * k, 3f * k)))
            val r = (if (on) 4.5f else 3f) * k
            for ((v, col) in listOf(p.gastos to c.salio, p.ingresos to c.entro)) {
                drawCircle(col, r, Offset(x(i), y(v))); drawCircle(c.bg, r, Offset(x(i), y(v)), style = Stroke(1.5f * k))
            }
            val texto = medidor.measure(monthKeyShort(p.month), androidx.compose.ui.text.TextStyle(fontFamily = app.lukapp.ui.tema.Poppins, fontSize = (10f * k / density * density).sp.let { (10f * k / density).sp }, fontWeight = FontWeight(if (on) 700 else 500), color = if (on) c.ink else c.inkFaint))
            drawText(texto, topLeft = Offset(x(i) - texto.size.width / 2f, (ALTO - 7) * k - texto.size.height * 0.8f))
        }
    }
}
