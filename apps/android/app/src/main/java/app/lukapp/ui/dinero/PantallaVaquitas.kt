package app.lukapp.ui.dinero

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.datos.AlmacenVaquitas
import app.lukapp.dominio.GastoVaquita
import app.lukapp.dominio.Vaquita
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.calcularResumenVaquita
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.nuevaVaquita
import app.lukapp.dominio.parseAmountInput
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/**
 * VaquitasModal.tsx. Una vaca para un paseo, un asado o un regalo: la meta se reparte en cuotas, cada quien marca
 * cuándo pagó, se anotan los gastos del proyecto y la pantalla dice quién le transfiere a quién para quedar a mano.
 * Como en la web, todo vive solo en este teléfono (no pasa por la cuenta ni por la copia de seguridad).
 */
@Composable
fun PantallaVaquitas(almacen: AlmacenVaquitas, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    var vaquitas by remember(almacen) { mutableStateOf(almacen.leer()) }
    fun cambiar(nuevas: List<Vaquita>) { vaquitas = nuevas; almacen.guardar(nuevas) }
    var seleccionada by rememberSaveable { mutableStateOf("") }
    var creando by rememberSaveable { mutableStateOf(false) }
    var anotando by rememberSaveable { mutableStateOf(false) }
    var nombre by rememberSaveable { mutableStateOf("") }
    var metaTexto by rememberSaveable { mutableStateOf("") }
    var amigos by rememberSaveable { mutableStateOf("") }
    var descripcion by rememberSaveable { mutableStateOf("") }
    var montoTexto by rememberSaveable { mutableStateOf("") }
    var pagadoPor by rememberSaveable { mutableStateOf("Yo") }
    var borrarVaquita by remember { mutableStateOf<Vaquita?>(null) }
    var borrarGasto by remember { mutableStateOf<String?>(null) }

    val activa = vaquitas.firstOrNull { it.id == seleccionada } ?: vaquitas.firstOrNull()
    val resumen = activa?.let { calcularResumenVaquita(it) }
    fun actualizar(v: Vaquita, f: (Vaquita) -> Vaquita) = cambiar(vaquitas.map { if (it.id == v.id) f(it) else it })

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Vaquitas y Gastos Compartidos", style = LukApp.tipo.titulo, color = c.ink)
                Text("Cuentas claras entre parceros y familia", style = LukApp.tipo.xs, color = c.inkSoft)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            if (!creando && activa == null) {
                Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(56.dp).clip(Medidas.formaCard).background(c.warnBg), contentAlignment = Alignment.Center) { Icono(Lucide.Users, tamano = 24.dp, color = c.warnInk) }
                    Text("Sin vaquitas activas", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                    Text(
                        "Arma una vaca con amigos para paseos, asados, regalos o salidas. LukApp calcula las cuotas y quién le debe a quién automáticamente.",
                        style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft, textAlign = TextAlign.Center,
                    )
                    Boton("Armar mi primera vaquita", c.accent, c.onAccent) { creando = true }
                }
            }

            if (!creando && activa != null && resumen != null) {
                if (vaquitas.size > 1) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    vaquitas.forEach { v ->
                        val sel = v.id == activa.id
                        Text(
                            v.nombre, Modifier.clip(Medidas.formaControl).background(if (sel) c.accent else c.soft).semantics { contentDescription = "Vaquita ${v.nombre}" }
                                .pulsable(escala = 1f, alPulsar = { seleccionada = v.id; anotando = false; pagadoPor = "Yo" }).padding(horizontal = 12.dp, vertical = 8.dp),
                            style = LukApp.tipo.de(13, 600, 1.4f), color = if (sel) c.onAccent else c.inkSoft, maxLines = 1,
                        )
                    }
                }

                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(activa.nombre, Modifier.weight(1f), style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                        Text("${resumen.porcentajeRecoleccion}% recolectado", style = LukApp.tipo.de(13, 700, 1.4f), color = c.warnInk)
                        Box(Modifier.padding(start = 8.dp).size(28.dp).semantics { contentDescription = "Eliminar vaquita" }.pulsable(escala = 1f, alPulsar = { borrarVaquita = activa }), contentAlignment = Alignment.Center) {
                            Icono(Lucide.Trash2, tamano = 16.dp, color = c.inkSoft)
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(10.dp).clip(CircleShape).background(c.bg)) {
                        Box(Modifier.fillMaxWidth(resumen.porcentajeRecoleccion / 100f).height(10.dp).clip(CircleShape).background(c.warn))
                    }
                    Row(Modifier.fillMaxWidth()) {
                        Cifra("🎯 Presupuesto:", formatCop(activa.metaCop), c.ink, Modifier.weight(1f))
                        Cifra("🐮 Recolectado:", formatCop(resumen.totalRecolectado), c.entro, Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth()) {
                        Cifra("🧾 Gastado:", formatCop(resumen.totalGastado), c.ink, Modifier.weight(1f))
                        Cifra("💰 Disponible:", formatCop(resumen.saldoDisponible), if (resumen.saldoDisponible < 0) c.salio else c.ink, Modifier.weight(1f))
                    }
                }

                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text("🧾 Gastos del proyecto", style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink)
                            Text(if (activa.gastos.isNotEmpty()) "${activa.gastos.size} gastos registrados" else "Aún no han anotado gastos.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                        }
                        Text(
                            if (anotando) "Cancelar" else "＋ Anotar gasto",
                            Modifier.padding(start = 12.dp).clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Anotar gasto" }.pulsable(escala = 1f, alPulsar = { anotando = !anotando }).padding(horizontal = 12.dp, vertical = 8.dp),
                            style = LukApp.tipo.de(13, 700, 1.4f), color = c.onAccent,
                        )
                    }
                    if (anotando) Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column { Etiq("¿Qué pagaron?"); Box(Modifier.padding(top = 4.dp)) { CampoTexto(descripcion, { descripcion = it }, "Ej. Transporte del paseo", "Qué pagaron") } }
                        Column { Etiq("¿Cuánto costó?"); Box(Modifier.padding(top = 4.dp)) { CampoTexto(montoTexto, { montoTexto = conPuntos(it) }, "Ej. 85.000", "Cuánto costó", numerico = true) } }
                        Column {
                            Etiq("¿Quién pagó?")
                            Box(Modifier.padding(top = 4.dp)) {
                                val actual = if (activa.participantes.any { it.nombre == pagadoPor }) pagadoPor else activa.participantes.first().nombre
                                Desplegable(actual, activa.participantes.map { it.nombre to it.nombre }, "Quién pagó") { pagadoPor = it }
                            }
                        }
                        val monto = parseAmountInput(montoTexto)
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                            Text(
                                "Guardar gasto 🐮",
                                Modifier.clip(Medidas.formaControl).background(c.ink).semantics { contentDescription = "Guardar gasto" }.pulsable(alPulsar = {
                                    if (descripcion.isNotBlank() && monto != null && monto > 0) {
                                        val quien = if (activa.participantes.any { it.nombre == pagadoPor }) pagadoPor else activa.participantes.first().nombre
                                        val gasto = GastoVaquita("gasto-${System.currentTimeMillis()}-${(1000..9999).random()}", descripcion.trim(), monto, quien, bogotaDate())
                                        actualizar(activa) { it.copy(gastos = it.gastos + gasto) }
                                        descripcion = ""; montoTexto = ""; anotando = false
                                    }
                                }).padding(horizontal = 16.dp, vertical = 8.dp),
                                style = LukApp.tipo.de(13, 700, 1.4f), color = c.bg,
                            )
                        }
                    }
                    activa.gastos.forEach { g ->
                        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(1.dp).background(c.line))
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(g.descripcion, style = LukApp.tipo.de(13, 700, 1.4f), color = c.ink, maxLines = 1)
                                Text("Pagó ${g.pagadoPor} · ${g.fecha}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                            }
                            Text(formatCop(g.montoCop), Modifier.padding(horizontal = 8.dp), style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                            Box(Modifier.size(28.dp).semantics { contentDescription = "Eliminar gasto ${g.descripcion}" }.pulsable(escala = 1f, alPulsar = { borrarGasto = g.id }), contentAlignment = Alignment.Center) {
                                Icono(Lucide.Trash2, tamano = 16.dp, color = c.inkFaint)
                            }
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Participantes (${activa.participantes.size}):", style = LukApp.tipo.de(13, 700, 1.4f), color = c.ink)
                    activa.participantes.forEach { p ->
                        val alDia = p.aportadoCop >= p.cuotaComprometida
                        Row(Modifier.fillMaxWidth().clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.bg).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(p.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                                Text("Cuota: ${formatCop(p.cuotaComprometida)} · Aportó: ${formatCop(p.aportadoCop)}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                            }
                            if (alDia) Row(Modifier.clip(CircleShape).background(c.entroBg).padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icono(Lucide.Check, tamano = 14.dp, grosor = 3f, color = c.entro)
                                Text("Al día", style = LukApp.tipo.de(13, 700, 1.4f), color = c.entro)
                            } else Text(
                                "Marcar pagado",
                                Modifier.padding(start = 8.dp).clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Marcar pagado a ${p.nombre}" }
                                    .pulsable(escala = 1f, alPulsar = { actualizar(activa) { v -> v.copy(participantes = v.participantes.map { q -> if (q.nombre == p.nombre) q.copy(aportadoCop = q.cuotaComprometida) else q }) } })
                                    .padding(horizontal = 12.dp, vertical = 4.dp),
                                style = LukApp.tipo.de(13, 700, 1.4f), color = c.onAccent,
                            )
                        }
                    }
                }

                if (resumen.liquidacionesSugeridas.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Para quedar a mano:", style = LukApp.tipo.de(13, 700, 1.4f), color = c.warnInk)
                    resumen.liquidacionesSugeridas.forEach { l ->
                        Text("${l.deudor} le debe transferir ${formatCop(l.montoCop)} a ${l.acreedor}", style = LukApp.tipo.de(13, 600, 1.5f), color = c.ink)
                    }
                }

                Row(
                    Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Armar otra vaca" }.pulsable(alPulsar = { creando = true }).padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = c.ink)
                    Text("Armar otra vaca", style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink)
                }
            }

            if (creando) Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Armar una Vaquita nueva", style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink)
                Column { Etiq("¿Para qué es la vaca?"); Box(Modifier.padding(top = 4.dp)) { CampoTexto(nombre, { nombre = it }, "Ej. Paseo a Melgar, Asado, Regalo Mamá...", "Para qué es la vaca") } }
                Column { Etiq("Meta de plata total (COP):"); Box(Modifier.padding(top = 4.dp)) { CampoTexto(metaTexto, { metaTexto = conPuntos(it) }, "Ej. 200.000", "Meta de plata total", numerico = true) } }
                Column { Etiq("Amigos que participan (separados por coma):"); Box(Modifier.padding(top = 4.dp)) { CampoTexto(amigos, { amigos = it }, "Ej. Carlos, María, Juan...", "Amigos que participan") } }
                val meta = parseAmountInput(metaTexto) ?: 0L
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.weight(1f).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Cancelar" }.pulsable(alPulsar = { creando = false }).padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                        Text("Cancelar", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                    }
                    Box(
                        Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Crear Vaquita" }.pulsable(alPulsar = {
                            // La web exige un nombre de amigos escrito; sin él no hay con quién repartir.
                            if (amigos.isNotBlank()) nuevaVaquita(nombre, meta, amigos, "vaca-${System.currentTimeMillis()}", bogotaDate())?.let {
                                cambiar(listOf(it) + vaquitas); seleccionada = it.id; creando = false; nombre = ""; metaTexto = ""; amigos = ""
                            }
                        }).padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text("Crear Vaquita", style = LukApp.tipo.de(15, 700, 1.4f), color = c.onAccent) }
                }
            }
        }
    }

    borrarVaquita?.let { v ->
        AlertDialog(
            onDismissRequest = { borrarVaquita = null },
            title = { Text("¿Eliminar “${v.nombre}” y sus aportes de este dispositivo? Esta acción no se puede deshacer.") },
            confirmButton = { TextButton(onClick = { borrarVaquita = null; val resto = vaquitas.filter { it.id != v.id }; cambiar(resto); seleccionada = resto.firstOrNull()?.id ?: "" }) { Text("Eliminar") } },
            dismissButton = { TextButton(onClick = { borrarVaquita = null }) { Text("Cancelar") } },
        )
    }
    borrarGasto?.let { id ->
        AlertDialog(
            onDismissRequest = { borrarGasto = null },
            title = { Text("¿Eliminar este gasto del proyecto?") },
            confirmButton = { TextButton(onClick = { borrarGasto = null; activa?.let { a -> actualizar(a) { it.copy(gastos = it.gastos.filter { g -> g.id != id }) } } }) { Text("Eliminar") } },
            dismissButton = { TextButton(onClick = { borrarGasto = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun Etiq(texto: String) = Text(texto, style = LukApp.tipo.de(13, 600, 1.4f), color = LukApp.colores.inkSoft)

@Composable
private fun Cifra(etiqueta: String, valor: String, color: androidx.compose.ui.graphics.Color, modificador: Modifier) {
    Column(modificador) {
        Text(etiqueta, style = LukApp.tipo.de(13, 400, 1.4f), color = LukApp.colores.inkFaint)
        Text(valor, style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = color)
    }
}

@Composable
private fun Boton(texto: String, fondo: androidx.compose.ui.graphics.Color, tinta: androidx.compose.ui.graphics.Color, alPulsar: () -> Unit) {
    Row(Modifier.clip(Medidas.formaControl).background(fondo).semantics { contentDescription = texto }.pulsable(alPulsar = alPulsar).padding(horizontal = 20.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = tinta)
        Text(texto, style = LukApp.tipo.de(15, 700, 1.4f), color = tinta)
    }
}
