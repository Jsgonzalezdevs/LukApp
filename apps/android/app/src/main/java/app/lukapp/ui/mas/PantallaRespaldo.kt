package app.lukapp.ui.mas

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Libro
import app.lukapp.dominio.aCsv
import app.lukapp.dominio.armarRespaldoJson
import app.lukapp.dominio.generarExcelFinanciero
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.nombreArchivoExcel
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.leerRespaldo
import app.lukapp.dominio.nombreDeArchivoRespaldo
import app.lukapp.dominio.pesoAproximado
import app.lukapp.dominio.resumirRespaldo
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant

/**
 * PanelRespaldo.tsx: sacar los datos y volverlos a meter. Restaurar REEMPLAZA todo, así que antes de tocar nada
 * dice qué trae el archivo y pide una confirmación aparte. También saca el informe del mes (PDF) y todo en Excel (.xls).
 */
@Composable
fun PantallaRespaldo(libro: Libro, hoy: String, alRestaurar: suspend (Libro) -> Boolean, alGenerarInforme: () -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val contexto = LocalContext.current
    val ambito = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    var aviso by remember { mutableStateOf<String?>(null) }
    var restaurando by remember { mutableStateOf(false) }
    var porRestaurar by remember { mutableStateOf<Pair<Libro, String>?>(null) }

    val json = remember(libro) { armarRespaldoJson(libro, Instant.now().toString()) }
    fun nombreDeCuenta(id: String?) = if (id == null) "" else libro.cajitas.firstOrNull { it.id == id }?.nombre ?: ""

    fun escribir(uri: Uri?, texto: String) {
        if (uri == null) return
        ambito.launch {
            val ok = withContext(Dispatchers.IO) { runCatching { contexto.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(texto.toByteArray(Charsets.UTF_8)) } }.isSuccess }
            if (ok) { error = null; aviso = "Archivo guardado." } else { aviso = null; error = "No se pudo guardar el archivo." }
        }
    }
    val guardarRespaldo = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { escribir(it, json) }
    val guardarCsv = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { escribir(it, aCsv(libro, ::nombreDeCuenta)) }
    val guardarExcel = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/vnd.ms-excel")) {
        escribir(it, generarExcelFinanciero(libro.transacciones, libro.cajitas, saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))))
    }
    val elegir = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        error = null; aviso = null; porRestaurar = null
        ambito.launch {
            val texto = withContext(Dispatchers.IO) { runCatching { contexto.contentResolver.openInputStream(uri)!!.bufferedReader(Charsets.UTF_8).use { it.readText() } }.getOrNull() }
            if (texto == null) { error = "No se pudo leer el archivo."; return@launch }
            val r = leerRespaldo(texto)
            if (!r.ok || r.libro == null) error = r.error else porRestaurar = r.libro to (r.resumen ?: "")
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.HardDriveDownload, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                Text("Copia de seguridad", style = LukApp.tipo.titulo, color = c.ink)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column {
                Text("Tus datos", Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                Text("${resumirRespaldo(libro)} · ${pesoAproximado(json)}", Modifier.padding(horizontal = 4.dp, vertical = 4.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            }
            aviso?.let { Text(it, style = LukApp.tipo.xs, color = c.entro) }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Boton("Generar informe / PDF", Lucide.FileText, alPulsar = alGenerarInforme)
                Nota("Un reporte del mes, listo para guardar como PDF.")
                Boton("Descargar respaldo completo", Lucide.Download, relleno = true) { guardarRespaldo.launch(nombreDeArchivoRespaldo(hoy)) }
                Nota("Un archivo con todo, que esta misma app puede volver a leer. Guárdalo donde no dependa de esta cuenta.")
                Boton("Exportar a Excel (.xls)", Lucide.Download) { guardarExcel.launch(nombreArchivoExcel()) }
                Nota("Incluye hojas separadas de movimientos formateados y saldos de cuentas para Excel y Google Sheets.")
                Boton("Movimientos en CSV", Lucide.Download) { guardarCsv.launch("movimientos-$hoy.csv") }
                Nota("Para abrirlos en cualquier hoja de cálculo o importar en otro software contable.")
            }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                Boton("Restaurar desde un respaldo", Lucide.Upload, borde = true) { elegir.launch(arrayOf("application/json", "*/*")) }
                error?.let {
                    Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.salioBg).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                        Icono(Lucide.AlertTriangle, tamano = 14.dp, grosor = 3f, color = c.salioInk)
                        Text(it, style = LukApp.tipo.de(13, 400, 1.6f), color = c.salioInk)
                    }
                }
                // Qué trae, ANTES de reemplazar nada: descubrirlo después sería tarde.
                porRestaurar?.let { (nuevo, resumen) ->
                    Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.warnBg).padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text("Ese archivo trae $resumen.", style = LukApp.tipo.de(13, 600, 1.4f), color = c.warnInk)
                        Text(
                            "Restaurar REEMPLAZA todo lo que tienes ahora (${resumirRespaldo(libro)}). Esto no se puede deshacer — descarga un respaldo de lo actual si tienes dudas.",
                            Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.warnInk,
                        )
                        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                Modifier.weight(1f).clip(CircleShape).background(c.salio).semantics { contentDescription = "Sí, reemplazar todo" }.pulsable(habilitado = !restaurando, alPulsar = {
                                    restaurando = true
                                    ambito.launch {
                                        val ok = runCatching { alRestaurar(nuevo) }.getOrDefault(false)
                                        restaurando = false
                                        if (ok) { porRestaurar = null; aviso = "Respaldo restaurado." } else error = "No se pudo restaurar. Conservamos el archivo seleccionado para que puedas intentarlo de nuevo."
                                    }
                                }).padding(horizontal = 16.dp, vertical = 12.dp),
                                contentAlignment = Alignment.Center,
                            ) { Text(if (restaurando) "Restaurando…" else "Sí, reemplazar todo", style = LukApp.tipo.de(15, 600, 1.3f), color = c.onOut) }
                            Box(
                                Modifier.clip(CircleShape).background(c.card).pulsable(habilitado = !restaurando, alPulsar = { porRestaurar = null }).padding(horizontal = 16.dp, vertical = 12.dp),
                                contentAlignment = Alignment.Center,
                            ) { Text("Cancelar", style = LukApp.tipo.de(15, 600, 1.3f), color = c.inkSoft) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Nota(texto: String) = Text(texto, style = LukApp.tipo.de(13, 400, 1.6f), color = LukApp.colores.inkFaint)

@Composable
private fun Boton(texto: String, icono: IconoLucide, relleno: Boolean = false, borde: Boolean = false, alPulsar: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaControl).then(if (borde) Modifier.border(1.dp, c.line, Medidas.formaControl) else Modifier)
            .background(if (relleno) c.accent else if (borde) androidx.compose.ui.graphics.Color.Transparent else c.soft)
            .semantics { contentDescription = texto }.pulsable(alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
    ) {
        Icono(icono, tamano = 16.dp, grosor = if (relleno) 3f else 2.5f, color = if (relleno) c.onAccent else c.ink)
        Text(texto, style = LukApp.tipo.de(17, 600, 1.3f), color = if (relleno) c.onAccent else c.ink)
    }
}
