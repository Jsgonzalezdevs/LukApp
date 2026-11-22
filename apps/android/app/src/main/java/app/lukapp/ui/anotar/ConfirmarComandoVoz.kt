package app.lukapp.ui.anotar

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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.OrdenConfirmada
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.validarComando
import app.lukapp.dominio.voz.ComandoVoz
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * ConfirmarComandoVoz.tsx: «Orden por voz». Muestra lo que se entendió y deja completar lo que falte; nada se aplica
 * hasta confirmar. El origen corto de saldo solo avisa (puede estar desactualizado) y un abono no puede pasar de la deuda.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfirmarComandoVoz(
    comando: ComandoVoz, cajitas: List<Cajita>, saldos: Map<String, Long>,
    alConfirmar: suspend (OrdenConfirmada) -> Boolean, alCancelar: () -> Unit, alRepetir: (() -> Unit)?,
) {
    val c = LukApp.colores
    BackHandler(onBack = alCancelar)
    val ambito = rememberCoroutineScope()
    val activas = remember(cajitas) { cajitas.filter { it.archivedAt == null } }
    val activos = activas.filter { !TipoCajita.esPasivo(it.tipo) }
    val cuentas = activos.filter { it.tipo == TipoCajita.CUENTA }
    val pasivos = activas.filter { TipoCajita.esPasivo(it.tipo) }
    val ahorros = activas.filter { it.tipo == TipoCajita.CAJITA }

    val tipo = when (comando) { is ComandoVoz.Transferencia -> "transferencia"; is ComandoVoz.Abono -> "abono"; is ComandoVoz.Saldo -> "saldo"; is ComandoVoz.Rendimiento -> "rendimiento" }
    val titulo = when (tipo) { "transferencia" -> "Confirmar transferencia"; "abono" -> "Confirmar abono"; "saldo" -> "Confirmar saldo"; else -> "Confirmar rendimiento" }
    val etiquetaBoton = when (tipo) { "transferencia" -> "Transferir"; "abono" -> "Registrar abono"; "saldo" -> "Actualizar saldo"; else -> "Registrar rendimiento" }

    var origenId by remember { mutableStateOf((comando as? ComandoVoz.Transferencia)?.origenId ?: "") }
    var destinoId by remember { mutableStateOf((comando as? ComandoVoz.Transferencia)?.destinoId ?: "") }
    var deudaId by remember { mutableStateOf((comando as? ComandoVoz.Abono)?.deudaId ?: "") }
    var cuentaId by remember { mutableStateOf((comando as? ComandoVoz.Abono)?.cuentaId ?: "") }
    var cajitaId by remember { mutableStateOf((comando as? ComandoVoz.Saldo)?.cajitaId ?: (comando as? ComandoVoz.Rendimiento)?.cajitaId ?: "") }
    val montoInicial = when (comando) { is ComandoVoz.Saldo -> comando.saldoCop; is ComandoVoz.Transferencia -> comando.montoCop; is ComandoVoz.Abono -> comando.montoCop; is ComandoVoz.Rendimiento -> comando.montoCop }
    var montoTexto by remember { mutableStateOf(formatAmountInput(montoInicial)) }
    var fecha by remember { mutableStateOf(when (comando) { is ComandoVoz.Transferencia -> comando.occurredOn; is ComandoVoz.Abono -> comando.occurredOn; is ComandoVoz.Rendimiento -> comando.occurredOn; is ComandoVoz.Saldo -> null } ?: "") }
    var guardando by remember { mutableStateOf(false) }
    var eligiendoFecha by remember { mutableStateOf(false) }
    val hoy = remember { bogotaDate() }

    val v = validarComando(tipo, montoTexto, origenId, destinoId, deudaId, cuentaId, cajitaId, saldos)

    fun opciones(lista: List<Cajita>, excluir: String = "") =
        listOf("Selecciona una opción" to "") + lista.filter { it.id != excluir }.map { "${it.nombre} · ${etiquetaTipoCajita(it)}" to it.id }
    fun etiqueta(lista: List<Cajita>, id: String) = lista.firstOrNull { it.id == id }?.let { "${it.nombre} · ${etiquetaTipoCajita(it)}" } ?: "Selecciona una opción"

    fun confirmar() {
        val monto = v.monto ?: return
        if (!v.camposCompletos || guardando) return
        val f = fecha.ifEmpty { null }
        val orden = when (tipo) {
            "transferencia" -> OrdenConfirmada.Transferencia(origenId, destinoId, monto, f)
            "abono" -> OrdenConfirmada.Abono(deudaId, cuentaId, monto, f)
            "saldo" -> OrdenConfirmada.Saldo(cajitaId, monto)
            else -> OrdenConfirmada.Rendimiento(cajitaId, monto, f)
        }
        guardando = true
        ambito.launch { try { alConfirmar(orden) } finally { guardando = false } }
    }

    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f)).statusBarsPadding().navigationBarsPadding(), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).clip(Medidas.formaHoja).border(2.dp, c.line, Medidas.formaHoja).background(c.bg).verticalScroll(rememberScrollState()).padding(20.dp)
                .semantics { contentDescription = titulo },
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text("ORDEN POR VOZ", style = LukApp.tipo.de(13, 700, 1.3f, 0.025f), color = c.accent)
                    Text(titulo, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(18, 700, 1.3f), color = c.ink)
                }
                Box(Modifier.size(32.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCancelar), contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 16.dp, grosor = 2.5f, color = c.inkSoft)
                }
            }

            Column(Modifier.padding(top = 16.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text("ESTO FUE LO QUE ENTENDÍ", style = LukApp.tipo.de(13, 700, 1.3f, 0.025f), color = c.inkFaint)
                Text("“${comando.raw}”", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 500, 1.6f), color = c.ink)
            }

            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (tipo) {
                    "transferencia" -> {
                        Campo("Cuenta de origen") { Desplegable(etiqueta(activos, origenId), opciones(activos, destinoId), "Cuenta de origen") { origenId = it } }
                        Campo("Cuenta o cajita de destino") { Desplegable(etiqueta(activos, destinoId), opciones(activos, origenId), "Cuenta o cajita de destino") { destinoId = it } }
                    }
                    "abono" -> {
                        Campo("Tarjeta o deuda") { Desplegable(etiqueta(pasivos, deudaId), opciones(pasivos), "Tarjeta o deuda") { deudaId = it } }
                        Campo("Pagar desde") { Desplegable(etiqueta(cuentas, cuentaId), opciones(cuentas), "Pagar desde") { cuentaId = it } }
                    }
                    else -> {
                        val lista = if (tipo == "saldo") activas else ahorros
                        Campo(if (tipo == "saldo") "Cuenta, cajita, tarjeta o deuda" else "Cajita que recibió el rendimiento") {
                            Desplegable(etiqueta(lista, cajitaId), opciones(lista), if (tipo == "saldo") "Saldo de" else "Cajita") { cajitaId = it }
                        }
                    }
                }
                Campo(if (tipo == "saldo") "Nuevo saldo" else "Monto") {
                    CampoTexto(montoTexto, { montoTexto = conPuntos(it) }, "0", if (tipo == "saldo") "Nuevo saldo" else "Monto", numerico = true)
                }
                if (tipo != "saldo") Campo("Fecha") {
                    Column {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                fecha.ifEmpty { "Hoy" }, Modifier.weight(1f).clip(Medidas.formaControl).border(2.dp, c.line, Medidas.formaControl).background(c.card)
                                    .semantics { contentDescription = "Fecha" }.pulsable(escala = 1f, alPulsar = { eligiendoFecha = true }).padding(horizontal = 12.dp, vertical = 12.dp),
                                style = LukApp.tipo.de(17, 400, 1.3f), color = c.ink,
                            )
                            if (fecha.isNotEmpty()) Text("Quitar", Modifier.pulsable(escala = 1f, alPulsar = { fecha = "" }).padding(8.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.accent)
                        }
                        Text("Vacía significa hoy.", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                    }
                }
            }

            if (v.mismaCuenta) Aviso("El origen y el destino deben ser distintos.", c.salioBg, c.salioInk)
            if (v.abonoExcedeDeuda) Aviso("El abono supera la deuda registrada de ${formatCop(v.deudaActualCop)}. Actualiza primero el saldo si esa cifra está desactualizada.", c.salioBg, c.salioInk)
            if (v.saldoInsuficiente) Aviso("La cuenta de origen tiene ${formatCop(v.saldoOrigenCop)}. Puedes continuar si ese saldo aún no está actualizado.", c.warnBg, c.warnInk)
            if (v.monto == null) Text("Escribe un monto válido antes de continuar.", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.salio)

            Text("Nada se aplica hasta que revises estos datos y confirmes.", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
            Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (alRepetir != null) Row(
                    Modifier.clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Repetir" }.pulsable(alPulsar = alRepetir).padding(horizontal = 12.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) { Icono(Lucide.Mic, tamano = 16.dp, color = c.inkSoft); Text("Repetir", style = LukApp.tipo.de(15, 600, 1.3f), color = c.inkSoft) }
                Box(Modifier.weight(1f).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Cancelar" }.pulsable(alPulsar = alCancelar).padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                    Text("Cancelar", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
                }
                val habilitado = v.camposCompletos && !guardando
                Row(
                    Modifier.weight(1f).alpha(if (habilitado) 1f else 0.35f).clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = etiquetaBoton }
                        .pulsable(habilitado = habilitado, alPulsar = ::confirmar).padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                ) { Icono(Lucide.Check, tamano = 16.dp, grosor = 2.5f, color = c.onAccent); Text(if (guardando) "Guardando…" else etiquetaBoton, style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent) }
            }
        }
    }

    if (eligiendoFecha) {
        val estado = rememberDatePickerState(initialSelectedDateMillis = LocalDate.parse(fecha.ifEmpty { hoy }).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { eligiendoFecha = false },
            confirmButton = {
                TextButton(onClick = {
                    eligiendoFecha = false
                    val ms = estado.selectedDateMillis ?: return@TextButton
                    // `max={bogotaDate()}` de la web: una orden no se fecha en el futuro.
                    fecha = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate().toString().let { if (it > hoy) hoy else it }
                }) { Text("Listo") }
            },
            dismissButton = { TextButton(onClick = { eligiendoFecha = false }) { Text("Cancelar") } },
        ) { DatePicker(state = estado) }
    }
}

@Composable
private fun Campo(titulo: String, contenido: @Composable () -> Unit) {
    Column {
        Text(titulo, style = LukApp.tipo.de(13, 600, 1.3f), color = LukApp.colores.inkSoft)
        Box(Modifier.padding(top = 8.dp)) { contenido() }
    }
}

@Composable
private fun Aviso(texto: String, fondo: Color, tinta: Color) {
    Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(fondo).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
        Icono(Lucide.AlertTriangle, tamano = 16.dp, color = tinta)
        Text(texto, style = LukApp.tipo.de(13, 400, 1.4f), color = tinta)
    }
}
