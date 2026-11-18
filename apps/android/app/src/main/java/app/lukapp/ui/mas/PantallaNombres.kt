package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Contacto
import app.lukapp.dominio.Duda
import app.lukapp.dominio.armarFilasContactos
import app.lukapp.dominio.balanceConAlias
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.dudasDeUnion
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.movimientosDeAlias
import app.lukapp.dominio.normalizarNombre
import app.lukapp.dominio.partesDelLibro
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/** Lo que Nombres repetidos escribe en el libro; cada una devuelve si se guardó. */
class AccionesNombres(
    val unir: suspend (a: String, b: String, nombre: String) -> Boolean,
    val separar: suspend (a: String, b: String, nombre: String) -> Boolean,
    val renombrar: suspend (Contacto) -> Boolean,
    val deshacer: suspend (String) -> Boolean,
    val apodar: suspend (clave: String, nombre: String, apodo: String, quitar: Boolean) -> Boolean,
)

/**
 * ContactosView.tsx («Nombres repetidos»): con quién mueves la plata, salido solo de los movimientos. La app
 * pregunta por UN par parecido a la vez («¿Son la misma persona?»); unir se puede deshacer y «no» se recuerda
 * para no volver a preguntar. Tocar una fila abre lo movido con esa persona y sus apodos.
 */
@Composable
fun PantallaNombres(vista: VistaInicio, acciones: AccionesNombres, alCerrar: () -> Unit) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    val contactos = vista.libro.contactos
    val partes = remember(vista.libro.transacciones) { partesDelLibro(vista.libro.transacciones) }
    val filas = remember(partes, contactos) { armarFilasContactos(partes, contactos) }
    val dudas = remember(partes, contactos) { dudasDeUnion(partes, contactos) }
    var editando by rememberSaveable { mutableStateOf<String?>(null) }
    var borrador by rememberSaveable { mutableStateOf("") }
    var agregando by rememberSaveable { mutableStateOf(false) }
    var nombreNuevo by rememberSaveable { mutableStateOf("") }
    var aliasNuevo by rememberSaveable { mutableStateOf("") }
    // Se guarda la CLAVE, no la fila: es un objeto derivado y quedaría con la versión de antes del cambio.
    var claveAbierta by rememberSaveable { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    // También por alias: poner el primer apodo CREA el contacto y la fila pasa a llavearse por su id.
    val abierta = claveAbierta?.let { k -> filas.firstOrNull { it.clave == k || k in it.alias } }
    BackHandler { if (claveAbierta != null) claveAbierta = null else alCerrar() }
    fun guardado(bloque: suspend () -> Boolean, alExito: () -> Unit = {}) {
        ambito.launch { if (bloque()) { error = null; alExito() } else error = "No se pudo guardar. Inténtalo de nuevo." }
    }

    Box(Modifier.fillMaxSize().background(c.bg)) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Nombres repetidos", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
                Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                    Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
                }
            }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icono(Lucide.Users, tamano = 14.dp, grosor = 2.5f, color = c.inkSoft)
                        Text("Con quién mueves la plata", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                    }
                    Text(filas.size.toString(), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(44, 600, 1.1f), color = c.ink)
                    Text("Salen solos de tus movimientos. También puedes preparar aquí a quién le transfieres.", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
                    Row(
                        Modifier.padding(top = 16.dp).clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl)
                            .semantics { contentDescription = "Agregar persona" }.pulsable(alPulsar = { agregando = !agregando }).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icono(Lucide.UserPlus, tamano = 16.dp, color = c.inkSoft)
                        Text("Agregar persona", style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                    }
                    if (agregando) Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CampoTexto(nombreNuevo, { nombreNuevo = it }, "Nombre de la persona", "Nombre de la persona")
                        CampoTexto(aliasNuevo, { aliasNuevo = it }, "Cómo aparece en el extracto (opcional)", "Cómo aparece en el extracto")
                        Box(
                            Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Guardar persona" }.pulsable(alPulsar = {
                                val nombre = nombreNuevo.trim()
                                val alias = normalizarNombre(aliasNuevo.ifEmpty { nombre })
                                if (nombre.isEmpty() || alias.isEmpty()) return@pulsable
                                guardado({ acciones.apodar(alias, nombre, nombre, false) }) { nombreNuevo = ""; aliasNuevo = ""; agregando = false }
                            }).padding(horizontal = 12.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) { Text("Guardar persona", style = LukApp.tipo.de(13, 600, 1.3f), color = c.onAccent) }
                    }
                    dudas.firstOrNull()?.let { d -> DudaCard(d, { guardado({ acciones.unir(d.a.clave, d.b.clave, d.a.nombre) }) }, { guardado({ acciones.separar(d.a.clave, d.b.clave, d.a.nombre) }) }) }
                }

                if (filas.isEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).padding(horizontal = 24.dp, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icono(Lucide.Users, tamano = 36.dp, grosor = 1.5f, color = c.inkGhost)
                    Text("Todavía no hay contactos.", Modifier.padding(top = 12.dp), style = LukApp.tipo.cuerpoB, color = c.ink)
                    Text(
                        "Aparecen solos cuando un movimiento diga con quién fue — una transferencia, un pago por BRE-B, un extracto que subas.",
                        Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkFaint,
                    )
                }

                filas.forEach { fila ->
                    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp)) {
                        if (editando == fila.clave && fila.contacto != null) Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.weight(1f)) { CampoTexto(borrador, { borrador = it }, "", "Nombre de ${fila.nombre}") }
                            Box(
                                Modifier.size(40.dp).semantics { contentDescription = "Guardar nombre" }.pulsable(alPulsar = {
                                    val nombre = borrador.trim()
                                    if (nombre.isEmpty()) { editando = null; return@pulsable }
                                    guardado({ acciones.renombrar(fila.contacto.copy(nombre = nombre)) }) { editando = null }
                                }), contentAlignment = Alignment.Center,
                            ) { Icono(Lucide.Check, tamano = 16.dp, grosor = 3f, color = c.inkSoft) }
                        } else Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f).clickable { claveAbierta = fila.clave }) {
                                Text(fila.nombre, style = LukApp.tipo.cuerpoB, color = c.ink, maxLines = 1)
                                Text(
                                    (if (fila.movimientos == 0) "Sin movimientos todavía" else "${fila.movimientos} movimiento${if (fila.movimientos == 1) "" else "s"} · último ${dayLabel(fila.ultimaFecha, vista.hoy)}") +
                                        if (fila.alias.size > 1) " · ${fila.alias.size} grafías" else "",
                                    style = LukApp.tipo.xs, color = c.inkFaint,
                                )
                            }
                            if (fila.contacto != null) {
                                Box(Modifier.size(36.dp).semantics { contentDescription = "Renombrar ${fila.nombre}" }.pulsable(alPulsar = { editando = fila.clave; borrador = fila.nombre }), contentAlignment = Alignment.Center) {
                                    Icono(Lucide.Pencil, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                                }
                                // Deshacer una unión es la razón de que exista esta pantalla: un «sí» equivocado no puede ser permanente.
                                if (fila.alias.size > 1) Box(Modifier.size(36.dp).semantics { contentDescription = "Deshacer la unión de ${fila.nombre}" }.pulsable(alPulsar = { guardado({ acciones.deshacer(fila.contacto.id) }) }), contentAlignment = Alignment.Center) {
                                    Icono(Lucide.Link2Off, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                                }
                            }
                        }
                    }
                }
            }
        }

        abierta?.let { f ->
            DetalleContacto(
                f.nombre, f.alias, f.contacto?.apodos ?: emptyList(), vista,
                alAgregar = { apodo -> acciones.apodar(f.alias[0], f.nombre, apodo, false) },
                alQuitar = { apodo -> acciones.apodar(f.alias[0], f.nombre, apodo, true) },
                alCerrar = { claveAbierta = null },
            )
        }
    }
}

