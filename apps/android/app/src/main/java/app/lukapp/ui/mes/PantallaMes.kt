package app.lukapp.ui.mes

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.CategorySlice
import app.lukapp.dominio.FrecuenciaPeriodo
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.byCategory
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.diaDesbloqueoResumen
import app.lukapp.dominio.esResumenMesHabilitado
import app.lukapp.dominio.monthKeyLabel
import app.lukapp.dominio.etiquetaDePeriodo
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.mayoresMovimientos
import app.lukapp.dominio.monthKey
import app.lukapp.dominio.periodoAdyacente
import app.lukapp.dominio.porDiaDelMes
import app.lukapp.dominio.resumenDetalleMes
import app.lukapp.dominio.topContrapartes
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.dominio.generarExcelFinanciero
import app.lukapp.dominio.nombreArchivoExcel
import kotlinx.coroutines.launch
import kotlin.math.ceil
import kotlin.math.max

/**
 * MesView.tsx.
 */
@Composable
fun PantallaMes(
    vista: VistaInicio, alElegirPeriodo: (String) -> Unit, alAbrirCalendario: () -> Unit, topes: AccionesTopes,
    alAbrirPagosFijos: () -> Unit, alAbrirProyeccion: () -> Unit, alAbrirResumen: (String) -> Unit,
) {
    val c = LukApp.colores
    val config = vista.ajustes.periodo
    val clave = vista.clavePeriodo
    val sinNavegacion = config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO
    val anterior = periodoAdyacente(clave, -1, config)
    val siguiente = periodoAdyacente(clave, 1, config)
    val haySiguiente = !sinNavegacion && siguiente <= vista.maxClavePeriodo
    // `mesCalendarioActivo` de LukAppApp.tsx: con mensual el mes del período; con otra frecuencia, el mes de hoy.
    val mesCalendario = if (config.frecuencia == FrecuenciaPeriodo.MENSUAL) monthKey(if (clave.length > 7) clave else "$clave-01") else vista.hoy.take(7)
    val totales = vista.totales
    val positivo = totales.balance >= 0
    val ancho = LocalConfiguration.current.screenWidthDp

    Column(Modifier.fillMaxWidth().padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            BotonFlecha(Lucide.ChevronLeft, "Período anterior", !sinNavegacion) { alElegirPeriodo(anterior) }
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    etiquetaDePeriodo(clave, config).replaceFirstChar { it.uppercase() },
                    Modifier.weight(1f, fill = false),
                    style = LukApp.tipo.titulo, color = c.ink, textAlign = TextAlign.Center,
                )
                Box(Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Abrir calendario financiero" }.pulsable(alPulsar = alAbrirCalendario), contentAlignment = Alignment.Center) {
                    Icono(Lucide.CalendarDays, tamano = 16.dp, grosor = 2.2f, color = c.inkSoft)
                }
            }
            BotonFlecha(Lucide.ChevronRight, "Período siguiente", haySiguiente) { alElegirPeriodo(siguiente) }
        }

        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AccesoFuncion("Pagos fijos", "Lo que te cobran todos los meses", alAbrirPagosFijos)
            AccesoFuncion("Proyección financiera", "Mira cómo podría verse tu liquidez", alAbrirProyeccion)
        }

        val habilitado = esResumenMesHabilitado(mesCalendario, vista.hoy)
        if (habilitado) {
            Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.accent).pulsable(alPulsar = { alAbrirResumen(mesCalendario) }).padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Sparkles, tamano = 20.dp, grosor = 2f, color = c.onAccent)
                Column(Modifier.weight(1f)) {
                    Text("Tu resumen de ${monthKeyLabel(mesCalendario)}", style = LukApp.tipo.de(15, 600, 1.4f), color = c.onAccent)
                    Text("Lo mejor y lo raro del mes, en una historia", Modifier.padding(top = 4.dp).graphicsLayer { alpha = 0.7f }, style = LukApp.tipo.xs, color = c.onAccent)
                }
                Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.onAccent.copy(alpha = 0.6f))
            }
        } else {
            val dia = diaDesbloqueoResumen(mesCalendario)
            Row(
                Modifier.fillMaxWidth().graphicsLayer { alpha = 0.8f }.clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Sparkles, tamano = 20.dp, grosor = 2f, color = c.inkGhost.copy(alpha = 0.3f))
                Column(Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Tu resumen de ${monthKeyLabel(mesCalendario)}", Modifier.weight(1f, fill = false), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                        Text(
                            "PRÓXIMAMENTE", Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).background(c.card).padding(horizontal = 8.dp, vertical = 4.dp),
                            style = LukApp.tipo.de(13, 600, 1.2f, 0.025f), color = c.inkFaint,
                        )
                    }
                    Text(
                        "Se habilita el $dia de ${monthKeyLabel(mesCalendario).split(" ")[0]} (2 días antes de fin de mes)",
                        Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint,
                    )
                }
                Icono(Lucide.Lock, tamano = 16.dp, grosor = 2f, color = c.inkGhost.copy(alpha = 0.4f))
            }
        }

        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Balance del período", style = LukApp.tipo.xs, color = c.inkFaint)
            // fontSize: clamp(1.5rem, 8vw, 3.5rem).
            val tamano = (ancho * 0.08f).coerceIn(24f, 56f)
            Text(
                formatCop(totales.balance),
                Modifier.padding(top = 4.dp),
                style = LukApp.tipo.cifra.copy(fontSize = tamano.sp, lineHeight = tamano.sp, fontFeatureSettings = CIFRAS_TABULARES),
                color = if (positivo) c.entro else c.salio, textAlign = TextAlign.Center,
            )
            Text(
                "Entró ${formatCop(totales.ingresos)} · Salió ${formatCop(totales.gastos)}",
                Modifier.padding(top = 8.dp),
                style = LukApp.tipo.de(15, 400, 1.5f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft, textAlign = TextAlign.Center,
            )
        }

        Topes(vista, topes)

        val gastos = remember(vista.delPeriodo) { byCategory(vista.delPeriodo, "gasto") }
        val ingresos = remember(vista.delPeriodo) { byCategory(vista.delPeriodo, "ingreso") }
        Reparto("En qué se te va", gastos, vista.catalogo)
        Reparto("De dónde entra", ingresos, vista.catalogo)

        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            PorDia(vista.libro.transacciones, mesCalendario, vista.catalogo, vista.hoy)
            Mayores(vista.delPeriodo, vista.catalogo, vista.hoy)
            Contrapartes(vista.delPeriodo, "gasto")
            Contrapartes(vista.delPeriodo, "ingreso")
            Entradas(vista.delPeriodo, vista.hoy)
        }

        Tendencias(vista.libro.transacciones, mesCalendario, vista.catalogo)

        if (vista.delPeriodo.isNotEmpty()) BotonExportarExcel(vista, clave, etiquetaDePeriodo(clave, config))
    }
}

