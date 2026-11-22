package app.lukapp.ui.pasivos

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.CATEGORIES
import app.lukapp.dominio.CATEGORY_COLOR
import app.lukapp.dominio.CATEGORY_LABELS
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.TipoMovimiento
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.emparejarComprasTarjeta
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.historialDeCajita
import app.lukapp.dominio.monthKey
import app.lukapp.dominio.nombreVisibleCuenta
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.parseSaldoInput
import app.lukapp.dominio.resumenDePasivos
import app.lukapp.dominio.resumenTarjeta
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.IconoCuenta
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlin.math.abs
import kotlin.math.max
import kotlinx.coroutines.launch

/** Lo que cada tarjeta de deuda le pide al modelo; cada una devuelve false si falló. */
class AccionesPasivo(
    val fijarSaldo: suspend (id: String, saldo: Long) -> Boolean,
    val comprar: suspend (id: String, monto: Long, categoria: String, cuotas: Int?, cuota: Long?, interes: Double?, manejo: Long?) -> Boolean,
    val abonar: suspend (deudaId: String, cuentaId: String, monto: Long) -> Boolean,
    val eliminar: suspend (id: String) -> Boolean,
    val crear: suspend (nombre: String, icono: String, tipo: String, saldoInicial: Long) -> Boolean,
    val actualizar: suspend (Cajita) -> Boolean,
)

private enum class Accion(val etiqueta: String) { COMPRA("Registrar compra"), ABONO("Abonar"), SALDO("Actualizar saldo") }

/**
 * HojaPanel + DeudasView.tsx (`soloTipo`). Hecho: el total, y por cada tarjeta o deuda su saldo, «Para pagar
 * este mes», cupo, registrar compra (con cuotas), abonar, actualizar saldo, historial, compras y eliminar.
 * Además: crear tarjeta o deuda (nombre, deuda actual, ícono) y editar nombre, cupo, pago mínimo, corte y pago.
 */
@Composable
fun PantallaPasivos(tipo: String, vista: VistaInicio, acciones: AccionesPasivo, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val libro = vista.libro
    val filas = resumenDePasivos(libro.cajitas, libro.movimientos, libro.transacciones).filter { it.cajita.tipo == tipo }
    val total = filas.sumOf { it.saldoCop }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    val p by animateFloatAsState(if (visible) 1f else 0f, tween(200), label = "entrada")
    val titulo = if (tipo == TipoCajita.TARJETA) "Tarjetas de crédito" else "Tarjetas y deudas"
    Column(
        Modifier.fillMaxSize().graphicsLayer { alpha = p; translationY = (1 - p) * 16.dp.toPx() }.background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding(),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(titulo, Modifier.weight(1f).padding(end = 12.dp), style = LukApp.tipo.tituloXl, color = c.ink, maxLines = 2)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(20.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.CreditCard, tamano = 14.dp, grosor = 2.5f, color = c.inkSoft)
                    Text(if (tipo == TipoCajita.TARJETA) "Deuda de tarjetas" else "Deudas pendientes", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                }
                Text(formatCop(total), Modifier.padding(top = 4.dp), style = LukApp.tipo.cifra.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                if (filas.isNotEmpty()) Text("entre ${filas.size} ${if (filas.size == 1) "obligación" else "obligaciones"}", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            }
            if (filas.isEmpty()) {
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(horizontal = 24.dp, vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icono(Lucide.CreditCard, tamano = 36.dp, grosor = 1.5f, color = c.inkGhost)
                    Text(if (tipo == TipoCajita.TARJETA) "Aún no tienes tarjetas registradas." else "No debes nada registrado.", Modifier.padding(top = 12.dp), style = LukApp.tipo.cuerpoB, color = c.ink, textAlign = TextAlign.Center)
                    Text(
                        if (tipo == TipoCajita.TARJETA) "Agrega una tarjeta y registra compras o pagos en un solo lugar." else "Agrega una tarjeta o un préstamo para llevarle el rastro.",
                        Modifier.padding(top = 4.dp), style = LukApp.tipo.secundario, color = c.inkFaint, textAlign = TextAlign.Center,
                    )
                }
            }
            FormularioNuevaDeuda(tipo, acciones)
            filas.forEach { fila -> TarjetaDeuda(fila.cajita, fila.saldoCop, vista, acciones) }
        }
    }
}