/** DudaContacto.tsx: una sola pregunta, o nada. */
@Composable
private fun DudaCard(d: Duda, alUnir: () -> Unit, alSeparar: () -> Unit) {
    val c = LukApp.colores
    val veces = { n: Int -> "$n movimiento${if (n == 1) "" else "s"}" }
    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 12.dp).semantics { contentDescription = "Contactos parecidos" }) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(Lucide.Users, tamano = 12.dp, grosor = 3f, color = c.inkFaint)
            Text("¿SON LA MISMA PERSONA?", style = LukApp.tipo.de(13, 600, 1.3f, 0.05f), color = c.inkFaint)
        }
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(d.a, d.b).forEach { p ->
                Row { Text(p.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink); Text(" · ${veces(p.movimientos)}", style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkFaint) }
            }
        }
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.weight(1f).clip(CircleShape).background(c.accent).semantics { contentDescription = "Sí, únelos" }.pulsable(alPulsar = alUnir).padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) { Icono(Lucide.Check, tamano = 12.dp, grosor = 3f, color = c.onAccent); Text("Sí, únelos", style = LukApp.tipo.de(13, 600, 1.3f), color = c.onAccent) }
            Row(
                Modifier.weight(1f).clip(CircleShape).border(1.dp, c.line, CircleShape).semantics { contentDescription = "No, son distintos" }.pulsable(alPulsar = alSeparar).padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) { Icono(Lucide.X, tamano = 12.dp, grosor = 3f, color = c.inkSoft); Text("No, son distintos", style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft) }
        }
    }
}