/**
 * «Exportar {período} a Excel (.xls)» de MesView.tsx. Va con lo que se ve (`delPeriodo`, ya recortado al período activo,
 * sea o no un mes calendario); como en la web, la hoja de cuentas queda vacía: aquí se exportan movimientos.
 */
@Composable
private fun BotonExportarExcel(vista: VistaInicio, clave: String, etiqueta: String) {
    val c = LukApp.colores
    val contexto = androidx.compose.ui.platform.LocalContext.current
    val ambito = androidx.compose.runtime.rememberCoroutineScope()
    var aviso by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
    val guardar = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.CreateDocument("application/vnd.ms-excel")) { uri ->
        if (uri != null) ambito.launch {
            val xml = generarExcelFinanciero(vista.delPeriodo, emptyList(), emptyMap(), null)
            aviso = if (app.lukapp.ui.mas.guardarBytes(contexto, uri, xml.toByteArray(Charsets.UTF_8))) "Archivo guardado." else "No se pudo guardar el archivo."
        }
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).background(c.card).semantics { contentDescription = "Exportar a Excel" }
                .pulsable(alPulsar = { guardar.launch(nombreArchivoExcel(null, clave)) }).padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(Lucide.Download, tamano = 16.dp, grosor = 2.25f, color = c.inkSoft)
            Text("Exportar $etiqueta a Excel (.xls)", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
        }
        aviso?.let { Text(it, style = LukApp.tipo.xs, color = if (it.startsWith("Archivo")) c.entro else c.salio) }
    }
}

@Composable
private fun BotonFlecha(icono: IconoLucide, descripcion: String, habilitado: Boolean, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Box(
        Modifier.size(36.dp).graphicsLayer { alpha = if (habilitado) 1f else 0.3f }.clip(CircleShape).background(c.soft)
            .semantics { contentDescription = descripcion }.pulsable(habilitado = habilitado, alPulsar = alPulsar),
        contentAlignment = Alignment.Center,
    ) { Icono(icono, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft) }
}

/** `${pct}%` de JS: 23 se escribe "23", 22.6 se escribe "22.6". */
private fun porcentajeJs(pct: Double): String = if (pct == Math.floor(pct)) pct.toLong().toString() else pct.toString()

