package app.lukapp.ui.mas

import androidx.compose.foundation.background
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.ui.acceso.SelectorTema
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.PreferenciaTema

/**
 * AjustesView.tsx. Solo están las filas que funcionan de verdad: Período, Próximos pagos, Contar los ahorros,
 * decisiones financieras, Apariencia, la cuenta y cerrar sesión; más el desbloqueo biométrico, propio de Android.
 * Pendiente (sin filas muertas): Registro automático (Apple Pay no existe en Android),
 * efectivo por separado (Dinero aún no lo desglosa) y los botones de compra de Premium.
 */
@Composable
fun PantallaMas(
    contarAhorros: Boolean,
    alContarAhorros: (Boolean) -> Unit,
    proximosPagos: Boolean,
    alProximosPagos: (Boolean) -> Unit,
    decisiones: Boolean,
    alDecisiones: (Boolean) -> Unit,
    alAbrirPeriodo: () -> Unit,
    alAbrirCategorias: () -> Unit,
    alAbrirRevisiones: () -> Unit,
    alAbrirNombres: () -> Unit,
    alAbrirRespaldo: () -> Unit,
    alAbrirFunciones: () -> Unit,
    alAbrirCuenta: () -> Unit,
    alVolverAVerGuia: () -> Unit,
    recordatorioActivo: Boolean,
    recordatorioHora: String,
    alRecordatorio: (Boolean) -> Unit,
    alHoraRecordatorio: (String) -> Unit,
    tema: PreferenciaTema,
    alCambiarTema: (PreferenciaTema) -> Unit,
    desbloqueoActivo: Boolean,
    biometriaDisponible: Boolean,
    alCambiarDesbloqueo: (Boolean) -> Unit,
    correo: String?,
    alCerrarSesion: () -> Unit,
) {
    val c = LukApp.colores
    Column(Modifier.fillMaxWidth().padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
        Text("Ajustes", Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.tituloXl, color = c.ink)
        Column {
            Text("Preferencias", Modifier.padding(horizontal = 4.dp).padding(bottom = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card)) {
                Fila("🏷️", "Categorías", "Crea las tuyas o cambia las que hay", linea = true, alPulsar = alAbrirCategorias) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
                Fila("🗓️", "Período", "Cada cuánto se reinicia lo que ves", linea = false, alPulsar = alAbrirPeriodo) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
            }
        }
        Column {
            Text("Tus datos", Modifier.padding(horizontal = 4.dp).padding(bottom = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card)) {
                Fila("🧭", "Revisar movimientos", "Confirma avisos y conserva el motivo de cada decisión", linea = true, alPulsar = alAbrirRevisiones) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
                Fila("👥", "Nombres repetidos", "Une a la misma persona escrita de dos formas", linea = true, alPulsar = alAbrirNombres) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
                Fila("💾", "Copia de seguridad", "Descarga todo, o vuelve a un respaldo", linea = false, alPulsar = alAbrirRespaldo) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
            }
        }
        Column {
            Text("Comunidad", Modifier.padding(horizontal = 4.dp).padding(bottom = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card)) {
                Fila("🔧", "Funciones solicitadas", "Propón una idea y vota las de los demás", linea = false, alPulsar = alAbrirFunciones) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
            }
        }
        Column {
            Text("La app", Modifier.padding(horizontal = 4.dp).padding(bottom = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint)
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card)) {
                Fila("📅", "Próximos pagos en Inicio", "Mostrar u ocultar esta sección", linea = true, alPulsar = { alProximosPagos(!proximosPagos) }) {
                    Checkbox(
                        checked = proximosPagos, onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint),
                    )
                }
                Fila("🐷", "Contar los ahorros", "Suma lo que tienes guardado al total de arriba", linea = true, alPulsar = { alContarAhorros(!contarAhorros) }) {
                    Checkbox(
                        checked = contarAhorros, onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint),
                    )
                }
                Fila("📈", "Mostrar decisiones financieras", "Ver cuánto puedes gastar y simular compras", linea = true, alPulsar = { alDecisiones(!decisiones) }) {
                    Checkbox(
                        checked = decisiones, onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint),
                    )
                }
                FilaRecordatorio(recordatorioActivo, recordatorioHora, alRecordatorio, alHoraRecordatorio)
                Fila("✈️", "Volver a ver la guía", "Te vuelve a señalar cómo funciona la app", linea = true, alPulsar = alVolverAVerGuia) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
                Fila("🔐", "Desbloquear con huella o rostro", if (biometriaDisponible) "Pide tu huella, rostro o PIN al abrir LukApp" else "Configura una huella, rostro o PIN en los ajustes del teléfono", linea = true,
                    habilitada = biometriaDisponible, alPulsar = { alCambiarDesbloqueo(!desbloqueoActivo) }) {
                    Switch(
                        checked = desbloqueoActivo, onCheckedChange = null, enabled = biometriaDisponible,
                        colors = SwitchDefaults.colors(checkedTrackColor = c.accent, checkedThumbColor = c.onAccent),
                    )
                }
                Fila("🌗", "Apariencia", null, linea = true, alPulsar = null) { SelectorTema(tema, alCambiarTema) }
                Fila("☁️", "Cuenta y Premium", correo, linea = true, alPulsar = alAbrirCuenta) {
                    Icono(Lucide.ChevronRight, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                }
                Fila("👋", "Cerrar sesión", null, linea = false, colorTitulo = c.salio, alPulsar = alCerrarSesion) {}
            }
        }
    }
}

