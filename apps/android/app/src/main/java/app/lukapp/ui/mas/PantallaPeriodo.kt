package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ConfigPeriodo
import app.lukapp.dominio.FrecuenciaPeriodo
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.claveDePeriodo
import app.lukapp.dominio.diasDelPeriodo
import app.lukapp.dominio.diasTranscurridosEnPeriodo
import app.lukapp.dominio.etiquetaDePeriodo
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import java.time.Instant
import java.time.ZoneOffset

private data class Opcion(val id: String, val titulo: String, val nota: String, val icono: IconoLucide)

private val OPCIONES = listOf(
    Opcion(FrecuenciaPeriodo.SEMANAL, "Semanal", "Se renueva cada 7 días", Lucide.CalendarDays),
    Opcion(FrecuenciaPeriodo.QUINCENAL, "Cada 2 semanas", "Se renueva cada 14 días", Lucide.CalendarRange),
    Opcion(FrecuenciaPeriodo.QUINCENAS_MES, "Dos veces al mes", "Del 1 al 15 y del 16 al fin de mes", Lucide.Layers3),
    Opcion(FrecuenciaPeriodo.MENSUAL, "Mensual", "Sigue el mes calendario", Lucide.CalendarDays),
    Opcion(FrecuenciaPeriodo.PERSONALIZADO, "Personalizado", "Elige el inicio y la duración", Lucide.Sparkles),
    Opcion(FrecuenciaPeriodo.TODO_EL_TIEMPO, "Sin reinicio", "Un solo período continuo", Lucide.Clock3),
)

