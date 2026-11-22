package app.lukapp.ui.mas

import android.content.ClipData
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import app.lukapp.BuildConfig
import app.lukapp.datos.EstadoSincronizacion
import app.lukapp.dominio.NivelSync
import app.lukapp.dominio.detalleSync
import app.lukapp.dominio.estadoSync
import app.lukapp.dominio.fechaCorta
import app.lukapp.dominio.idDeCuenta
import app.lukapp.dominio.validarContrasenaSegura
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.sobreFondo
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * CuentaView.tsx: quién eres, tu plan, si los datos están al día y las salidas: cerrar sesión (te vas y todo sigue
 * ahí) y eliminar cuenta (te vas y te llevas todo), que por eso pide una confirmación aparte.
 * Sin los botones de compra de Premium: el pago con Wompi se hace en la web.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaCuenta(
    modelo: ModeloCuenta, estado: EstadoSincronizacion, errorSync: String?, cambiosPendientes: Int,
    alSincronizar: suspend () -> Unit, alCerrarSesion: () -> Unit, alCerrar: () -> Unit,
) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    LaunchedEffect(Unit) { modelo.cargar() }
    val contexto = LocalContext.current
    val ambito = rememberCoroutineScope()
    val apodo by modelo.apodo.collectAsState()
    val plan by modelo.plan.collectAsState()
    val cargandoPlan by modelo.cargandoPlan.collectAsState()
    val errorPlan by modelo.errorPlan.collectAsState()
    val correo = modelo.correo
    val id = remember(modelo.idUsuario) { modelo.idUsuario?.let(::idDeCuenta) }
    var copiado by remember { mutableStateOf(false) }
    var sincronizando by remember { mutableStateOf(false) }
    var cambiando by rememberSaveable { mutableStateOf(false) }
    var nueva by rememberSaveable { mutableStateOf("") }
    var confirmar by rememberSaveable { mutableStateOf("") }
    var ver by rememberSaveable { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var errorClave by remember { mutableStateOf<String?>(null) }
    var claveActualizada by remember { mutableStateOf(false) }
    var confirmandoBorrado by rememberSaveable { mutableStateOf(false) }
    var eliminando by remember { mutableStateOf(false) }
    var errorEliminar by remember { mutableStateOf<String?>(null) }

    val hayError = estado == EstadoSincronizacion.ERROR || errorSync != null
    val (textoSync, nivel) = estadoSync(hayError, cambiosPendientes)

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Cuenta", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(CircleShape).background(c.soft), contentAlignment = Alignment.Center) { Icono(Lucide.User, tamano = 24.dp, grosor = 2f, color = c.inkSoft) }
                Column(Modifier.weight(1f)) {
                    Text(apodo ?: correo ?: "Tu cuenta", style = LukApp.tipo.cuerpoB, color = c.ink, maxLines = 1)
                    if (apodo != null) Text(correo ?: "", style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft, maxLines = 1)
                }
            }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                Text("ID de cuenta", Modifier.padding(bottom = 8.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        id ?: "—", Modifier.weight(1f).clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.bg).horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 12.dp),
                        style = LukApp.tipo.de(13, 400, 1.3f), color = c.ink, maxLines = 1, softWrap = false,
                    )
                    Row(
                        Modifier.alpha(if (id == null) 0.5f else 1f).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Copiar ID de cuenta" }
                            .pulsable(habilitado = id != null, alPulsar = {
                                contexto.getSystemService(android.content.ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("ID de cuenta", id))
                                copiado = true
                                ambito.launch { delay(2000); copiado = false }
                            }).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icono(if (copiado) Lucide.Check else Lucide.Copy, tamano = 14.dp, grosor = 2.5f, color = c.ink)
                        Text(if (copiado) "Copiado" else "Copiar", style = LukApp.tipo.de(13, 600, 1.3f), color = c.ink)
                    }
                }
            }

            Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(c.soft), contentAlignment = Alignment.Center) { Icono(Lucide.CreditCard, tamano = 20.dp, grosor = 2.25f, color = c.accent) }
                Column(Modifier.weight(1f)) {
                    Text("Tu plan", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                    val p = plan
                    if (p == null && cargandoPlan) Text("Consultando tus beneficios…", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
                    if (p != null) {
                        Text(
                            if (p.esPremium) "Premium" + (p.venceEn?.let { " hasta ${fechaCorta(it)}" } ?: "") else "Normal — gratis para siempre",
                            Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft,
                        )
                        Text(
                            if (p.esPremium) "Estas son las prestaciones activas de tu Premium ahora mismo." else "Estas son las prestaciones activas de tu plan Normal.",
                            Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint,
                        )
                        FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            p.beneficios.forEach { Text(it, Modifier.clip(CircleShape).background(c.soft).padding(horizontal = 12.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft) }
                        }
                        Row(
                            Modifier.padding(top = 12.dp).pulsable(escala = 1f, alPulsar = modelo::abrirBeneficios),
                            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Ver beneficios de Premium",
                                style = LukApp.tipo.de(13, 600, 1.4f).copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline),
                                color = c.accent,
                            )
                            Icono(Lucide.ChevronRight, tamano = 14.dp, grosor = 2.5f, color = c.accent)
                        }
                        if (!p.esPremium) Text(
                            "Premium incluye ${p.beneficiosPremium} prestaciones configuradas actualmente. Para pasar a Premium, entra a LukApp desde la web.",
                            Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint,
                        )
                    }
                    errorPlan?.let {
                        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(it, Modifier.weight(1f, fill = false), style = LukApp.tipo.de(13, 600, 1.4f), color = c.salioInk)
                            Text("Reintentar", Modifier.pulsable(escala = 1f, alPulsar = { modelo.cargarPlan() }), style = LukApp.tipo.de(13, 600, 1.4f), color = c.accent)
                        }
                    }
                }
            }

            Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(when (nivel) { NivelSync.ERROR -> c.salio; NivelSync.PENDIENTE -> androidx.compose.ui.graphics.Color(0xFFF59E0B); NivelSync.BIEN -> c.entro }))
                Column(Modifier.weight(1f)) {
                    Text("Sincronización", style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkSoft)
                    Text(textoSync, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                    Text(detalleSync(hayError, cambiosPendientes), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
                }
                Row(
                    Modifier.alpha(if (sincronizando) 0.6f else 1f).clip(Medidas.formaControl).background(c.soft).semantics { contentDescription = "Sincronizar" }
                        .pulsable(habilitado = !sincronizando, alPulsar = { sincronizando = true; ambito.launch { try { alSincronizar() } finally { sincronizando = false } } }).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.RefreshCw, tamano = 14.dp, grosor = 2.5f, color = c.ink)
                    Text("Sincronizar", style = LukApp.tipo.de(13, 600, 1.3f), color = c.ink)
                }
            }

            Text(
                "Cerrar sesión", Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).semantics { contentDescription = "Cerrar sesión" }.pulsable(escala = 0.99f, alPulsar = alCerrarSesion).padding(16.dp),
                style = LukApp.tipo.cuerpoB, color = c.ink,
            )

            if (!cambiando) Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).semantics { contentDescription = "Restablecer contraseña" }.pulsable(escala = 0.99f, alPulsar = { cambiando = true; errorClave = null }).padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.KeyRound, tamano = 16.dp, grosor = 2.5f, color = c.accent)
                Text("Restablecer contraseña", Modifier.weight(1f), style = LukApp.tipo.cuerpoB, color = c.ink)
                if (claveActualizada) Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Check, tamano = 14.dp, grosor = 2.5f, color = c.entro); Text("Actualizada", style = LukApp.tipo.de(13, 600, 1.3f), color = c.entro)
                }
            } else Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.accent.copy(alpha = 0.25f), Medidas.formaCard).background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.KeyRound, tamano = 16.dp, grosor = 2.5f, color = c.accent)
                    Text("Nueva contraseña", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                }
                CampoClave(nueva, { nueva = it }, "Mínimo 6 caracteres", "Nueva contraseña", ver, !guardando) { ver = !ver }
                CampoClave(confirmar, { confirmar = it }, "Confirmar contraseña", "Confirmar contraseña", ver, !guardando, null)
                errorClave?.let { Text(it, style = LukApp.tipo.de(13, 600, 1.4f), color = c.salioInk) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Boton("Cancelar", Modifier.weight(1f), c.soft, c.ink, !guardando) { cambiando = false; nueva = ""; confirmar = ""; errorClave = null }
                    Boton(if (guardando) "Guardando…" else "Guardar", Modifier.weight(1f), c.accent, c.onAccent, !guardando) {
                        errorClave = null
                        val seguridad = validarContrasenaSegura(nueva, listOf(apodo, correo))
                        if (seguridad != null) { errorClave = seguridad; return@Boton }
                        if (nueva != confirmar) { errorClave = "Las contraseñas no coinciden."; return@Boton }
                        guardando = true
                        ambito.launch {
                            val error = modelo.cambiarContrasena(nueva)
                            guardando = false
                            if (error != null) errorClave = error else {
                                nueva = ""; confirmar = ""; cambiando = false; claveActualizada = true
                                launch { delay(4000); claveActualizada = false }
                            }
                        }
                    }
                }
            }

            Text("Zona de riesgo", Modifier.padding(start = 4.dp, top = 8.dp), style = LukApp.tipo.de(13, 600, 1.3f), color = c.inkFaint)
            if (!confirmandoBorrado) Row(
                Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).semantics { contentDescription = "Eliminar cuenta" }.pulsable(escala = 0.99f, alPulsar = { confirmandoBorrado = true }).padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.Trash2, tamano = 16.dp, grosor = 2.5f, color = c.salioInk)
                Text("Eliminar cuenta", style = LukApp.tipo.cuerpoB, color = c.salioInk)
            } else Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.salio.copy(alpha = 0.4f), Medidas.formaCard).background(c.salioBg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Icono(Lucide.AlertTriangle, tamano = 16.dp, grosor = 2.5f, color = c.salioInk)
                    Text(
                        "Esto borra tu cuenta y todos tus datos para siempre: movimientos, cuentas, metas, categorías propias. No se puede deshacer.",
                        style = LukApp.tipo.de(15, 400, 1.6f), color = c.salioInk,
                    )
                }
                errorEliminar?.let { Text(it, style = LukApp.tipo.de(13, 600, 1.4f), color = c.salioInk) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Boton("Cancelar", Modifier.weight(1f), c.card, c.ink, !eliminando) { confirmandoBorrado = false; errorEliminar = null }
                    Boton(if (eliminando) "Eliminando…" else "Sí, eliminar mi cuenta", Modifier.weight(1f), c.salio, c.onOut, !eliminando) {
                        eliminando = true; errorEliminar = null
                        ambito.launch {
                            val error = modelo.eliminarCuenta()
                            if (error == null) alCerrarSesion() else { errorEliminar = error; eliminando = false }
                        }
                    }
                }
            }

            // La versión, al pie: es lo primero que alguien va a decir al reportar un problema.
            Text("LukApp v${BuildConfig.VERSION_NAME.removePrefix("v").removeSuffix("-debug")}", Modifier.fillMaxWidth().padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

@Composable
private fun Boton(texto: String, modifier: Modifier, fondo: androidx.compose.ui.graphics.Color, tinta: androidx.compose.ui.graphics.Color, habilitado: Boolean, alPulsar: () -> Unit) {
    Box(
        modifier.alpha(if (habilitado) 1f else 0.6f).clip(Medidas.formaControl).background(fondo).semantics { contentDescription = texto }.pulsable(habilitado = habilitado, alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) { Text(texto, style = LukApp.tipo.de(15, 600, 1.3f), color = tinta) }
}

@Composable
private fun CampoClave(valor: String, alCambiar: (String) -> Unit, marcador: String, descripcion: String, ver: Boolean, habilitado: Boolean, alVer: (() -> Unit)?) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.sobreFondo(c.card)).padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (valor.isEmpty()) Text(marcador, style = LukApp.tipo.de(17, 400, 1.3f), color = c.inkFaint)
            BasicTextField(
                value = valor, onValueChange = alCambiar, enabled = habilitado, singleLine = true, textStyle = LukApp.tipo.de(17, 400, 1.3f).copy(color = c.ink), cursorBrush = SolidColor(c.accent),
                visualTransformation = if (ver) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth().semantics { contentDescription = descripcion },
            )
        }
        if (alVer != null) Box(Modifier.size(24.dp).semantics { contentDescription = if (ver) "Ocultar contraseña" else "Mostrar contraseña" }.pulsable(escala = 1f, alPulsar = alVer), contentAlignment = Alignment.Center) {
            Icono(if (ver) Lucide.EyeOff else Lucide.Eye, tamano = 16.dp, color = c.inkFaint)
        }
    }
}
