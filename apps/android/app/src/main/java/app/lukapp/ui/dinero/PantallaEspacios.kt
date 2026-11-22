package app.lukapp.ui.dinero

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.EspacioCompartido
import app.lukapp.dominio.ICONOS_ESPACIO
import app.lukapp.dominio.NOMBRES_ICONO_ESPACIO
import app.lukapp.dominio.YO
import app.lukapp.dominio.balanceDe
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.descripcionMiMitad
import app.lukapp.dominio.emojiDeEspacio
import app.lukapp.dominio.enlaceDeInvitacion
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.integrantesConYoPrimero
import app.lukapp.dominio.mensajeDeCuentas
import app.lukapp.dominio.miMitad
import app.lukapp.dominio.parseSaldoInput
import app.lukapp.dominio.tokenDeInvitacion
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/**
 * EspaciosCompartidosView.tsx. Un espacio con otra persona (pareja, viaje, hogar): cada uno anota lo que paga y la
 * pantalla dice quién le debe a quién. Es la parte real de la app: lo que se anota lo ve la otra persona en su
 * cuenta (web o Android). Para invitar se manda un enlace; quien lo recibe lo abre con su propia cuenta de LukApp.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaEspacios(modelo: ModeloEspacios, alAnotarEnLukApp: (Long, String, String) -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val contexto = LocalContext.current
    val ambito = rememberCoroutineScope()
    LaunchedEffect(Unit) { modelo.cargar() }
    val espacios by modelo.espacios.collectAsState()
    val error by modelo.error.collectAsState()
    val ocupado by modelo.ocupado.collectAsState()

    var seleccionado by rememberSaveable { mutableStateOf("") }
    var formulario by rememberSaveable { mutableStateOf("") } // "", "gasto", "espacio" o "enlace"
    var descripcion by rememberSaveable { mutableStateOf("") }
    var montoTexto by rememberSaveable { mutableStateOf("") }
    var pagadoPor by rememberSaveable { mutableStateOf(YO) }
    var anotarMitad by rememberSaveable { mutableStateOf(true) }
    var nombreNuevo by rememberSaveable { mutableStateOf("") }
    var iconoNuevo by rememberSaveable { mutableStateOf(ICONOS_ESPACIO[0]) }
    var enlacePegado by rememberSaveable { mutableStateOf("") }
    var aviso by rememberSaveable { mutableStateOf("") }
    var enlaceCreado by rememberSaveable { mutableStateOf("") }
    var borrarGasto by remember { mutableStateOf<String?>(null) }
    var confirmarSaldo by remember { mutableStateOf(false) }

    val lista = espacios
    val activo: EspacioCompartido? = lista?.firstOrNull { it.id == seleccionado } ?: lista?.firstOrNull()

    fun compartir(texto: String, titulo: String) {
        val envio = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, texto) }
        contexto.startActivity(Intent.createChooser(envio, titulo).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Finanzas en Pareja y Compartidas", style = LukApp.tipo.titulo, color = c.ink)
                Text("Planifica en equipo y lleva las cuentas claras sin discusiones", style = LukApp.tipo.xs, color = c.inkSoft)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            error?.let {
                Text(it, Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.salioBg).padding(12.dp).semantics { contentDescription = "Error" }, style = LukApp.tipo.de(13, 400, 1.5f), color = c.salio)
            }
            if (lista == null) Text("Cargando…", Modifier.fillMaxWidth().padding(vertical = 24.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkFaint, textAlign = TextAlign.Center)

            if (lista != null) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                lista.forEach { e ->
                    val sel = e.id == activo?.id
                    Row(
                        Modifier.clip(CircleShape).background(if (sel) c.ink else c.soft).semantics { contentDescription = "Espacio ${e.nombre}" }
                            .pulsable(escala = 1f, alPulsar = { seleccionado = e.id; pagadoPor = YO; enlaceCreado = ""; aviso = ""; modelo.limpiarError() }).padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(emojiDeEspacio(e.icono), style = LukApp.tipo.de(15, 400, 1.2f))
                        Text(e.nombre, style = LukApp.tipo.de(15, 600, 1.2f), color = if (sel) c.bg else c.inkSoft, maxLines = 1)
                    }
                }
                Row(
                    Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).semantics { contentDescription = "Nuevo espacio" }
                        .pulsable(escala = 1f, alPulsar = { modelo.limpiarError(); formulario = if (formulario == "espacio") "" else "espacio" }).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = c.inkSoft)
                    Text("Nuevo espacio", style = LukApp.tipo.de(13, 500, 1.2f), color = c.inkSoft, maxLines = 1)
                }
            }

            if (formulario == "espacio") Tarjeta {
                Text("Crear Espacio Compartido", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                Etiq("Nombre del espacio", 12); Box(Modifier.padding(top = 4.dp)) { CampoTexto(nombreNuevo, { nombreNuevo = it }, "Ej. Viaje a Cancún, Arriendo, Cenas...", "Nombre del espacio") }
                Etiq("Icono", 12)
                FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ICONOS_ESPACIO.forEach { em ->
                        val sel = iconoNuevo == em
                        Box(Modifier.size(40.dp).clip(Medidas.formaControl).background(if (sel) c.accent else c.soft).semantics { contentDescription = "Icono ${NOMBRES_ICONO_ESPACIO[em]}" }.pulsable(escala = 1f, alPulsar = { iconoNuevo = em }), contentAlignment = Alignment.Center) {
                            Text(em, style = LukApp.tipo.de(17, 400, 1.2f))
                        }
                    }
                }
                Text("💌 Cuando crees el espacio, podrás invitar a alguien con su propia cuenta de LukApp.", Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(12.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
                Acciones("Cancelar", { formulario = "" }, if (ocupado) "Creando…" else "Crear espacio", !ocupado && nombreNuevo.isNotBlank()) {
                    ambito.launch { modelo.crearEspacio(nombreNuevo, iconoNuevo)?.let { seleccionado = it; nombreNuevo = ""; formulario = "" } }
                }
            }

            if (lista != null && activo == null && formulario != "espacio") Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("💌", style = LukApp.tipo.de(28, 400, 1.2f))
                Text("Aún no tienes espacios compartidos", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                Text("Crea uno con «Nuevo espacio» o acepta la invitación que te mandaron.", style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft, textAlign = TextAlign.Center)
            }

            if (lista != null) Row(
                Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).semantics { contentDescription = "Tengo un enlace de invitación" }
                    .pulsable(escala = 1f, alPulsar = { modelo.limpiarError(); formulario = if (formulario == "enlace") "" else "enlace" }).padding(horizontal = 16.dp, vertical = 8.dp),
            ) { Text("Tengo un enlace de invitación", style = LukApp.tipo.de(13, 600, 1.2f), color = c.inkSoft) }

            if (formulario == "enlace") Tarjeta {
                Text("Unirme a un espacio", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                Text("Pega aquí el enlace que te mandaron. Se une con tu cuenta de LukApp.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
                Box(Modifier.padding(top = 12.dp)) { CampoTexto(enlacePegado, { enlacePegado = it }, "https://mi.lukapp.app/?invitacion=…", "Enlace de invitación") }
                val token = tokenDeInvitacion(enlacePegado)
                Acciones("Cancelar", { formulario = "" }, if (ocupado) "Uniéndome…" else "Unirme", !ocupado && token != null) {
                    ambito.launch { if (modelo.aceptar(token!!)) { aviso = "🎉 ¡Listo! Ya formas parte del espacio compartido."; enlacePegado = ""; formulario = "" } }
                }
            }

            if (activo != null) {
                val b = balanceDe(activo)
                val integrantes = integrantesConYoPrimero(activo)
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(horizontalArrangement = Arrangement.spacedBy((-16).dp)) {
                        Avatar(integrantes.getOrNull(0)?.emoji ?: "🙂", Color(0xFFFED7AA))
                        Avatar(integrantes.getOrNull(1)?.emoji ?: "💌", Color(0xFFFBCFE8))
                    }
                    Text("${integrantes.getOrNull(0)?.nombre ?: "Tú"} & ${integrantes.getOrNull(1)?.nombre ?: "Pareja"}", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                    Text("ESPACIO: ${activo.nombre.uppercase()}", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                    Column(Modifier.padding(top = 16.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("ESTADO DE CUENTAS", style = LukApp.tipo.de(13, 700, 1.4f), color = c.inkFaint)
                        when {
                            !b.hayPareja -> Text("💌 Invita a alguien para empezar a repartir los gastos.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft, textAlign = TextAlign.Center)
                            b.balanceMio > 0 -> Text("${b.nombreOtro} te debe ${formatCop(b.balanceMio)}", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(22, 700, 1.25f), color = c.entro, textAlign = TextAlign.Center)
                            b.balanceMio < 0 -> Text("Le debes ${formatCop(-b.balanceMio)} a ${b.nombreOtro}", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(22, 700, 1.25f), color = c.salio, textAlign = TextAlign.Center)
                            else -> Text("¡Están a mano!", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(22, 700, 1.25f), color = c.ink)
                        }
                        Row(Modifier.padding(top = 12.dp).fillMaxWidth()) {
                            Column(Modifier.weight(1f)) { Text("Pagado por Ti:", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft); Text(formatCop(b.pagadoPorMi), style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink) }
                            Column(Modifier.weight(1f)) { Text("Pagado por ${b.nombreOtro}:", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft); Text(formatCop(b.pagadoPorOtro), style = LukApp.tipo.de(13, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink) }
                        }
                    }
                    if (aviso.isNotEmpty()) Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.entroBg).padding(12.dp)) {
                        Text(aviso, style = LukApp.tipo.de(13, 400, 1.5f), color = c.ink)
                        if (enlaceCreado.isNotEmpty()) SelectionContainer { Text(enlaceCreado, Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).padding(12.dp).semantics { contentDescription = "Enlace de invitación" }, style = LukApp.tipo.de(13, 400, 1.4f), color = c.ink) }
                    }
                    FlowRow(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Pildora("Anotar gasto compartido", c.ink, c.bg, true) { formulario = if (formulario == "gasto") "" else "gasto" }
                        Pildora(if (ocupado) "Preparando enlace…" else "Vincular pareja", c.card, c.ink, !ocupado, borde = true) {
                            ambito.launch {
                                modelo.invitar(activo.id)?.let { t ->
                                    val enlace = enlaceDeInvitacion(t)
                                    enlaceCreado = enlace
                                    aviso = "💌 Invitación lista. La otra persona debe abrirla con su cuenta de LukApp."
                                    compartir("Únete a nuestro espacio compartido de LukApp 🥑\n$enlace", "Invitación a ${activo.nombre}")
                                }
                            }
                        }
                        Pildora("WhatsApp", c.accent, c.onAccent, true) { compartir(mensajeDeCuentas(activo.nombre, b), "Compartir cuentas") }
                        if (activo.gastos.isNotEmpty()) Pildora("Saldar a $0", c.card, c.inkSoft, true, borde = true) { confirmarSaldo = true }
                    }
                }

                if (formulario == "gasto") Tarjeta {
                    Text("Nuevo Gasto Compartido", style = LukApp.tipo.de(17, 700, 1.3f), color = c.ink)
                    Etiq("¿En qué fue el gasto?", 12); Box(Modifier.padding(top = 4.dp)) { CampoTexto(descripcion, { descripcion = it }, "Ej. Mercado Éxito, Cena, Gasolina...", "En qué fue el gasto") }
                    Etiq("Monto total ($)", 12); Box(Modifier.padding(top = 4.dp)) { CampoTexto(montoTexto, { montoTexto = conPuntos(it) }, "Ej. 180.000", "Monto total del gasto", numerico = true) }
                    Etiq("¿Quién pagó la cuenta?", 12)
                    Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Eleccion("Pagué Yo", pagadoPor == YO, Modifier.weight(1f)) { pagadoPor = YO }
                        if (b.hayPareja) {
                            val otro = integrantes.first { it.id != YO }
                            Eleccion("Pagó ${otro.nombre}", pagadoPor != YO, Modifier.weight(1f)) { pagadoPor = otro.id }
                        }
                    }
                    if (pagadoPor == YO) Row(Modifier.padding(top = 8.dp).fillMaxWidth().pulsable(escala = 1f, alPulsar = { anotarMitad = !anotarMitad }), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = anotarMitad, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint))
                        Text("Anotar mi mitad en mis gastos personales de LukApp", Modifier.padding(start = 8.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.ink)
                    }
                    val monto = parseSaldoInput(montoTexto) ?: 0L
                    Acciones("Cancelar", { formulario = "" }, if (ocupado) "Guardando…" else "Guardar gasto", !ocupado && descripcion.isNotBlank() && monto > 0) {
                        ambito.launch {
                            if (modelo.agregarGasto(activo.id, descripcion.trim(), monto, pagadoPor)) {
                                aviso = "✅ Gasto compartido guardado."
                                val d = descripcion
                                descripcion = ""; montoTexto = ""; formulario = ""
                                // Como la web: tu mitad se anota en lo personal solo si pagaste tú y lo pediste.
                                if (anotarMitad && pagadoPor == YO) alAnotarEnLukApp(miMitad(monto), descripcionMiMitad(d, activo.nombre), "otros")
                            }
                        }
                    }
                }

                Column {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Gastos del Espacio (${activo.gastos.size})", style = LukApp.tipo.de(15, 700, 1.4f), color = c.ink)
                        Text("Total: ${formatCop(b.total)}", style = LukApp.tipo.de(13, 500, 1.4f), color = c.inkSoft)
                    }
                    if (activo.gastos.isEmpty()) Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("💡", style = LukApp.tipo.de(28, 400, 1.2f))
                        Text("No hay gastos pendientes", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 500, 1.4f), color = c.ink)
                        Text("Anota el primer gasto compartido tocando el botón de arriba.", style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint, textAlign = TextAlign.Center)
                    } else Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        activo.gastos.forEach { g ->
                            val pagador = integrantes.firstOrNull { it.id == g.pagadoPorId }
                            val nombrePagador = if (g.pagadoPorId == YO) "Tú" else pagador?.nombre ?: b.nombreOtro
                            Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(pagador?.emoji ?: "👤", Modifier.padding(end = 12.dp), style = LukApp.tipo.de(17, 400, 1.2f))
                                Column(Modifier.weight(1f)) {
                                    Text(g.descripcion, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
                                    Text("Pagó $nombrePagador • ${g.fecha}", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                                }
                                Text(formatCop(g.montoCop), Modifier.padding(horizontal = 8.dp), style = LukApp.tipo.de(15, 700, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                                Box(Modifier.size(28.dp).semantics { contentDescription = "Eliminar gasto ${g.descripcion}" }.pulsable(escala = 1f, alPulsar = { borrarGasto = g.id }), contentAlignment = Alignment.Center) { Icono(Lucide.Trash2, tamano = 16.dp, color = c.inkFaint) }
                            }
                        }
                    }
                }
            }
        }
    }

    borrarGasto?.let { id ->
        AlertDialog(
            onDismissRequest = { borrarGasto = null },
            title = { Text("¿Eliminar este gasto del espacio? Se borra para todos los integrantes.") },
            confirmButton = { TextButton(onClick = { borrarGasto = null; ambito.launch { if (modelo.borrarGasto(id)) aviso = "" } }) { Text("Eliminar") } },
            dismissButton = { TextButton(onClick = { borrarGasto = null }) { Text("Cancelar") } },
        )
    }
    if (confirmarSaldo && activo != null) {
        AlertDialog(
            onDismissRequest = { confirmarSaldo = false },
            title = { Text("¿Confirmas que ya se transfirieron el dinero y están a paz y salvo? Se borran todos los gastos del espacio, para los dos.") },
            confirmButton = { TextButton(onClick = { confirmarSaldo = false; ambito.launch { if (modelo.saldar(activo.id)) aviso = "🤝 Cuentas saldadas." } }) { Text("Saldar") } },
            dismissButton = { TextButton(onClick = { confirmarSaldo = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun Tarjeta(contenido: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(LukApp.colores.card).border(1.dp, LukApp.colores.line, Medidas.formaCard).padding(20.dp)) { contenido() }
}

@Composable
private fun Etiq(texto: String, arriba: Int) = Text(texto.uppercase(), Modifier.padding(top = arriba.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = LukApp.colores.inkSoft)

@Composable
private fun Avatar(emoji: String, fondo: Color) {
    Box(Modifier.size(64.dp).clip(CircleShape).background(fondo).border(4.dp, LukApp.colores.card, CircleShape), contentAlignment = Alignment.Center) { Text(emoji, style = LukApp.tipo.de(28, 400, 1.2f)) }
}

@Composable
private fun Pildora(texto: String, fondo: Color, tinta: Color, activa: Boolean, borde: Boolean = false, alPulsar: () -> Unit) {
    Text(
        texto,
        Modifier.alpha(if (activa) 1f else 0.5f).clip(CircleShape).then(if (borde) Modifier.border(1.dp, LukApp.colores.line, CircleShape) else Modifier).background(fondo)
            .semantics { contentDescription = texto }.pulsable(alPulsar = { if (activa) alPulsar() }).padding(horizontal = 16.dp, vertical = 12.dp),
        style = LukApp.tipo.de(15, 700, 1.3f), color = tinta, maxLines = 1,
    )
}

@Composable
private fun Eleccion(texto: String, elegida: Boolean, modificador: Modifier, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Box(modificador.clip(Medidas.formaControl).background(if (elegida) c.ink else c.soft).semantics { contentDescription = texto }.pulsable(escala = 1f, alPulsar = alPulsar).padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        Text(texto, style = LukApp.tipo.de(15, 700, 1.3f), color = if (elegida) c.bg else c.inkSoft, maxLines = 1)
    }
}

@Composable
private fun Acciones(cancelar: String, alCancelar: () -> Unit, aceptar: String, activa: Boolean, alAceptar: () -> Unit) {
    val c = LukApp.colores
    Row(Modifier.padding(top = 16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
        Text(cancelar, Modifier.clip(CircleShape).semantics { contentDescription = cancelar }.pulsable(escala = 1f, alPulsar = alCancelar).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.de(15, 600, 1.3f), color = c.inkSoft)
        Text(
            aceptar, Modifier.alpha(if (activa) 1f else 0.5f).clip(CircleShape).background(c.ink).semantics { contentDescription = aceptar }.pulsable(alPulsar = { if (activa) alAceptar() }).padding(horizontal = 20.dp, vertical = 12.dp),
            style = LukApp.tipo.de(15, 700, 1.3f), color = c.bg,
        )
    }
}