/** DetalleContacto.tsx: todo lo movido con alguien, en qué quedó la cuenta y cómo le dices. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DetalleContacto(
    nombre: String, alias: List<String>, apodos: List<String>, vista: VistaInicio,
    alAgregar: suspend (String) -> Boolean, alQuitar: suspend (String) -> Boolean, alCerrar: () -> Unit,
) {
    val c = LukApp.colores
    val ambito = rememberCoroutineScope()
    var nuevoApodo by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val movimientos = remember(vista.libro.transacciones, alias) { movimientosDeAlias(vista.libro.transacciones, alias) }
    val balance = remember(vista.libro.transacciones, alias) { balanceConAlias(vista.libro.transacciones, alias) }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().semantics { contentDescription = "Movimientos con $nombre" }) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(nombre, style = LukApp.tipo.de(20, 600, 1.3f), color = c.ink, maxLines = 1)
                Text(
                    "${movimientos.size} movimiento${if (movimientos.size == 1) "" else "s"}" + if (alias.size > 1) " · ${alias.size} formas de escribirlo" else "",
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint,
                )
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Resumen(Modifier.weight(1f), "Le mandaste", Lucide.ArrowUpCircle, formatCop(balance.salioCop), c.salio)
                Resumen(Modifier.weight(1f), "Te mandó", Lucide.ArrowDownCircle, formatCop(balance.entroCop), c.entro)
            }
            if (balance.netoCop != 0L) Text(
                if (balance.netoCop > 0) "En total te ha entrado ${formatCop(balance.netoCop)} más de lo que le has mandado."
                else "En total le has mandado ${formatCop(-balance.netoCop)} más de lo que te ha entrado.",
                style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft,
            )

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Tag, tamano = 12.dp, grosor = 3f, color = c.inkFaint)
                    Text("CÓMO LE DICES", style = LukApp.tipo.de(13, 600, 1.3f, 0.05f), color = c.inkFaint)
                }
                if (apodos.isNotEmpty()) FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    apodos.forEach { a ->
                        Row(
                            Modifier.clip(CircleShape).background(c.soft).semantics { contentDescription = "Quitar el apodo $a" }.pulsable(alPulsar = { ambito.launch { if (!alQuitar(a)) error = "No se pudo guardar. Inténtalo de nuevo." } }).padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                        ) { Text(a, style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft); Icono(Lucide.X, tamano = 12.dp, grosor = 3f, color = c.inkSoft) }
                    }
                }
                error?.let { Text(it, Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.salio) }
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { CampoTexto(nuevoApodo, { nuevoApodo = it }, "pa, ana riaza, el jefe…", "Nuevo apodo para $nombre") }
                    Box(
                        Modifier.size(48.dp).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Agregar apodo" }.pulsable(alPulsar = {
                            if (nuevoApodo.trim().isEmpty()) return@pulsable
                            ambito.launch { if (alAgregar(nuevoApodo)) { nuevoApodo = ""; error = null } else error = "No se pudo guardar. Inténtalo de nuevo." }
                        }),
                        contentAlignment = Alignment.Center,
                    ) { Icono(Lucide.Plus, tamano = 16.dp, grosor = 3f, color = c.inkSoft) }
                }
            }

            movimientos.forEach { tx ->
                val e = vista.catalogo.de(tx.category)
                val ingreso = tx.kind == "ingreso"
                Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.porNombre[e.icono] ?: Lucide.Package, tamano = 16.dp, color = colorHex(e.color))
                    Column(Modifier.weight(1f)) {
                        Text(tx.description, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
                        Text("${dayLabel(tx.occurredOn, vista.hoy)} · ${e.nombre}", style = LukApp.tipo.xs, color = c.inkFaint)
                    }
                    Text((if (ingreso) "+" else "−") + formatCop(tx.amountCop), style = LukApp.tipo.de(17, 600, 1.3f), color = if (ingreso) c.entro else c.salio)
                }
            }
        }
    }
}

@Composable
private fun Resumen(modifier: Modifier, titulo: String, icono: IconoLucide, valor: String, color: androidx.compose.ui.graphics.Color) {
    val c = LukApp.colores
    Column(modifier.clip(Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(icono, tamano = 12.dp, grosor = 2.5f, color = c.inkFaint)
            Text(titulo, style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkFaint)
        }
        Text(valor, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(20, 600, 1.3f), color = color)
    }
}
