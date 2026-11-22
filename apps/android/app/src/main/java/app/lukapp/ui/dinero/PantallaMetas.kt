package app.lukapp.ui.dinero

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Meta
import app.lukapp.dominio.MetaInteligente
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.fechaLarga
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.parseAmountInput
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.iconoDeCajita
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.mes.pctJs
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** `CAJITA_ICONS` de data/modelos.ts: los íconos que ofrece la web para una meta. */
private val ICONOS_META = listOf("Wallet", "PiggyBank", "Tent", "Car", "Home", "GraduationCap", "Laptop", "Gift", "LifeBuoy", "Gem", "Plane")

/** Lo que Metas escribe en el libro; cada una devuelve si se guardó. */
class AccionesMetas(
    val crear: suspend (nombre: String, icon: String, objetivo: Long, fecha: String?, cajitaId: String?) -> Boolean,
    val actualizar: suspend (Meta) -> Boolean,
    val eliminar: suspend (String) -> Boolean,
)

/**
 * MetasView.tsx. Una meta puede seguir el saldo de una cajita (el avance sale de ahí y no se desvía) o llevarse a mano
 * con «Ahorrado». Cada tarjeta dice cuánto falta, el estado según tu dinero libre y, con fecha, cuánto apartar por
 * quincena y por mes. Nada se calcula aquí: sale de `metasInteligentes` del motor, igual que la web.
 */