/** Una fila de Más: círculo de 40dp con emoji, título 17/600, ayuda 15, y el control a la derecha. */
@Composable
private fun Fila(
    emoji: String,
    titulo: String,
    ayuda: String?,
    linea: Boolean,
    habilitada: Boolean = true,
    colorTitulo: androidx.compose.ui.graphics.Color = LukApp.colores.ink,
    alPulsar: (() -> Unit)?,
    control: @Composable () -> Unit,
) {
    val c = LukApp.colores
    Column {
        Row(
            Modifier.fillMaxWidth().then(if (alPulsar != null) Modifier.pulsable(habilitado = habilitada, escala = 0.99f, alPulsar = alPulsar) else Modifier).padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(c.soft), contentAlignment = Alignment.Center) { Emoji(emoji, 20) }
            Column(Modifier.weight(1f)) {
                Text(titulo, style = LukApp.tipo.cuerpoB, color = colorTitulo)
                if (ayuda != null) Text(ayuda, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.35f), color = c.inkSoft, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            control()
        }
        // `inset 0 -1px 0 0 var(--fin-line)`.
        if (linea) Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
    }
}

/**
 * AjustesView.tsx, «Recordatorio diario de racha»: aviso si aún no has anotado gastos hoy, a la hora elegida. Se
 * enciende solo con permiso de notificaciones (Android 13+ lo pide aquí, nunca al abrir la app).
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun FilaRecordatorio(activo: Boolean, hora: String, alCambiar: (Boolean) -> Unit, alHora: (String) -> Unit) {
    val c = LukApp.colores
    val contexto = androidx.compose.ui.platform.LocalContext.current
    var sinPermiso by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var eligiendo by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val pedir = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { concedido ->
        sinPermiso = !concedido
        if (concedido) alCambiar(true)
    }
    Fila(
        "🔔", "Recordatorio diario de racha",
        if (sinPermiso) "Activa las notificaciones de LukApp en los ajustes del teléfono para recibir el aviso" else "Notificación si aún no has anotado gastos hoy",
        linea = true,
        alPulsar = {
            if (activo) alCambiar(false)
            else if (app.lukapp.nativo.RecordatorioRacha.hayPermiso(contexto)) { sinPermiso = false; alCambiar(true) }
            else pedir.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        },
    ) {
        Checkbox(checked = activo, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = c.warn, checkmarkColor = c.onAccent, uncheckedColor = c.inkFaint))
    }
    if (activo) {
        val (h, m) = app.lukapp.dominio.horaDeRecordatorio(hora)
        Row(Modifier.fillMaxWidth().padding(start = 68.dp, end = 16.dp, bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Hora de aviso:", style = LukApp.tipo.de(13, 500, 1.3f), color = c.inkSoft)
            Text(
                "%02d:%02d".format(h, m),
                Modifier.clip(Medidas.formaControl).background(c.bg).border(1.dp, c.line, Medidas.formaControl).semantics { contentDescription = "Hora de aviso" }.pulsable(escala = 1f, alPulsar = { eligiendo = true }).padding(horizontal = 12.dp, vertical = 4.dp),
                style = LukApp.tipo.de(17, 700, 1.3f).copy(fontFeatureSettings = "tnum"), color = c.ink,
            )
        }
        if (eligiendo) {
            val estado = androidx.compose.material3.rememberTimePickerState(initialHour = h, initialMinute = m, is24Hour = false)
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { eligiendo = false },
                confirmButton = { androidx.compose.material3.TextButton(onClick = { eligiendo = false; alHora("%02d:%02d".format(estado.hour, estado.minute)) }) { Text("Listo") } },
                dismissButton = { androidx.compose.material3.TextButton(onClick = { eligiendo = false }) { Text("Cancelar") } },
                text = { androidx.compose.material3.TimePicker(state = estado) },
            )
        }
    }
}