@Composable
private fun TarjetaDeuda(cajita: Cajita, saldo: Long, vista: VistaInicio, acciones: AccionesPasivo) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val alcance = rememberCoroutineScope()
    val libro = vista.libro
    var accion by remember { mutableStateOf<Accion?>(null) }
    var texto by remember { mutableStateOf("") }
    var categoria by remember { mutableStateOf("otros") }
    var cuentaId by remember { mutableStateOf(libro.cajitas.firstOrNull { it.archivedAt == null && it.tipo == "cuenta" }?.id) }
    var cuotas by remember { mutableStateOf("1") }
    var cuotaMensual by remember { mutableStateOf("") }
    var interes by remember { mutableStateOf("") }
    var manejo by remember { mutableStateOf("") }
    var confirmando by remember { mutableStateOf(false) }
    var editando by remember { mutableStateOf(false) }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val emparejadas = remember(libro) { emparejarComprasTarjeta(libro.movimientos, libro.transacciones, setOf(cajita.id)).values.toSet() }
    val historial = remember(libro) { historialDeCajita(libro.movimientos, cajita.id).filter { it.movimiento.id !in emparejadas } }
    val compras = remember(libro) { libro.transacciones.filter { it.cuentaId == cajita.id }.sortedWith(compareByDescending<app.lukapp.dominio.Transaccion> { it.occurredOn }.thenByDescending { it.createdAt }) }
    val hoy = vista.hoy
    val pagoDelMes = if (cajita.tipo == TipoCajita.TARJETA) resumenTarjeta(cajita, saldo, libro.transacciones, libro.movimientos, monthKey(bogotaDate()), bogotaDate()).pagoSiguienteCop else 0L
    val valor = if (accion == Accion.SALDO) parseSaldoInput(texto) else parseAmountInput(texto)
    val cuentas = libro.cajitas.filter { it.archivedAt == null && it.tipo == "cuenta" }

    fun enviar() {
        val v = valor ?: return
        val a = accion ?: return
        ocupado = true; error = null
        alcance.launch {
            val ok = when (a) {
                Accion.SALDO -> acciones.fijarSaldo(cajita.id, v)
                Accion.COMPRA -> {
                    val n = cuotas.toIntOrNull()
                    val financiada = n != null && n >= 2
                    val cuotaCalc = if (financiada) Math.round(abs(v).toDouble() / n!!) else null
                    val cuotaNum = if (financiada) (parseAmountInput(cuotaMensual) ?: cuotaCalc) else null
                    acciones.comprar(cajita.id, abs(v), categoria, if (financiada) n else null, cuotaNum, interes.replace(',', '.').toDoubleOrNull(), parseAmountInput(manejo) ?: 0)
                }
                Accion.ABONO -> cuentaId?.let { acciones.abonar(cajita.id, it, abs(v)) } ?: false
            }
            hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR)
            if (ok) { accion = null; texto = "" } else error = "No se pudo guardar. Revisa la conexión e inténtalo de nuevo."
            ocupado = false
        }
    }

    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.sobreFondo(c.card)).padding(16.dp)) {
        if (error != null) Text(error.orEmpty(), Modifier.padding(bottom = 8.dp), style = LukApp.tipo.de(14, 400), color = c.salio)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(48.dp).clip(Medidas.formaCard).background(c.salioBg), contentAlignment = Alignment.Center) { IconoCuenta(cajita, 24.dp, c.salio, grosor = 1.75f) }
            Column(Modifier.weight(1f)) {
                Text(nombreVisibleCuenta(cajita), style = LukApp.tipo.de(17, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(app.lukapp.dominio.TipoCajita.ETIQUETAS.getValue(cajita.tipo), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkFaint)
                Text(formatCop(saldo), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(28, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                Text(if (cajita.tipo == TipoCajita.TARJETA) "saldo usado" else "debes", style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkFaint)
            }
            Box(Modifier.size(40.dp).clip(Medidas.formaControl).semantics { contentDescription = "Editar ${nombreVisibleCuenta(cajita)}" }.pulsable { editando = !editando }, contentAlignment = Alignment.Center) {
                Icono(Lucide.Pencil, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
            }
            Box(Modifier.size(40.dp).clip(Medidas.formaControl).semantics { contentDescription = "Eliminar ${nombreVisibleCuenta(cajita)}" }.pulsable { confirmando = !confirmando }, contentAlignment = Alignment.Center) {
                Icono(Lucide.Trash2, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
            }
        }
        if (editando) FormularioEditarPasivo(cajita, acciones) { editando = false }
        if (pagoDelMes > 0) {
            Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).padding(12.dp)) {
                Text("Para pagar este mes", style = LukApp.tipo.de(13, 600, 1.3f), color = c.salioInk)
                Text(formatCop(pagoDelMes), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(20, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                Text("Es la suma de tus cuotas vigentes; abónala desde una cuenta cuando la pagues.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.salioInk)
            }
        }
        val limite = cajita.limiteCreditoCop
        if (cajita.tipo == TipoCajita.TARJETA && limite != null) {
            Text(
                "Cupo disponible: ${formatCop(max(0, limite - max(0, saldo)))}" + (cajita.diaCorte?.takeIf { it > 0 }?.let { " · corte día $it" } ?: "") + (cajita.diaPago?.takeIf { it > 0 }?.let { " · pago día $it" } ?: ""),
                Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint,
            )
        }
        if (confirmando) {
            Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).padding(12.dp)) {
                Text("Se elimina y con ella todo su historial de cargos y abonos.", style = LukApp.tipo.de(13, 400, 1.6f), color = c.salioInk)
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Eliminar", Modifier.clip(CircleShape).background(c.salio).pulsable(habilitado = !ocupado) {
                        ocupado = true
                        alcance.launch { val ok = acciones.eliminar(cajita.id); hapticos.disparar(if (ok) Haptico.SUCCESS else Haptico.ERROR); ocupado = false; if (!ok) error = "No se pudo eliminar. Revisa la conexión e inténtalo de nuevo." }
                    }.padding(horizontal = 16.dp, vertical = 8.dp), style = LukApp.tipo.de(15, 600), color = c.onOut)
                    Text("Cancelar", Modifier.clip(CircleShape).background(c.sobreFondo(c.card)).pulsable { confirmando = false }.padding(horizontal = 16.dp, vertical = 8.dp), style = LukApp.tipo.de(15, 600), color = c.inkSoft)
                }
            }
        }

        androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Accion.entries.forEach { a ->
                val on = accion == a
                Text(
                    a.etiqueta,
                    Modifier.clip(CircleShape).background(if (on) c.accent else c.soft).pulsable {
                        accion = if (on) null else a; error = null
                        texto = if (on) "" else if (a == Accion.SALDO) formatAmountInput(saldo) else ""
                    }.padding(horizontal = 12.dp, vertical = 8.dp),
                    style = LukApp.tipo.de(13, 600, 1.3f), color = if (on) c.onAccent else c.inkSoft,
                )
            }
        }

        accion?.let { a ->
            Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(12.dp)) {
                val foco = remember(a) { FocusRequester() }
                LaunchedEffect(a) { foco.requestFocus() }
                Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.sobreFondo(c.card)).padding(horizontal = 12.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("$", style = LukApp.tipo.de(20, 600, 1.2f), color = c.inkFaint)
                    Campo(texto, { texto = conPuntos(it) }, "0", Modifier.weight(1f).focusRequester(foco), grande = true, descripcion = "Monto")
                }
                if (a == Accion.COMPRA) {
                    Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CampoEtiquetado("Cuotas", cuotas, { cuotas = it.filter(Char::isDigit) }, "1", Modifier.weight(1f))
                        CampoEtiquetado("Cuota mensual", cuotaMensual, { cuotaMensual = conPuntos(it) }, "Se calcula", Modifier.weight(1f))
                    }
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CampoEtiquetado("Interés mensual (%)", interes, { interes = it }, "0", Modifier.weight(1f), decimal = true)
                        CampoEtiquetado("Cuota de manejo", manejo, { manejo = conPuntos(it) }, "0", Modifier.weight(1f))
                    }
                    Text("¿En qué fue?", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                    androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CATEGORIES.forEach { op ->
                            val activa = categoria == op
                            val color = colorHex(CATEGORY_COLOR.getValue(op))
                            Row(
                                Modifier.clip(CircleShape).background(if (activa) color.copy(alpha = 0.16f) else c.sobreFondo(c.card)).border(2.dp, if (activa) color else c.line, CircleShape)
                                    .pulsable { categoria = op }.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icono(Lucide.porNombre[app.lukapp.dominio.CATEGORY_ICON.getValue(op)] ?: Lucide.Package, tamano = 12.dp, color = color)
                                Text(CATEGORY_LABELS.getValue(op), style = LukApp.tipo.de(13, 600, 1.3f), color = if (activa) c.ink else c.inkSoft)
                            }
                        }
                    }
                }
                if (a == Accion.ABONO) {
                    Text("¿De dónde sale el pago?", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                    if (cuentas.isEmpty()) {
                        Text("Primero crea una cuenta en Ahorro. El dinero de un abono tiene que salir de algún lado, o los saldos dejan de cuadrar.", Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.sobreFondo(c.card)).padding(12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
                    } else {
                        var abierto by remember { mutableStateOf(false) }
                        Box(Modifier.padding(top = 8.dp)) {
                            Row(Modifier.fillMaxWidth().clip(Medidas.formaControl).border(2.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).pulsable { abierto = true }.padding(horizontal = 12.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(cuentas.firstOrNull { it.id == cuentaId }?.let { "${it.nombre} · ${etiquetaTipoCajita(it)}" } ?: "", Modifier.weight(1f), style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Icono(Lucide.ChevronDown, tamano = 16.dp, color = c.inkFaint)
                            }
                            androidx.compose.material3.DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }, modifier = Modifier.background(c.surface)) {
                                cuentas.forEach { cta -> androidx.compose.material3.DropdownMenuItem(text = { Text("${cta.nombre} · ${etiquetaTipoCajita(cta)}", style = LukApp.tipo.de(15, 400)) }, onClick = { cuentaId = cta.id; abierto = false }) }
                            }
                        }
                    }
                }
                val habilitado = !ocupado && valor != null && !(a == Accion.ABONO && cuentaId == null)
                Text(
                    if (ocupado) "Guardando…" else "Guardar",
                    Modifier.padding(top = 12.dp).fillMaxWidth().graphicsLayer { alpha = if (habilitado) 1f else 0.3f }.clip(CircleShape).background(c.accent).pulsable(habilitado = habilitado) { enviar() }.padding(horizontal = 16.dp, vertical = 12.dp),
                    style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent, textAlign = TextAlign.Center,
                )
            }
        }

        if (historial.isNotEmpty()) {
            Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                historial.take(6).forEach { (m, despues) ->
                    Row(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(m.categoria?.let { CATEGORY_LABELS[it] } ?: TipoMovimiento.ETIQUETAS.getValue(m.kind), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${dayLabel(m.occurredOn, hoy)} · debías ${formatCop(despues)}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                        }
                        Text((if (m.deltaCop >= 0) "+" else "−") + formatCop(abs(m.deltaCop)), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (m.deltaCop >= 0) c.salio else c.entro)
                    }
                }
            }
        } else {
            Text("Sin movimientos manuales todavía.", Modifier.padding(top = 12.dp).padding(horizontal = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
        }

        if (compras.isNotEmpty()) {
            Text("Compras registradas", Modifier.padding(top = 12.dp).padding(horizontal = 4.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                compras.take(6).forEach { tx ->
                    Row(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(tx.description, style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(dayLabel(tx.occurredOn, hoy) + if ((tx.cuotasTotal ?: 0) >= 2 && (tx.cuotaCop ?: 0) > 0) " · ${tx.cuotasTotal} cuotas de ${formatCop(tx.cuotaCop ?: 0)}" else "", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                        }
                        Text("+" + formatCop(tx.amountCop), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.salio)
                    }
                }
            }
        }
    }
}

@Composable
private fun Campo(valor: String, alCambiar: (String) -> Unit, marcador: String, modifier: Modifier, grande: Boolean = false, decimal: Boolean = false, descripcion: String? = null) {
    val c = LukApp.colores
    val estilo = if (grande) LukApp.tipo.de(20, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES) else LukApp.tipo.de(17, 400, 1.3f)
    BasicTextField(
        value = valor, onValueChange = alCambiar, singleLine = true, textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent),
        keyboardOptions = KeyboardOptions(keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number),
        modifier = modifier.let { if (descripcion != null) it.semantics { contentDescription = descripcion } else it },
        decorationBox = { interno -> Box { if (valor.isEmpty()) Text(marcador, style = estilo, color = c.inkGhost); interno() } },
    )
}

@Composable
private fun CampoEtiquetado(etiqueta: String, valor: String, alCambiar: (String) -> Unit, marcador: String, modifier: Modifier, decimal: Boolean = false) {
    val c = LukApp.colores
    Column(modifier) {
        Text(etiqueta, style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
        Campo(valor, alCambiar, marcador, Modifier.padding(top = 4.dp).fillMaxWidth().clip(Medidas.formaControl).border(2.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).padding(horizontal = 12.dp, vertical = 8.dp), decimal = decimal)
    }
}


/** «Nueva tarjeta de crédito» / «Nueva deuda» de DeudasView.tsx: nombre, cuánto debes ahora e ícono. */
@Composable
private fun FormularioNuevaDeuda(tipo: String, acciones: AccionesPasivo) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    val esTarjeta = tipo == TipoCajita.TARJETA
    var abierto by remember { mutableStateOf(false) }
    var nombre by remember { mutableStateOf("") }
    var saldo by remember { mutableStateOf("") }
    var icono by remember { mutableStateOf("Wallet") }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun cerrar() { abierto = false; nombre = ""; saldo = ""; icono = "Wallet"; error = null }
    if (!abierto) {
        Row(
            Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).pulsable { abierto = true }.padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(Lucide.Plus, tamano = 16.dp, grosor = 3f, color = c.inkSoft)
            Text(if (esTarjeta) "Agregar tarjeta de crédito" else "Agregar deuda", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
        }
        return
    }
    val valido = nombre.isNotBlank() && !ocupado
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(if (esTarjeta) "Nueva tarjeta de crédito" else "Nueva deuda", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        CampoEtiquetado("Nombre", nombre, { nombre = it }, if (esTarjeta) "Ej: Visa Davivienda" else "Ej: Préstamo a mi mamá", Modifier.fillMaxWidth())
        CampoEtiquetado("¿Cuánto debes ahora?", saldo, { saldo = conPuntos(it) }, "0", Modifier.fillMaxWidth())
        Text("Ícono", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Wallet", "PiggyBank", "Tent", "Car", "Home", "GraduationCap", "Laptop", "Gift", "LifeBuoy", "Gem", "Plane").forEach { n ->
                Box(
                    Modifier.size(40.dp).clip(Medidas.formaCard).border(2.dp, if (icono == n) c.ink else c.line, Medidas.formaCard).background(if (icono == n) c.soft else c.card)
                        .semantics { contentDescription = "Ícono $n" }.pulsable(escala = 1f, alPulsar = { icono = n }),
                    contentAlignment = Alignment.Center,
                ) { Icono(Lucide.porNombre[n] ?: Lucide.Wallet, tamano = 20.dp, color = if (icono == n) c.ink else c.inkSoft) }
            }
        }
        error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (ocupado) "Creando…" else "Crear",
                Modifier.weight(1f).clip(Medidas.formaPildora).background(c.accent.copy(alpha = if (valido) 1f else 0.3f)).pulsable(habilitado = valido, alPulsar = {
                    ocupado = true; error = null
                    ambito.launch { if (acciones.crear(nombre, icono, tipo, parseAmountInput(saldo) ?: 0L)) cerrar() else error = "No se pudo guardar. Inténtalo de nuevo."; ocupado = false }
                }).padding(vertical = 16.dp),
                style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent, textAlign = TextAlign.Center,
            )
            Text("Cancelar", Modifier.clip(Medidas.formaPildora).background(c.soft).pulsable(habilitado = !ocupado, alPulsar = ::cerrar).padding(horizontal = 24.dp, vertical = 16.dp), style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
        }
    }
}

