package app.lukapp.ui.mas

import androidx.compose.foundation.background
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
 * Pendiente (sin filas muertas): Registro automático, Tus datos y Comunidad (abren paneles sin migrar),
 * efectivo por separado (Dinero aún no lo desglosa), recordatorio de racha, volver a ver la guía y Premium.
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
                Fila("🔐", "Desbloquear con huella o rostro", if (biometriaDisponible) "Pide tu huella, rostro o PIN al abrir LukApp" else "Configura una huella, rostro o PIN en los ajustes del teléfono", linea = true,
                    habilitada = biometriaDisponible, alPulsar = { alCambiarDesbloqueo(!desbloqueoActivo) }) {
                    Switch(
                        checked = desbloqueoActivo, onCheckedChange = null, enabled = biometriaDisponible,
                        colors = SwitchDefaults.colors(checkedTrackColor = c.accent, checkedThumbColor = c.onAccent),
                    )
                }
                Fila("🌗", "Apariencia", null, linea = true, alPulsar = null) { SelectorTema(tema, alCambiarTema) }
                Fila("☁️", "Cuenta y Premium", correo, linea = true, alPulsar = null) {}
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