@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun PantallaMetas(vista: VistaInicio, acciones: AccionesMetas, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ambito = rememberCoroutineScope()
    val hoy = remember { bogotaDate() }
    val filas = vista.contexto.metasInteligentes
    val vivas = remember(vista.libro.cajitas) { vista.libro.cajitas.filter { it.archivedAt == null } }
    var creando by rememberSaveable { mutableStateOf(false) }
    var nombre by rememberSaveable { mutableStateOf("") }
    var icono by rememberSaveable { mutableStateOf(ICONOS_META[0]) }
    var objetivoTexto by rememberSaveable { mutableStateOf("") }
    var fecha by rememberSaveable { mutableStateOf("") }
    var cajitaId by rememberSaveable { mutableStateOf("") }
    var eligiendoFecha by remember { mutableStateOf(false) }
    var editandoAhorro by rememberSaveable { mutableStateOf<String?>(null) }
    var ahorroTexto by rememberSaveable { mutableStateOf("") }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun guardado(bloque: suspend () -> Boolean, alExito: () -> Unit = {}) {
        guardando = true
        ambito.launch { val ok = bloque(); guardando = false; if (ok) { error = null; alExito() } else error = "No se pudo guardar. Inténtalo de nuevo." }
    }
    val objetivo = parseAmountInput(objetivoTexto)

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Metas de ahorro", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }

            if (creando) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
                Text("Nueva meta", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                Etiqueta("Nombre", 16)
                CampoTexto(nombre, { nombre = it }, "Ej: Viaje a Cartagena", "Nombre de la meta")
                Etiqueta("Ícono", 16)
                FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ICONOS_META.forEach { n ->
                        val sel = icono == n
                        Box(
                            Modifier.size(40.dp).clip(Medidas.formaCard).border(2.dp, if (sel) c.ink else c.line, Medidas.formaCard).background(if (sel) c.soft else c.card)
                                .semantics { contentDescription = "Ícono $n" }.pulsable(escala = 1f, alPulsar = { icono = n }),
                            contentAlignment = Alignment.Center,
                        ) { Icono(iconoDeCajita(n), tamano = 20.dp, color = c.inkSoft) }
                    }
                }
                Etiqueta("Objetivo", 16)
                Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("$", style = LukApp.tipo.de(20, 600, 1.2f), color = c.inkFaint)
                    Box(Modifier.weight(1f)) { CampoTexto(objetivoTexto, { objetivoTexto = formatAmountInput(parseAmountInput(it)) }, "0", "Objetivo de la meta", numerico = true) }
                }
                Etiqueta("Fecha límite (opcional)", 16)
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (fecha.isEmpty()) "Sin fecha" else fechaLarga(fecha), Modifier.weight(1f).clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.card)
                            .semantics { contentDescription = "Fecha límite" }.pulsable(escala = 1f, alPulsar = { eligiendoFecha = true }).padding(horizontal = 16.dp, vertical = 12.dp),
                        style = LukApp.tipo.de(17, 400, 1.3f), color = if (fecha.isEmpty()) c.inkFaint else c.ink,
                    )
                    if (fecha.isNotEmpty()) Text("Quitar", Modifier.pulsable(escala = 1f, alPulsar = { fecha = "" }).padding(8.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.accent)
                }
                Etiqueta("Seguir el saldo de una cajita", 16)
                Box(Modifier.padding(top = 8.dp)) {
                    Desplegable(vivas.firstOrNull { it.id == cajitaId }?.nombre ?: "Llevarla a mano", listOf("Llevarla a mano" to "") + vivas.map { it.nombre to it.id }, "Cajita que sigue la meta") { cajitaId = it }
                }
                Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val listo = nombre.trim().isNotEmpty() && objetivo != null && !guardando
                    Box(
                        Modifier.weight(1f).alpha(if (listo) 1f else 0.3f).clip(Medidas.formaPildora).background(c.accent).semantics { contentDescription = "Crear meta" }
                            .pulsable(habilitado = listo, alPulsar = {
                                guardado({ acciones.crear(nombre.trim(), icono, objetivo!!, fecha.ifEmpty { null }, cajitaId.ifEmpty { null }) }) { nombre = ""; objetivoTexto = ""; fecha = ""; cajitaId = ""; creando = false }
                            }).padding(horizontal = 24.dp, vertical = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text("Crear meta", style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent) }
                    Box(Modifier.clip(Medidas.formaPildora).background(c.soft).semantics { contentDescription = "Cancelar" }.pulsable(alPulsar = { creando = false }).padding(horizontal = 24.dp, vertical = 16.dp), contentAlignment = Alignment.Center) {
                        Text("Cancelar", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
                    }
                }
            } else Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).semantics { contentDescription = "Nueva meta" }.pulsable(alPulsar = { creando = true }).padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) { Icono(Lucide.Plus, tamano = 16.dp, grosor = 3f, color = c.inkSoft); Text("Nueva meta", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft) }

            if (filas.isEmpty() && !creando) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(horizontal = 24.dp, vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icono(Lucide.Target, tamano = 40.dp, grosor = 1.5f, color = c.inkGhost)
                Text("Aún no tienes metas.", Modifier.padding(top = 12.dp), style = LukApp.tipo.cuerpoB, color = c.ink)
                Text("Ponte un objetivo y la app te dice si el ritmo te alcanza.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkFaint, textAlign = TextAlign.Center)
            }

            filas.forEach { fila -> TarjetaMeta(fila, vista, ambito = { b, ok -> guardado(b, ok) }, editando = editandoAhorro == fila.meta.id, texto = ahorroTexto,
                alTexto = { ahorroTexto = formatAmountInput(parseAmountInput(it)) },
                alEditar = { editandoAhorro = fila.meta.id; ahorroTexto = formatAmountInput(fila.meta.ahorradoCop) },
                alGuardarAhorro = { v -> guardado({ acciones.actualizar(fila.meta.copy(ahorradoCop = v)) }) { editandoAhorro = null; ahorroTexto = "" } },
                alEliminar = { guardado({ acciones.eliminar(fila.meta.id) }) },
            ) }
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
                    // `min={hoy}` de la web: una fecha límite no puede estar en el pasado.
                    fecha = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate().toString().let { if (it < hoy) hoy else it }
                }) { Text("Listo") }
            },
            dismissButton = { TextButton(onClick = { eligiendoFecha = false }) { Text("Cancelar") } },
        ) { DatePicker(state = estado) }
    }
}