/** Editar una tarjeta o deuda: nombre y, en tarjetas, cupo, pago mínimo y días de corte y pago (1..31). */
@Composable
private fun FormularioEditarPasivo(cajita: Cajita, acciones: AccionesPasivo, alCerrar: () -> Unit) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    var nombre by remember { mutableStateOf(cajita.nombre) }
    var cupo by remember { mutableStateOf(cajita.limiteCreditoCop?.let { conPuntos(it.toString()) } ?: "") }
    var minimo by remember { mutableStateOf(cajita.pagoMinimoCop?.let { conPuntos(it.toString()) } ?: "") }
    var corte by remember { mutableStateOf(cajita.diaCorte?.toString() ?: "") }
    var pago by remember { mutableStateOf(cajita.diaPago?.toString() ?: "") }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val esTarjeta = cajita.tipo == TipoCajita.TARJETA
    // Un día fuera de 1..31 se guarda como «no configurado», igual que la web.
    fun dia(t: String) = t.toIntOrNull()?.takeIf { it in 1..31 }
    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CampoEtiquetado(if (esTarjeta) "Nombre de la tarjeta" else "Nombre de la deuda", nombre, { nombre = it }, "", Modifier.fillMaxWidth())
        if (esTarjeta) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CampoEtiquetado("Cupo", cupo, { cupo = conPuntos(it) }, "No configurado", Modifier.weight(1f))
                CampoEtiquetado("Pago mínimo", minimo, { minimo = conPuntos(it) }, "No configurado", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CampoEtiquetado("Día de corte", corte, { corte = it.filter(Char::isDigit) }, "No configurado", Modifier.weight(1f))
                CampoEtiquetado("Día de pago", pago, { pago = it.filter(Char::isDigit) }, "No configurado", Modifier.weight(1f))
            }
        }
        error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
        val valido = nombre.isNotBlank() && !ocupado
        Text(
            if (ocupado) "Guardando…" else "Guardar cambios",
            Modifier.padding(top = 4.dp).clip(Medidas.formaPildora).background(c.accent.copy(alpha = if (valido) 1f else 0.4f)).pulsable(habilitado = valido, alPulsar = {
                ocupado = true; error = null
                ambito.launch {
                    val nueva = if (esTarjeta) cajita.copy(nombre = nombre.trim(), limiteCreditoCop = parseAmountInput(cupo), diaCorte = dia(corte), diaPago = dia(pago), pagoMinimoCop = parseAmountInput(minimo))
                    else cajita.copy(nombre = nombre.trim())
                    if (acciones.actualizar(nueva)) alCerrar() else error = "No se pudo guardar. Inténtalo de nuevo."
                    ocupado = false
                }
            }).padding(horizontal = 16.dp, vertical = 12.dp),
            style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent,
        )
    }
}
