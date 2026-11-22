package app.lukapp.ui.inicio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.EntradaMotorFinanciero
import app.lukapp.dominio.ModificadorSimulacion
import app.lukapp.dominio.detectarAnomalias
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.mesCorto
import app.lukapp.dominio.simularDecisiones
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/** `fechaCorta` de ProximosPagosInicio.tsx: «Hoy» o «17 nov». */
private fun fechaCorta(fecha: String, hoy: String): String =
    if (fecha == hoy) "Hoy" else "${fecha.substring(8, 10).toInt()} ${mesCorto(fecha.substring(5, 7).toInt())}"

/**
 * ProximosPagosInicio.tsx: lo que viene en 90 días, sin las confirmadas; hasta tres con fecha, el aviso de las
 * que no la tienen y la nota de que aparecer aquí no registra un gasto ni un pago.
 */
@Composable
fun ProximosPagosInicio(vista: VistaInicio, alVerPagos: () -> Unit) {
    val c = LukApp.colores
    val privacidad = vista.ajustes.privacidad
    val pendientes = remember(vista.contexto) { vista.contexto.obligaciones.filter { it.estado != "confirmada" } }
    val fechados = pendientes.filter { it.fecha != null }.sortedWith(compareBy({ it.fecha }, { it.id }))
    val sinFecha = pendientes.filter { it.fecha == null }
    Column(Modifier.padding(top = 20.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.CalendarDays, tamano = 18.dp, color = c.ink)
                Text("Próximos pagos", style = LukApp.tipo.de(16, 600, 1.4f), color = c.ink)
            }
            Row(Modifier.semantics { contentDescription = "Ver calendario" }.pulsable(escala = 1f, alPulsar = alVerPagos).padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Ver calendario", style = LukApp.tipo.de(14, 600, 1.4f), color = c.inkSoft)
                Icono(Lucide.ChevronRight, tamano = 16.dp, color = c.inkSoft)
            }
        }
        Text("Desde hoy · próximos 90 días", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
        if (fechados.isNotEmpty()) {
            fechados.take(3).forEachIndexed { i, p ->
                if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
                Row(Modifier.fillMaxWidth().pulsable(escala = 1f, alPulsar = alVerPagos).padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(p.concepto, style = LukApp.tipo.de(16, 500, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            "${fechaCorta(p.fecha!!, vista.hoy)} · ${if (p.fecha < vista.hoy) "Vencido · " else ""}" +
                                when (p.certeza) { "estimada" -> "Estimado"; "real" -> "Importe confirmado"; else -> "Programado" },
                            Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkSoft,
                        )
                    }
                    Text(
                        if (privacidad) "$ ••••••" else p.montoCop?.let { formatCop(it) } ?: "Por confirmar",
                        style = LukApp.tipo.de(16, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink,
                    )
                }
            }
        } else {
            Text("No hay pagos con fecha registrada para los próximos 90 días. Agrega los que conozcas desde Mes.", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(14, 400, 1.5f), color = c.inkSoft)
        }
        if (sinFecha.isNotEmpty()) Text(
            "Hay obligaciones sin fecha por confirmar. Revísalas en Mes.",
            Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).pulsable(escala = 1f, alPulsar = alVerPagos).padding(horizontal = 12.dp, vertical = 8.dp),
            style = LukApp.tipo.de(14, 400, 1.4f), color = c.ink,
        )
        if (pendientes.isNotEmpty()) Text("Son compromisos previstos; aparecer aquí no registra un gasto ni un pago.", Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
    }
}

/**
 * DecisionFinanciera.tsx: «Puedes gastar hoy», «¿Qué pasa si compro?» (simula un gasto extraordinario y dice
 * cuánto tardarías en recuperar el disponible) y el aviso del gasto fuera de lo habitual.
 */