@Composable
private fun Etiqueta(texto: String, arriba: Int) = Text(texto, Modifier.padding(top = arriba.dp, bottom = 0.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = LukApp.colores.inkSoft)

@Composable
private fun TarjetaMeta(
    fila: MetaInteligente, vista: VistaInicio, ambito: (suspend () -> Boolean, () -> Unit) -> Unit, editando: Boolean, texto: String, alTexto: (String) -> Unit,
    alEditar: () -> Unit, alGuardarAhorro: (Long) -> Unit, alEliminar: () -> Unit,
) {
    val c = LukApp.colores
    val meta = fila.meta
    val p = fila.progreso
    val cajita = meta.cajitaId?.let { id -> vista.libro.cajitas.firstOrNull { it.id == id } }
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(40.dp).clip(Medidas.formaCard).background(c.soft), contentAlignment = Alignment.Center) { Icono(iconoDeCajita(meta.icon), tamano = 20.dp, color = c.inkSoft) }
            Column(Modifier.weight(1f)) {
                Text(meta.nombre, style = LukApp.tipo.cuerpoB, color = c.ink, maxLines = 1)
                Text(if (cajita != null) "Sigue la cajita ${cajita.nombre}" else "Llevarla a mano", style = LukApp.tipo.xs, color = c.inkFaint)
            }
            Box(Modifier.size(36.dp).semantics { contentDescription = "Eliminar meta: ${meta.nombre}" }.pulsable(alPulsar = alEliminar), contentAlignment = Alignment.Center) {
                Icono(Lucide.Trash2, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
            }
        }
        Box(Modifier.padding(top = 12.dp).fillMaxWidth().height(10.dp).clip(CircleShape).background(c.soft)) {
            Box(Modifier.fillMaxWidth((p.pct / 100.0).toFloat().coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(if (p.completada) c.entro else c.ink))
        }
        Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Row {
                Text(formatCop(p.ahorradoCop), style = LukApp.tipo.de(13, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                Text(" / ${formatCop(p.objetivoCop)}", style = LukApp.tipo.de(13, 400, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint)
            }
            Text("${pctJs(p.pct)}%", style = LukApp.tipo.de(13, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft)
        }
        Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 12.dp)) {
            if (p.completada) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.CheckCircle2, tamano = 16.dp, color = c.entro)
                    Text("¡Meta lograda!", style = LukApp.tipo.de(15, 600, 1.4f), color = c.entro)
                }
            } else {
                Text("Te falta ${formatCop(p.faltaCop)}", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                Text(
                    "Estado: ${when (fila.viabilidad) { "en_riesgo" -> "requiere atención"; "sin_datos" -> "sin datos suficientes"; else -> "en camino" }} · Fecha estimada: no estimable",
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint,
                )
                val mensual = p.ritmoMensualCop
                if (mensual != null) Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).border(1.dp, c.line.copy(alpha = 0.5f), Medidas.formaControl).background(c.card.copy(alpha = 0.8f)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("💡 Aparta por quincena:", style = LukApp.tipo.de(13, 500, 1.3f), color = c.inkSoft)
                        Text(formatCop(p.ritmoQuincenalCop ?: Math.ceil(mensual / 2.0).toLong()), style = LukApp.tipo.de(13, 700, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.warnInk)
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(c.line.copy(alpha = 0.3f)))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${formatCop(mensual)} / mes", style = LukApp.tipo.xs, color = c.inkFaint)
                        Text("${p.diasRestantes} días restantes", style = LukApp.tipo.xs, color = c.inkFaint)
                    }
                } else if (p.diasRestantes != null && p.diasRestantes <= 0) Text("La fecha ya pasó", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.warn)
            }
        }
        // Una meta sin cajita se lleva a mano.
        if (meta.cajitaId == null) {
            if (editando) Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("$", style = LukApp.tipo.de(20, 600, 1.2f), color = c.inkFaint)
                    Box(Modifier.weight(1f)) { CampoTexto(texto, alTexto, "0", "Ahorrado", numerico = true) }
                }
                Box(
                    Modifier.clip(Medidas.formaPildora).background(c.accent).semantics { contentDescription = "Guardar" }
                        .pulsable(alPulsar = { parseAmountInput(texto)?.let(alGuardarAhorro) }).padding(horizontal = 16.dp, vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("Guardar", style = LukApp.tipo.de(15, 600, 1.3f), color = c.onAccent) }
            } else Text(
                "Ahorrado: ${formatCop(p.ahorradoCop)}", Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaPildora).background(c.soft)
                    .semantics { contentDescription = "Editar lo ahorrado" }.pulsable(escala = 1f, alPulsar = alEditar).padding(horizontal = 16.dp, vertical = 12.dp),
                style = LukApp.tipo.de(15, 600, 1.3f), color = c.inkSoft, textAlign = TextAlign.Center,
            )
        }
    }
}
