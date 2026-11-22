package app.lukapp.ui.inicio

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ClaseCuenta
import app.lukapp.dominio.FUENTES_DINERO
import app.lukapp.dominio.agregarDigitos
import app.lukapp.dominio.eleccionDeFuente
import app.lukapp.dominio.formatAmountInput
import app.lukapp.ui.anotar.TecladoNumerico
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/**
 * Onboarding.tsx: la bienvenida, cuatro pantallas con UNA pregunta cada una (nombre, dónde tienes la plata, cuánto
 * tienes, resumen). Sin la animación de tecleo del título. Se decide con una bandera guardada de verdad: no vuelve a
 * salir el día que alguien borre su único movimiento.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaBienvenida(alTerminar: suspend (nombre: String, banco: String?, clase: String?, saldo: Long?) -> Boolean) {
    val c = LukApp.colores
    // Sin salida con «atrás»: la bienvenida se cierra solo terminándola o saltándola.
    BackHandler {}
    val ambito = rememberCoroutineScope()
    var paso by rememberSaveable { mutableStateOf(0) }
    var nombre by rememberSaveable { mutableStateOf("") }
    var fuenteNombre by rememberSaveable { mutableStateOf<String?>(null) }
    var otroBanco by rememberSaveable { mutableStateOf("") }
    var digitos by rememberSaveable { mutableStateOf("") }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val fuente = FUENTES_DINERO.firstOrNull { it.nombre == fuenteNombre }
    val eleccion = eleccionDeFuente(fuente, otroBanco)
    val banco = eleccion.banco
    val saldo = if (digitos.isEmpty()) null else digitos.toLongOrNull()
    val n = nombre.trim()

    val titulo = when (paso) { 0 -> "¿Cómo te llamas?"; 1 -> "¿Dónde tienes tu plata?"; 2 -> if (banco != null) "¿Cuánto tienes en $banco?" else "¿Cuánto tienes?"; else -> if (n.isNotEmpty()) "Listo, $n." else "Todo listo." }
    val ayuda = when (paso) {
        0 -> "Solo para saludarte al abrir. Se queda en tu cuenta."
        1 -> "Escoge una para empezar. Después agregas las que quieras."
        2 -> if (banco != null) "El saldo actual que ves en tu banco. Escribe 0 si está vacía o déjalo pendiente si no lo sabes." else "No elegiste un banco. Podrás confirmar el saldo de Efectivo desde el inicio."
        else -> "Revisa lo que se guardará. Puedes volver a corregir el saldo antes de terminar."
    }
    val boton = if (paso == 3) "Entrar a LukApp" else "Continuar"
    val salida = when (paso) { 0 -> "Prefiero no decirlo"; 1 -> "Ninguna por ahora"; 2 -> "Empezar en \$0"; else -> "Volver" }
    val ultimo = paso == 3
    val continuarDeshabilitado = paso == 1 && fuente?.nombre == "Otro" && (otroBanco.trim().isEmpty() || eleccion.otroEsEfectivo)

    fun terminar() {
        guardando = true; error = null
        ambito.launch {
            val ok = runCatching { alTerminar(n, banco, eleccion.claseCuenta, if (banco != null) saldo else null) }.getOrDefault(false)
            if (!ok) { error = "No se pudo guardar. Tus datos siguen aquí para que puedas intentarlo de nuevo."; guardando = false }
        }
    }

    Box(Modifier.fillMaxSize().background(c.scrim).statusBarsPadding().navigationBarsPadding(), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().clip(Medidas.formaHoja).background(c.card).verticalScroll(rememberScrollState()).padding(24.dp)
                .semantics { contentDescription = "Bienvenida" },
        ) {
            Row(Modifier.semantics { contentDescription = "Paso ${paso + 1} de 4" }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (0..3).forEach { i -> Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (i <= paso) c.ink else c.line)) }
            }
            Text(titulo, Modifier.padding(top = 24.dp), style = LukApp.tipo.tituloXl, color = c.ink)
            Text(ayuda, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 400, 1.6f), color = c.inkSoft)

            Column(Modifier.padding(top = 20.dp)) {
                when (paso) {
                    0 -> CampoTexto(nombre, { nombre = it }, "Tu nombre", "Tu nombre")
                    1 -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FUENTES_DINERO.forEach { op ->
                                val sel = fuenteNombre == op.nombre
                                Text(
                                    op.nombre, Modifier.clip(CircleShape).background(if (sel) c.accent else c.soft).semantics { contentDescription = op.nombre; selected = sel }
                                        .pulsable(escala = 0.97f, alPulsar = { fuenteNombre = op.nombre }).padding(horizontal = 16.dp, vertical = 12.dp),
                                    style = LukApp.tipo.de(15, 600, 1.3f), color = if (sel) c.onAccent else c.inkSoft,
                                )
                            }
                        }
                        if (fuente?.nombre == "Otro") CampoTexto(otroBanco, { otroBanco = it }, "Ej: Banco de Bogotá", "Nombre del banco")
                        if (eleccion.otroEsEfectivo) Text("Efectivo ya viene incluido. Aquí elige un banco o una billetera.", style = LukApp.tipo.de(13, 400, 1.6f), color = c.salio)
                    }
                    2 -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            if (digitos.isEmpty()) "\$0" else "\$${formatAmountInput(saldo)}",
                            style = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (digitos.isEmpty()) c.inkGhost else c.ink,
                        )
                        TecladoNumerico({ digitos = agregarDigitos(digitos, it) }, { digitos = digitos.dropLast(1) }, alto = 56.dp)
                    }
                    else -> Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(16.dp)) {
                        if (banco != null && eleccion.claseCuenta != null) {
                            Text("Crearás 1 cuenta", style = LukApp.tipo.xs, color = c.inkFaint)
                            Text("$banco · ${ClaseCuenta.ETIQUETAS[eleccion.claseCuenta]}", Modifier.padding(top = 4.dp), style = LukApp.tipo.cuerpoB, color = c.ink)
                            Text(
                                if (saldo == null) "Saldo inicial: \$0 (lo ajustas cuando quieras)" else "Saldo inicial: \$${formatAmountInput(saldo)}",
                                Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft,
                            )
                            Text("Editar saldo inicial", Modifier.padding(top = 12.dp).pulsable(escala = 1f, alPulsar = { paso = 2 }), style = LukApp.tipo.de(15, 600, 1.3f), color = c.accent)
                        } else {
                            Text("No crearás cuentas todavía", style = LukApp.tipo.cuerpoB, color = c.ink)
                            Text("Efectivo ya está disponible, con saldo pendiente de confirmar. Puedes agregar un banco o una billetera desde Dinero.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft)
                        }
                    }
                }
            }
            error?.let { Text(it, Modifier.padding(top = 12.dp), style = LukApp.tipo.de(14, 400, 1.4f), color = c.salio) }

            Row(
                Modifier.padding(top = 24.dp).fillMaxWidth().alpha(if (guardando || continuarDeshabilitado) 0.45f else 1f).clip(Medidas.formaControl).background(c.accent)
                    .semantics { contentDescription = boton }.pulsable(habilitado = !guardando && !continuarDeshabilitado, alPulsar = {
                        if (!ultimo) { paso = if (paso == 1 && banco == null) 3 else paso + 1 } else terminar()
                    }).padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Check, tamano = 20.dp, grosor = 2.5f, color = c.onAccent)
                Text(if (guardando) "Guardando…" else boton, style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent)
                if (!ultimo) Icono(Lucide.ArrowRight, tamano = 16.dp, grosor = 2.5f, color = c.onAccent.copy(alpha = 0.6f))
            }
            Text(
                salida, Modifier.padding(top = 4.dp).fillMaxWidth().semantics { contentDescription = salida }.pulsable(habilitado = !guardando, escala = 1f, alPulsar = {
                    if (ultimo) paso = maxOf(0, paso - 1) else {
                        // Saltarse el paso de banco es no elegir ninguna: sigue directo al resumen.
                        if (paso == 1) { fuenteNombre = null; otroBanco = ""; digitos = ""; paso = 3 }
                        else { if (paso == 2) digitos = ""; paso += 1 }
                    }
                }).padding(vertical = 12.dp),
                style = LukApp.tipo.de(15, 400, 1.3f), color = c.inkFaint, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}
