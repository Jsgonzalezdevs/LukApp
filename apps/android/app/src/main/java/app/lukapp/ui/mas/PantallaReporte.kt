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
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ReporteMensual
import app.lukapp.dominio.fechaDelInforme
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.generarExcelFinanciero
import app.lukapp.dominio.nombreArchivoExcel
import app.lukapp.dominio.nombreArchivoInforme
import app.lukapp.dominio.reporteMensual
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.idsPasivos
import app.lukapp.nativo.InformePdf
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Escribe `bytes` en el documento que la persona eligió (el selector de archivos del sistema; sin permisos de almacenamiento). */
internal suspend fun guardarBytes(contexto: android.content.Context, uri: Uri, bytes: ByteArray): Boolean =
    withContext(Dispatchers.IO) { runCatching { contexto.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) } }.isSuccess }

/**
 * ReporteFinancieroModal.tsx: «Así cerraste noviembre de 2026.» con balance, ingresos, gastos, en qué se fue y tu dinero hoy.
 * La web lo manda a imprimir; aquí «Guardar PDF» dibuja el informe y lo guarda donde elijas, y «Excel» exporta el mes.
 * Nada sale del teléfono.
 */
@Composable
fun PantallaReporte(vista: VistaInicio, mes: String, correo: String?, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val contexto = LocalContext.current
    val ambito = rememberCoroutineScope()
    val libro = vista.libro
    val saldos = remember(libro) { saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas)) }
    // Una categoría que el catálogo no conoce se muestra con su propio nombre («hogar» → «Hogar») y un color neutro, como la web;
    // `catalogo.de` la llamaría «Otros» y dos categorías distintas se confundirían.
    val conocidas = remember(vista.catalogo) { vista.catalogo.todas.map { it.clave }.toSet() }
    val r = remember(libro, mes, conocidas) {
        reporteMensual(
            libro.transacciones, libro.cajitas, saldos, mes,
            { if (it in conocidas) vista.catalogo.de(it).nombre else it.replace(Regex("[-_]"), " ").replaceFirstChar { c -> c.uppercase() } },
            { if (it in conocidas) vista.catalogo.de(it).color else "#A78BFA" },
        )
    }
    var aviso by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    fun resultado(ok: Boolean) { if (ok) { error = null; aviso = "Archivo guardado." } else { aviso = null; error = "No se pudo guardar el archivo." } }
    val guardarPdf = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        if (uri != null) ambito.launch { resultado(guardarBytes(contexto, uri, withContext(Dispatchers.Default) { InformePdf.generar(r, vista.hoy, correo) })) }
    }
    val guardarExcel = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/vnd.ms-excel")) { uri ->
        if (uri != null) ambito.launch { resultado(guardarBytes(contexto, uri, withContext(Dispatchers.Default) { generarExcelFinanciero(libro.transacciones, libro.cajitas, saldos, mes).toByteArray(Charsets.UTF_8) })) }
    }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Reporte mensual", style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink)
                Text(r.nombreMes, style = LukApp.tipo.xs, color = c.inkSoft)
            }
            Text("Excel", Modifier.clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Exportar a Excel" }.pulsable(alPulsar = { guardarExcel.launch(nombreArchivoExcel(mes)) }).padding(horizontal = 12.dp, vertical = 10.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
            Text("PDF", Modifier.clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Guardar PDF" }.pulsable(alPulsar = { guardarPdf.launch(nombreArchivoInforme(mes)) }).padding(horizontal = 16.dp, vertical = 10.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar reporte" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) { Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft) }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            aviso?.let { Text(it, style = LukApp.tipo.xs, color = c.entro) }
            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(Color(0xFF18181B)).padding(24.dp)) {
                Text("TU MES EN PERSPECTIVA", style = LukApp.tipo.de(13, 600, 1.4f), color = Color(0xFFDDD6FE))
                Text("Así cerraste ${r.nombreMes.lowercase()}.", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(28, 600, 1.15f), color = Color.White)
                Text(r.resumenBalance, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 400, 1.5f), color = Color.White.copy(alpha = 0.7f))
                Column(Modifier.padding(top = 16.dp).clip(Medidas.formaCard).border(1.dp, Color.White.copy(alpha = 0.15f), Medidas.formaCard).background(Color.White.copy(alpha = 0.1f)).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text("MOVIMIENTOS", style = LukApp.tipo.de(12, 600, 1.4f), color = Color.White.copy(alpha = 0.55f))
                    Text("${r.movimientos}", style = LukApp.tipo.de(20, 600, 1.3f), color = Color.White)
                }
            }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(20.dp)) {
                Text("Balance del mes", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                Text(formatCop(r.balance), Modifier.padding(top = 12.dp), style = LukApp.tipo.de(28, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (r.balancePositivo) c.entro else c.salio)
                Text(if (r.porcentajeBalance == null) "Aún no hay ingresos este mes" else "${if (r.porcentajeBalance >= 0) "+" else ""}${r.porcentajeBalance}% frente a tus ingresos", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Cifra("Ingresos", formatCop(r.ingresos), Modifier.weight(1f))
                Cifra("Gastos", formatCop(r.gastos), Modifier.weight(1f))
            }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(20.dp)) {
                Text("En qué se fue tu dinero", style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink)
                Text("Tus gastos ordenados de mayor a menor.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                if (r.categorias.isEmpty()) Text("No registraste gastos durante este mes.", Modifier.padding(top = 16.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(16.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
                r.categorias.forEach { f ->
                    Column(Modifier.padding(top = 16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(f.nombre, Modifier.weight(1f), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink, maxLines = 1)
                            Text("${formatCop(f.total)} ${f.pct}%", style = LukApp.tipo.de(13, 400, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft)
                        }
                        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(8.dp).clip(CircleShape).background(c.soft)) {
                            Box(Modifier.fillMaxWidth((f.pct / 100f).coerceIn(0.03f, 1f)).height(8.dp).clip(CircleShape).background(runCatching { Color(android.graphics.Color.parseColor(f.color)) }.getOrDefault(c.inkSoft)))
                        }
                    }
                }
            }
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(20.dp)) {
                Text("Tu dinero hoy", style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink)
                Text("El saldo actual de tus cuentas activas.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                Column(Modifier.padding(top = 16.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text("PATRIMONIO EN CUENTAS", style = LukApp.tipo.de(12, 600, 1.4f), color = c.inkFaint)
                    Text(formatCop(r.patrimonio), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(20, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                }
                if (r.cuentas.isEmpty()) Text("No hay cuentas activas para mostrar.", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                r.cuentas.forEach { f ->
                    Row(Modifier.padding(top = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(f.nombre, Modifier.weight(1f), style = LukApp.tipo.de(13, 500, 1.4f), color = c.ink, maxLines = 1)
                        Text(formatCop(f.saldo), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (f.esPasivo) c.salio else c.ink)
                    }
                }
            }
            Text("Preparado el ${fechaDelInforme(vista.hoy)} · ${if (correo != null) "Resumen privado de $correo" else "Resumen privado de tu libro financiero"} · LukApp", style = LukApp.tipo.de(12, 400, 1.5f), color = c.inkFaint)
        }
    }
}

@Composable
private fun Cifra(titulo: String, valor: String, m: Modifier) {
    val c = LukApp.colores
    Column(m.clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp)) {
        Text(titulo, style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
        Text(valor, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(17, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink, maxLines = 1)
    }
}
