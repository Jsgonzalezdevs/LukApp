package app.lukapp.ui.shell

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import app.lukapp.ui.guia.anclaGuia
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import app.lukapp.nativo.Haptico
import app.lukapp.nativo.rememberHapticos
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.mezclar

/** `SECTIONS` de src/features/lukapp/sections.ts, en el mismo orden. */
enum class Seccion(val etiqueta: String, val icono: IconoLucide?) {
    INICIO("Inicio", Lucide.Home),
    DINERO("Dinero", Lucide.Wallet),
    MES("Mes", Lucide.BarChart3),
    ASESOR("Asesor", Lucide.UserCircle),
    AJUSTES("Más", Lucide.Menu),
    /** Fuera de la barra; mientras está abierta se marca Mes (LukAppShell.tsx:138). */
    CALENDARIO("Calendario financiero", null),
}

/**
 * Barra inferior de LukAppShell.tsx:126-161 y lukapp.css:367-399: cápsula
 * flotante de 60dp de alto y hasta 320dp de ancho, fondo --fin-soft, sombra
 * `0 10px 28px rgb(0 0 0/.12)`, cinco botones de 48dp solo con ícono de 24dp.
 * Activa: trazo 2.5 en --fin-accent sobre `color-mix(accent 12%, soft)`.
 */
@Composable
fun BarraNavegacion(actual: Seccion, alElegir: (Seccion) -> Unit, modifier: Modifier = Modifier) {
    val c = LukApp.colores
    val hapticos = rememberHapticos()
    val marcada = if (actual == Seccion.CALENDARIO) Seccion.MES else actual
    Row(
        modifier
            .anclaGuia("nav")
            .widthIn(max = 320.dp)
            .shadow(28.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.12f), spotColor = Color.Black.copy(alpha = 0.12f))
            .clip(CircleShape)
            .background(c.soft)
            .height(60.dp)
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Seccion.entries.filter { it.icono != null }.forEach { seccion ->
            val activa = seccion == marcada
            val fondo by animateColorAsState(
                if (activa) mezclar(c.accent, 12f, c.soft) else Color.Transparent, tween(160), label = "fondoPestana",
            )
            Box(
                Modifier
                    .anclaGuia("nav-${seccion.name.lowercase()}")
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(fondo)
                    .semantics {
                        contentDescription = seccion.etiqueta
                        selected = activa
                        if (activa) stateDescription = "Sección actual"
                    }
                    .pulsable(rol = Role.Tab) {
                        hapticos.disparar(Haptico.SELECTION)
                        alElegir(seccion)
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icono(seccion.icono!!, tamano = 24.dp, grosor = if (activa) 2.5f else 2f, color = if (activa) c.accent else c.inkFaint)
            }
        }
    }
}