/**
 * PanelPeriodo.tsx: cada cuánto se reinicia lo que ves en Inicio, Mes, topes y Asesor. Cada cambio se
 * guarda en `finanzas:periodo` de `user_metadata`, el mismo sitio donde lo lee la web.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaPeriodo(periodo: ConfigPeriodo, alCambiar: (ConfigPeriodo) -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val hoy = remember { bogotaDate() }
    var conDesfase by rememberSaveable { mutableStateOf(periodo.desfaseDiasMensual > 0) }
    val guardada = periodo.diasPersonalizados ?: 14.0
    var duracion by remember(periodo.diasPersonalizados) { mutableFloatStateOf(guardada.toFloat()) }
    var eligiendoFecha by remember { mutableStateOf(false) }
    val dias = Math.round(duracion).toInt().coerceIn(1, 90)

    // Mientras se arrastra el deslizador la vista previa usa la duración nueva, sin guardar todavía.
    val vista = if (periodo.frecuencia == FrecuenciaPeriodo.PERSONALIZADO) periodo.copy(diasPersonalizados = dias.toDouble()) else periodo
    val claveActual = claveDePeriodo(hoy, vista)
    val etiquetaActual = etiquetaDePeriodo(claveActual, vista)

    fun elegir(f: String) {
        if (f == FrecuenciaPeriodo.PERSONALIZADO) {
            alCambiar(ConfigPeriodo(f, 0, periodo.diasPersonalizados ?: 14.0, periodo.fechaAnclaPersonalizada ?: hoy)); return
        }
        alCambiar(periodo.copy(frecuencia = f, desfaseDiasMensual = if (f == FrecuenciaPeriodo.MENSUAL) periodo.desfaseDiasMensual else 0))
        if (f != FrecuenciaPeriodo.MENSUAL) conDesfase = false
    }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.CalendarRange, tamano = 24.dp, grosor = 2f, color = c.inkSoft)
                Text("Período", style = LukApp.tipo.titulo, color = c.ink)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(40.dp).clip(Medidas.formaControl).background(c.card), contentAlignment = Alignment.Center) { Icono(Lucide.CalendarDays, tamano = 20.dp, color = c.accent) }
                Column {
                    Text("Elige cómo se agrupan tus finanzas en Inicio, Mes, topes y el Asesor.", style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft)
                    Text("Período actual: $etiquetaActual", Modifier.padding(top = 2.dp), style = LukApp.tipo.de(13, 600, 1.6f), color = c.ink)
                }
            }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Frecuencia", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                OPCIONES.forEach { op ->
                    val sel = periodo.frecuencia == op.id
                    Row(
                        Modifier.fillMaxWidth().clip(Medidas.formaControl).border(1.dp, if (sel) c.accent else c.line, Medidas.formaControl)
                            .background(if (sel) c.soft else c.bg).semantics { contentDescription = op.titulo }.pulsable(escala = 0.99f, alPulsar = { elegir(op.id) }).padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(40.dp).clip(Medidas.formaControl).background(if (sel) c.accent else c.card), contentAlignment = Alignment.Center) {
                            Icono(op.icono, tamano = 18.dp, grosor = 2.1f, color = if (sel) c.onAccent else c.inkSoft)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(op.titulo, style = LukApp.tipo.de(14, 600, 1.35f), color = c.ink)
                            Text(op.nota, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(12, 400, 1.5f), color = c.inkFaint)
                        }
                        Box(Modifier.size(20.dp).clip(CircleShape).border(1.dp, if (sel) c.accent else c.line, CircleShape).background(if (sel) c.accent else c.card), contentAlignment = Alignment.Center) {
                            if (sel) Icono(Lucide.Check, tamano = 12.dp, grosor = 3f, color = c.onAccent)
                        }
                    }
                }

                if (periodo.frecuencia == FrecuenciaPeriodo.MENSUAL) {
                    if (conDesfase || periodo.desfaseDiasMensual > 0) {
                        Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(16.dp)) {
                            Text("Día de inicio del mes", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.width(80.dp)) {
                                    var texto by remember(periodo.desfaseDiasMensual) { mutableStateOf((periodo.desfaseDiasMensual + 1).toString()) }
                                    app.lukapp.ui.calendario.CampoTexto(texto, {
                                        texto = it.filter(Char::isDigit).take(2)
                                        // Como la web: se acota a 1..28 y se guarda día-1; un campo vacío no cambia nada.
                                        texto.toIntOrNull()?.let { n -> alCambiar(ConfigPeriodo(FrecuenciaPeriodo.MENSUAL, (n - 1).coerceIn(0, 27))) }
                                    }, "", "Día de inicio del mes", numerico = true)
                                }
                                Text("Del día elegido al día anterior del mes siguiente.", Modifier.weight(1f), style = LukApp.tipo.de(12, 400, 1.5f), color = c.inkFaint)
                            }
                        }
                    } else {
                        Row(
                            Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape).pulsable(alPulsar = { conDesfase = true }).padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icono(Lucide.Plus, tamano = 14.dp, grosor = 2.5f, color = c.inkSoft)
                            Text("Ajustar día de inicio", style = LukApp.tipo.de(12, 600, 1.3f), color = c.inkSoft)
                        }
                    }
                }

                if (periodo.frecuencia == FrecuenciaPeriodo.PERSONALIZADO) {
                    val delCiclo = diasDelPeriodo(claveActual, vista)
                    val pasados = diasTranscurridosEnPeriodo(claveActual, hoy, vista)
                    val progreso = if (delCiclo != null && delCiclo > 0 && pasados != null) (pasados.toFloat() / delCiclo).coerceIn(0f, 1f) else 0f
                    val ancla = periodo.fechaAnclaPersonalizada ?: hoy
                    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(16.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                                Column(Modifier.weight(1f)) {
                                    Text("VISTA PREVIA DE TU CICLO", style = LukApp.tipo.de(10, 700, 1.3f, 0.12f), color = c.inkFaint)
                                    Text(etiquetaActual, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(19, 700, 1.3f), color = c.ink)
                                }
                                Text("${pasados ?: 0} de ${delCiclo ?: dias} días", Modifier.clip(CircleShape).background(c.card).padding(horizontal = 12.dp, vertical = 6.dp), style = LukApp.tipo.de(11, 600, 1.2f), color = c.accent)
                            }
                            Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(8.dp).clip(CircleShape).background(c.card)) {
                                Box(Modifier.fillMaxWidth(progreso).fillMaxHeight().clip(CircleShape).background(c.accent))
                            }
                            Row(Modifier.padding(top = 8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Inicio del ciclo", style = LukApp.tipo.de(10, 500, 1.3f), color = c.inkFaint)
                                Text(
                                    if (pasados == delCiclo) "Cierra hoy · mañana inicia otro" else "Quedan ${maxOf(0, (delCiclo ?: dias) - (pasados ?: 0))} días",
                                    style = LukApp.tipo.de(10, 500, 1.3f), color = c.inkFaint,
                                )
                            }
                        }
                        Column {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Duración del ciclo", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                                Text("$dias días", Modifier.clip(CircleShape).background(c.card).padding(horizontal = 12.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 700, 1.3f), color = c.accent)
                            }
                            Slider(
                                value = duracion, onValueChange = { duracion = it }, valueRange = 1f..90f,
                                // Se guarda al soltar, como el onPointerUp de la web.
                                onValueChangeFinished = {
                                    if (dias.toDouble() != periodo.diasPersonalizados) alCambiar(periodo.copy(desfaseDiasMensual = 0, diasPersonalizados = dias.toDouble(), fechaAnclaPersonalizada = periodo.fechaAnclaPersonalizada ?: hoy))
                                },
                                colors = SliderDefaults.colors(thumbColor = c.accent, activeTrackColor = c.accent, inactiveTrackColor = c.card),
                                modifier = Modifier.semantics { contentDescription = "Duración del ciclo en días" },
                            )
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                listOf("1 día", "45 días", "90 días").forEach { Text(it, style = LukApp.tipo.de(10, 400, 1.3f), color = c.inkFaint) }
                            }
                        }
                        Column {
                            Text("El ciclo empieza desde", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                            Text(
                                ancla, Modifier.padding(top = 8.dp).fillMaxWidth().semantics { contentDescription = "Fecha de inicio del primer ciclo" }
                                    .clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.card).pulsable(escala = 1f, alPulsar = { eligiendoFecha = true }).padding(horizontal = 16.dp, vertical = 12.dp),
                                style = LukApp.tipo.de(15, 500, 1.3f), color = c.ink,
                            )
                            Text("A partir de esta fecha, LukApp repetirá el ciclo con la duración que elegiste.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(11, 400, 1.5f), color = c.inkFaint)
                        }
                    }
                }
            }

            Row(Modifier.padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                Icono(Lucide.Sparkles, tamano = 14.dp, color = c.accent)
                Text("El 4x1000, los pagos recurrentes y el resumen tipo Wrapped siguen el mes calendario real.", style = LukApp.tipo.de(12, 400, 1.5f), color = c.inkFaint)
            }
        }
    }

    if (eligiendoFecha) {
        val estado = rememberDatePickerState(initialSelectedDateMillis = (periodo.fechaAnclaPersonalizada ?: hoy).let { java.time.LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() })
        DatePickerDialog(
            onDismissRequest = { eligiendoFecha = false },
            confirmButton = {
                TextButton(onClick = {
                    eligiendoFecha = false
                    val ms = estado.selectedDateMillis ?: return@TextButton
                    // `max={hoy}` de la web: no se puede empezar un ciclo en el futuro.
                    val fecha = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate().toString().let { if (it > hoy) hoy else it }
                    alCambiar(periodo.copy(frecuencia = FrecuenciaPeriodo.PERSONALIZADO, desfaseDiasMensual = 0, diasPersonalizados = periodo.diasPersonalizados ?: 14.0, fechaAnclaPersonalizada = fecha))
                }) { Text("Listo") }
            },
            dismissButton = { TextButton(onClick = { eligiendoFecha = false }) { Text("Cancelar") } },
        ) { DatePicker(state = estado) }
    }
}