@Composable
fun DecisionFinanciera(vista: VistaInicio) {
    val c = LukApp.colores
    val liquidez = vista.contexto.liquidez
    val privacidad = vista.ajustes.privacidad
    var compra by remember { mutableStateOf("") }
    val anomalia = remember(vista.delPeriodo) { detectarAnomalias(vista.delPeriodo).firstOrNull() }
    val simulacion = remember(compra, vista.libro, vista.hoy, vista.ajustes.periodo) {
        if (compra.isEmpty()) null
        else simularDecisiones(EntradaMotorFinanciero(vista.libro, vista.hoy, vista.ajustes.periodo), listOf(ModificadorSimulacion.GastoExtraordinario(compra.toLongOrNull() ?: 0L)))
    }
    fun dinero(v: Long) = if (privacidad) "$ ••••••" else formatCop(v)
    val bien = liquidez.nivel == "bien"
    Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.accent.copy(alpha = 0.25f), Medidas.formaCard).background(c.accent.copy(alpha = 0.08f)).padding(16.dp)) {
            Text("PUEDES GASTAR HOY", style = LukApp.tipo.de(12, 700, 1.4f, 0.08f), color = c.inkSoft)
            Text(dinero(liquidez.disponibleDiarioCop), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(30, 700, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
            Text("Dinero libre: ${dinero(liquidez.dineroLibreCop)} · ${liquidez.diasRestantesPeriodo} días restantes", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkSoft)
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(if (bien) Lucide.ShieldCheck else Lucide.AlertTriangle, tamano = 16.dp, color = if (bien) c.entro else c.salio)
                Text(
                    if (bien) "Vas bien" else if (liquidez.nivel == "incompleto") "Cálculo estimado" else "Conviene revisar el ritmo",
                    style = LukApp.tipo.de(14, 600, 1.4f), color = if (bien) c.entro else c.salio,
                )
            }
        }
        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
            Text("¿QUÉ PASA SI COMPRO?", style = LukApp.tipo.de(12, 700, 1.4f, 0.08f), color = c.inkSoft)
            Row(
                Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.soft).padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("$", style = LukApp.tipo.de(14, 400, 1.4f), color = c.inkSoft)
                val estilo = LukApp.tipo.de(14, 400, 1.4f)
                BasicTextField(
                    value = compra, onValueChange = { compra = it.filter(Char::isDigit).take(15) }, singleLine = true,
                    textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f).semantics { contentDescription = "Monto de la compra" },
                    decorationBox = { interno -> Box { if (compra.isEmpty()) Text("Escribe un monto", style = estilo, color = c.inkFaint); interno() } },
                )
            }
            if (simulacion != null) Text(
                "Disponible diario: ${dinero(simulacion.simulado.liquidez.disponibleDiarioCop)} (${dinero(simulacion.diferencia.disponibleDiario.cambioCop)}). Recuperarías el disponible anterior en aproximadamente ${simulacion.recuperacionDias ?: 0} días.",
                Modifier.padding(top = 12.dp), style = LukApp.tipo.de(14, 400, 1.5f), color = c.inkSoft,
            )
        }
        if (anomalia != null) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.warn.copy(alpha = 0.3f), Medidas.formaCard).background(c.warnBg).padding(16.dp)) {
            Text("Revisa un gasto fuera de lo habitual", style = LukApp.tipo.de(14, 700, 1.4f), color = c.ink)
            Text("Tu gasto más alto en ${vista.catalogo.de(anomalia.categoria).nombre} supera tu promedio en ${Math.round(anomalia.porcentajeSobrePromedio)}%.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(14, 400, 1.4f), color = c.inkSoft)
        }
    }
}

/**
 * El carrusel de categorías de InicioView.tsx: todas las del catálogo (con gasto primero), cada tarjeta más alta
 * cuanto más se gastó (112 a 196), y tocar una filtra la lista de movimientos; tocarla otra vez la quita.
 */
@Composable
fun CarruselCategorias(vista: VistaInicio, filtro: String?, alFiltrar: (String?) -> Unit) {
    val c = LukApp.colores
    val privacidad = vista.ajustes.privacidad
    val categorias = remember(vista.delPeriodo, vista.catalogo) {
        val mapa = LinkedHashMap<String, Long>()
        for (m in vista.delPeriodo) if (m.kind == "gasto") mapa[m.category] = (mapa[m.category] ?: 0L) + m.amountCop
        for (k in vista.catalogo.todas.map { it.clave }) if (k !in mapa) mapa[k] = 0L
        val colador = java.text.Collator.getInstance(java.util.Locale.forLanguageTag("es"))
        mapa.map { (k, t) -> Triple(k, t, vista.catalogo.de(k)) }.sortedWith { a, b -> if (b.second != a.second) b.second.compareTo(a.second) else colador.compare(a.third.nombre, b.third.nombre) }
    }
    val maxTotal = categorias.maxOfOrNull { it.second } ?: 0L
    if (maxTotal <= 0) return
    Row(Modifier.padding(vertical = 16.dp).fillMaxWidth().heightIn(min = 225.dp).horizontalScroll(rememberScrollState()).padding(top = 12.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
        categorias.forEach { (clave, total, info) ->
            val alto = if (total > 0) Math.round(112 + (total.toDouble() / maxTotal) * (196 - 112)).toInt() else 112
            val seleccionada = filtro == clave
            Column(
                Modifier.width(108.dp).height(alto.dp).clip(Medidas.formaCard).border(if (seleccionada) 2.dp else 1.dp, if (seleccionada) c.ink else c.line, Medidas.formaCard).background(c.card)
                    .semantics { contentDescription = "Ver movimientos de ${info.nombre}" }.pulsable(escala = 0.96f, alPulsar = { alFiltrar(if (seleccionada) null else clave) }).padding(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Box(Modifier.size(32.dp).clip(Medidas.formaCard).background(c.soft), contentAlignment = Alignment.Center) { Emoji(info.emoji, 17) }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (privacidad) "••••" else formatMontoCompacto(total), style = LukApp.tipo.de(13, 700, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink, textAlign = TextAlign.Center)
                    Text(info.nombre.replaceFirstChar { it.uppercase() }, Modifier.padding(top = 4.dp).widthIn68(), style = LukApp.tipo.de(13, 600, 1.2f), color = c.inkSoft, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

private fun Modifier.widthIn68() = this.then(Modifier.width(68.dp))
