package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.COLORES_CATEGORIA
import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.EMOJIS_POPULARES_CATEGORIA
import app.lukapp.dominio.ICONOS_CATEGORIA
import app.lukapp.dominio.sugerirEmojiCategoria
import app.lukapp.dominio.sugerirIconoCategoria
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/** Lo que Categorías escribe en el libro; cada una devuelve si se guardó. */
class AccionesCategorias(
    val crear: suspend (nombre: String, icon: String, emoji: String, color: String) -> Boolean,
    val actualizar: suspend (CategoriaPersonal) -> Boolean,
    val archivar: suspend (CategoriaPersonal) -> Boolean,
    val borrar: suspend (String) -> Boolean,
)

private data class Datos(val nombre: String, val icon: String, val emoji: String, val color: String)

/**
 * CategoriasEditor.tsx. Las propias se crean, editan, archivan (si ya tienen movimientos: siguen
 * apuntándole) o eliminan (solo si nada las usa). Las del sistema se listan sin editar, porque el
 * dictado y los extractos las reconocen por su nombre.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaCategorias(vista: VistaInicio, acciones: AccionesCategorias, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ambito = rememberCoroutineScope()
    var creando by rememberSaveable { mutableStateOf(false) }
    var editando by rememberSaveable { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    fun guardado(bloque: suspend () -> Boolean, alExito: () -> Unit = {}) {
        ambito.launch { if (bloque()) { error = null; alExito() } else error = "No se pudo guardar. Inténtalo de nuevo." }
    }

    val usos = remember(vista.libro.transacciones) { vista.libro.transacciones.groupingBy { it.category }.eachCount() }
    val propias = remember(vista.libro.categorias) { vista.libro.categorias.sortedBy { it.nombre.lowercase() } }
    val basicas = remember(vista.catalogo) { vista.catalogo.todas.filter { !it.propia } }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Categorías", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
            if (!creando && editando == null) Row(
                Modifier.align(Alignment.End).clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.card)
                    .semantics { contentDescription = "Nueva categoría" }.pulsable(alPulsar = { creando = true }).padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Plus, tamano = 16.dp, grosor = 2.5f, color = c.ink)
                Text("Nueva", style = LukApp.tipo.de(15, 600, 1.3f), color = c.ink)
            }

            if (creando) Formulario(null, { d -> guardado({ acciones.crear(d.nombre, d.icon, d.emoji, d.color) }) { creando = false } }, { creando = false })

            if (propias.isEmpty() && !creando) Text(
                "Aún no tienes categorías propias. Crea una para clasificar mejor tus movimientos.",
                Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).padding(horizontal = 16.dp, vertical = 20.dp),
                style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft,
            )

            propias.forEach { cat ->
                val enUso = usos[cat.id] ?: 0
                val archivada = cat.archivedAt != null
                if (editando == cat.id) {
                    Formulario(cat, { d -> guardado({ acciones.actualizar(cat.copy(nombre = d.nombre, icon = d.icon, emoji = d.emoji, color = d.color)) }) { editando = null } }, { editando = null })
                } else Row(
                    Modifier.fillMaxWidth().alpha(if (archivada) 0.55f else 1f).clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(40.dp).clip(Medidas.formaCard).background(colorHex(cat.color).copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                        Emoji(cat.emoji?.takeIf { it.isNotEmpty() } ?: sugerirEmojiCategoria(cat.nombre), 20)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(cat.nombre, style = LukApp.tipo.cuerpoB, color = c.ink, maxLines = 1)
                        Text(
                            (if (archivada) "Archivada · " else "") + if (enUso == 0) "sin movimientos" else "$enUso movimiento${if (enUso == 1) "" else "s"}",
                            style = LukApp.tipo.xs, color = c.inkFaint,
                        )
                    }
                    if (archivada) Box(Modifier.size(36.dp).semantics { contentDescription = "Reactivar ${cat.nombre}" }.pulsable(alPulsar = { guardado({ acciones.actualizar(cat.copy(archivedAt = null)) }) }), contentAlignment = Alignment.Center) {
                        Icono(Lucide.RotateCcw, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                    } else Box(Modifier.size(36.dp).semantics { contentDescription = "Editar ${cat.nombre}" }.pulsable(alPulsar = { editando = cat.id }), contentAlignment = Alignment.Center) {
                        Icono(Lucide.Pencil, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                    }
                    Box(
                        Modifier.size(36.dp).semantics { contentDescription = if (enUso == 0) "Eliminar ${cat.nombre}" else "Archivar ${cat.nombre}" }
                            .pulsable(habilitado = !(archivada && enUso > 0), alPulsar = { guardado({ if (enUso == 0) acciones.borrar(cat.id) else acciones.archivar(cat) }) }),
                        contentAlignment = Alignment.Center,
                    ) { Icono(if (enUso == 0) Lucide.Trash2 else Lucide.X, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint.copy(alpha = if (archivada && enUso > 0) 0.3f else 1f)) }
                }
            }

            Text("Categorías principales del sistema", Modifier.padding(top = 12.dp, start = 4.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                basicas.forEach { cat ->
                    Row(
                        Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).background(c.card).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                    ) { Emoji(cat.emoji, 17); Text(cat.nombre, style = LukApp.tipo.de(15, 500, 1.3f), color = c.ink) }
                }
            }
            Row(Modifier.padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                Icono(Lucide.Lock, tamano = 14.dp, grosor = 2.5f, color = c.inkFaint)
                Text("Estas no se editan: el dictado por voz y las plantillas de extracto las reconocen automáticamente.", style = LukApp.tipo.xs, color = c.inkFaint)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Formulario(inicial: CategoriaPersonal?, alGuardar: (Datos) -> Unit, alCancelar: () -> Unit) {
    val c = LukApp.colores
    var nombre by rememberSaveable { mutableStateOf(inicial?.nombre ?: "") }
    var icon by rememberSaveable { mutableStateOf(inicial?.icon ?: "Package") }
    var emoji by rememberSaveable { mutableStateOf(inicial?.emoji ?: sugerirEmojiCategoria(inicial?.nombre ?: "")) }
    var color by rememberSaveable { mutableStateOf(inicial?.color ?: COLORES_CATEGORIA[0]) }
    // Mientras no toques ícono o emoji, siguen al nombre que escribes.
    var manual by rememberSaveable { mutableStateOf(inicial != null) }
    val listo = nombre.trim().isNotEmpty()

    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(Medidas.formaCard).background(colorHex(color).copy(alpha = 0.2f)), contentAlignment = Alignment.Center) { Emoji(emoji.ifEmpty { "🏷️" }, 28) }
            Column(Modifier.weight(1f)) {
                Text("Nombre", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                Box(Modifier.padding(top = 8.dp)) {
                    CampoTexto(nombre, {
                        nombre = it.take(28)
                        if (!manual) { icon = sugerirIconoCategoria(nombre); emoji = sugerirEmojiCategoria(nombre) }
                    }, "Ej: Mercado, Viajes, Almuerzo...", "Nombre de la categoría")
                }
            }
        }

        Text("Emoji", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        Box(Modifier.padding(top = 8.dp).heightIn(max = 176.dp).verticalScroll(rememberScrollState())) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EMOJIS_POPULARES_CATEGORIA.forEach { e ->
                    val activo = emoji == e
                    Box(
                        Modifier.size(44.dp).clip(Medidas.formaControl).border(1.dp, if (activo) c.ink else c.line, Medidas.formaControl).background(if (activo) c.soft else c.card)
                            .semantics { contentDescription = "Emoji $e" }.pulsable(escala = 1f, alPulsar = { manual = true; emoji = e }),
                        contentAlignment = Alignment.Center,
                    ) { Emoji(e, 20) }
                }
            }
        }
        Box(Modifier.padding(top = 10.dp)) {
            CampoTexto("", { v -> if (v.isNotBlank()) { manual = true; emoji = v.trim() } }, "O escribe tu propio emoji (ej: 🍕, 🚀, 🐱)", "Emoji personalizado")
        }

        Text("Ícono alternativo", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ICONOS_CATEGORIA.forEach { n ->
                val activo = icon == n
                Box(
                    Modifier.size(36.dp).clip(Medidas.formaControl).border(2.dp, if (activo) c.ink else c.line, Medidas.formaControl)
                        .semantics { contentDescription = "Ícono $n" }.pulsable(escala = 1f, alPulsar = { manual = true; icon = n }),
                    contentAlignment = Alignment.Center,
                ) { Icono(Lucide.porNombre[n] ?: Lucide.Package, tamano = 16.dp, color = if (activo) c.ink else c.inkFaint) }
            }
        }

        Text("Color", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
        FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            COLORES_CATEGORIA.forEach { col ->
                val activo = color.equals(col, ignoreCase = true)
                Box(
                    Modifier.size(36.dp).clip(Medidas.formaControl).border(2.dp, if (activo) c.ink else Color.Transparent, Medidas.formaControl).background(colorHex(col))
                        .semantics { contentDescription = "Color $col" }.pulsable(escala = 1f, alPulsar = { color = col }),
                    contentAlignment = Alignment.Center,
                ) { if (activo) Icono(Lucide.Check, tamano = 16.dp, grosor = 3f, color = Color.White) }
            }
        }

        Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent).pulsable(habilitado = listo, alPulsar = { alGuardar(Datos(nombre.trim(), icon, emoji, color)) }).padding(horizontal = 16.dp, vertical = 12.dp)
                    .semantics { contentDescription = if (inicial != null) "Guardar cambios" else "Crear categoría" },
                contentAlignment = Alignment.Center,
            ) { Text(if (inicial != null) "Guardar cambios" else "Crear categoría", style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent.copy(alpha = if (listo) 1f else 0.3f)) }
            Box(
                Modifier.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).pulsable(alPulsar = alCancelar).padding(horizontal = 16.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) { Text("Cancelar", style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft) }
        }
    }
}