/** CategoryBreakdown.tsx: barras horizontales de la mayor a la menor, con el porcentaje escrito. */
@Composable
private fun Reparto(titulo: String, porciones: List<CategorySlice>, catalogo: Catalogo) {
    val c = LukApp.colores
    if (porciones.isEmpty()) return
    val mayor = porciones[0].total
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp).semantics { contentDescription = titulo }) {
        Text(titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            porciones.forEachIndexed { i, p ->
                val entrada = catalogo.de(p.category)
                val color = colorHex(entrada.color)
                val objetivo = max(p.total.toDouble() / mayor * 100, 4.0).toFloat() / 100f
                // Entra de 0 a su ancho en 0.5s easeOut, una barra tras otra cada 50 ms.
                val anchoBarra = remember(p.category) { Animatable(0f) }
                LaunchedEffect(objetivo) { anchoBarra.animateTo(objetivo, tween(500, delayMillis = i * 50, easing = FastOutSlowInEasing)) }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(32.dp).clip(Medidas.formaControl).background(color.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                        Icono(Lucide.porNombre[entrada.icono] ?: Lucide.Package, tamano = 20.dp, color = color)
                    }
                    Column(Modifier.weight(1f)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(entrada.nombre, Modifier.weight(1f), style = LukApp.tipo.de(13, 600), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(formatCop(p.total), style = LukApp.tipo.de(13, 600).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                        }
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.weight(1f).height(8.dp).clip(CircleShape).background(c.soft)) {
                                Box(Modifier.fillMaxWidth(anchoBarra.value).fillMaxHeight().clip(CircleShape).background(color))
                            }
                            Text(
                                "${porcentajeJs(p.pct)}%", Modifier.width(40.dp),
                                style = LukApp.tipo.de(13, 600).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint, textAlign = TextAlign.End,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Tarjeta(icono: IconoLucide, titulo: String, contenido: @Composable () -> Unit) {
    val c = LukApp.colores
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(icono, tamano = 14.dp, grosor = 2.5f, color = c.inkSoft)
            Text(titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        }
        contenido()
    }
}

/** `contarDelDia` de DetalleMes.tsx. */
private fun contarDelDia(txs: List<Transaccion>, fecha: String, catalogo: Catalogo): String {
    val delDia = txs.filter { it.occurredOn == fecha }
    if (delDia.isEmpty()) return "sin movimientos"
    val categorias = delDia.filter { it.kind == "gasto" }.map { it.category }.distinct().take(3).map { catalogo.de(it).nombre }
    val cuantos = "${delDia.size} movimiento${if (delDia.size == 1) "" else "s"}"
    return if (categorias.isNotEmpty()) "$cuantos · ${categorias.joinToString(", ")}" else cuantos
}

/** "En qué días se fue": una columna por día, también los vacíos; tocar una muestra ese día arriba. */
@Composable
private fun PorDia(txs: List<Transaccion>, mes: String, catalogo: Catalogo, hoy: String) {
    val c = LukApp.colores
    val dias = remember(txs, mes) { porDiaDelMes(txs, mes) }
    val resumen = remember(txs, mes) { resumenDetalleMes(txs, mes) }
    var activo by rememberSaveable(mes) { mutableStateOf<Int?>(null) }
    if (resumen.diasConGasto == 0) return
    val dia = activo?.let { dias[it] }
    val techo = max(dias.maxOf { it.gastoCop }, 1L)

    Tarjeta(Lucide.CalendarDays, "En qué días se fue") {
        Row(
            Modifier.padding(top = 12.dp).fillMaxWidth().height(44.dp).clip(Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
        ) {
            if (dia != null) {
                Column(Modifier.weight(1f)) {
                    Text(dayLabel(dia.fecha, hoy).replaceFirstChar { it.uppercase() }, style = LukApp.tipo.de(13, 600, 1.3f), color = c.ink)
                    Text(contarDelDia(txs, dia.fecha, catalogo), style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkFaint, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(formatCop(dia.gastoCop), style = LukApp.tipo.de(17, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                    if (dia.ingresoCop > 0) Text("+${formatCop(dia.ingresoCop)}", style = LukApp.tipo.de(13, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.entro)
                }
            } else {
                // La web dice "Pasa el cursor o toca": en el teléfono no hay cursor, igual que en la WebView actual.
                Text("Pasa el cursor o toca una barra para ver ese día.", style = LukApp.tipo.xs, color = c.inkFaint)
            }
        }
        Row(Modifier.padding(top = 8.dp).fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
            dias.forEachIndexed { i, d ->
                val alto = max(if (d.gastoCop > 0) 4.0 else 1.0, d.gastoCop.toDouble() / techo * 100) / 100
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight(alto.toFloat())
                        .graphicsLayer { alpha = if (activo == i) 1f else if (d.gastoCop > 0) 0.85f else 0.18f }
                        .clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp))
                        .background(c.salio)
                        .semantics { contentDescription = "${dayLabel(d.fecha, hoy)}: ${formatCop(d.gastoCop)}" }
                        .pulsable(escala = 1f) { activo = if (activo == i) null else i },
                )
            }
        }
        Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf("1", ceil(dias.size / 2.0).toInt().toString(), dias.size.toString()).forEach {
                Text(it, style = LukApp.tipo.xs.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint)
            }
        }
        Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(1.dp).background(c.soft))
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Dato("Días con gasto", resumen.diasConGasto.toString())
            Dato("Promedio por día", formatCop(resumen.promedioPorDiaActivoCop))
            Dato("Día más caro", resumen.diaMasCaro?.let { formatCop(it.gastoCop) } ?: "—")
        }
        Text(
            "El promedio cuenta solo los días en que gastaste, no los ${dias.size} del mes.",
            Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint,
        )
    }
}

@Composable
private fun Dato(etiqueta: String, valor: String) {
    val c = LukApp.colores
    Column {
        Text(etiqueta, style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkFaint)
        Text(valor, style = LukApp.tipo.de(17, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
    }
}

@Composable
private fun FilaMovimientoMes(titulo: String, detalle: String, monto: String, colorMonto: androidx.compose.ui.graphics.Color, icono: (@Composable () -> Unit)? = null) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.bg).padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        icono?.invoke()
        Column(Modifier.weight(1f)) {
            Text(titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(detalle, style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
        }
        Text(monto, style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = colorMonto)
    }
}

@Composable
private fun Mayores(delMes: List<Transaccion>, catalogo: Catalogo, hoy: String) {
    val gastos = remember(delMes) { mayoresMovimientos(delMes, "gasto") }
    if (gastos.isEmpty()) return
    Tarjeta(Lucide.ArrowDownRight, "Tus gastos más grandes") {
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            gastos.forEach { tx ->
                val entrada = catalogo.de(tx.category)
                FilaMovimientoMes(tx.description, "${dayLabel(tx.occurredOn, hoy)} · ${entrada.nombre}", formatCop(tx.amountCop), LukApp.colores.salio) {
                    Icono(Lucide.porNombre[entrada.icono] ?: Lucide.Package, tamano = 16.dp, color = colorHex(entrada.color))
                }
            }
        }
    }
}

@Composable
private fun Contrapartes(delMes: List<Transaccion>, kind: String) {
    val c = LukApp.colores
    val filas = remember(delMes, kind) { topContrapartes(delMes, kind) }
    if (filas.isEmpty()) return
    val gasto = kind == "gasto"
    val color = if (gasto) c.salio else c.entro
    val mayor = filas[0].totalCop
    Tarjeta(Lucide.Users, if (gasto) "A quién le mandaste" else "Quién te mandó") {
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            filas.forEach { f ->
                Column {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(f.nombre, Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(formatCop(f.totalCop), style = LukApp.tipo.de(15, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = color)
                    }
                    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f).height(6.dp).clip(CircleShape).background(c.soft)) {
                            Box(Modifier.fillMaxWidth((f.totalCop.toFloat() / mayor).coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(color))
                        }
                        Text("${f.veces}×", style = LukApp.tipo.xs.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint)
                    }
                }
            }
        }
    }
}

@Composable
private fun Entradas(delMes: List<Transaccion>, hoy: String) {
    val ingresos = remember(delMes) { mayoresMovimientos(delMes, "ingreso", 3) }
    if (ingresos.isEmpty()) return
    Tarjeta(Lucide.ArrowUpRight, "Tus mayores entradas") {
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ingresos.forEach { tx -> FilaMovimientoMes(tx.description, dayLabel(tx.occurredOn, hoy), formatCop(tx.amountCop), LukApp.colores.entro) }
        }
    }
}

/** AccesosFunciones.tsx: tarjeta con borde, título, ayuda y flecha. */
@Composable
internal fun AccesoFuncion(titulo: String, ayuda: String, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).pulsable(alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(titulo, style = LukApp.tipo.de(16, 600, 1.4f), color = c.ink)
            Text(ayuda, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkSoft)
        }
        Icono(Lucide.ChevronRight, tamano = 18.dp, color = c.ink)
    }
}
