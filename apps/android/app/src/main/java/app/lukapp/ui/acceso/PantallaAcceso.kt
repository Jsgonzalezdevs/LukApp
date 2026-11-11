package app.lukapp.ui.acceso

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lukapp.R
import app.lukapp.dominio.coincideConIdentificador
import app.lukapp.dominio.evaluarRequisitosContrasena
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import app.lukapp.ui.tema.PreferenciaTema

// Ámbar de Tailwind que usa el botón principal del acceso (from-amber-500 via-amber-600).
private val Ambar500 = Color(0xFFF59E0B)
private val Ambar600 = Color(0xFFD97706)
private val Ambar400 = Color(0xFFFBBF24)
private val Cielo400 = Color(0xFF38BDF8)
/** systemGreen de Apple: el verde del checklist (ChecklistContrasena.css). */
private val VerdeMac = Color(0xFF34C759)

/**
 * LoginPanel.tsx en su variante `data-native` (lukapp.css:863-868): sin aurora,
 * puntos, halos ni brillo detrás de la marca, y la tarjeta con --fin-card opaco.
 * Es la misma variante que hoy ve quien usa la app Android.
 */
@Composable
fun PantallaAcceso(
    modelo: ModeloAcceso,
    tema: PreferenciaTema,
    alCambiarTema: (PreferenciaTema) -> Unit,
    estadoFlujo: EstadoAcceso,
) {
    val c = LukApp.colores
    val e = estadoFlujo
    val contexto = LocalContext.current

    Box(
        Modifier
            .fillMaxSize()
            .background(c.bg)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        Box(Modifier.align(Alignment.TopEnd).padding(20.dp)) { SelectorTema(tema, alCambiarTema) }

        // Entrada: opacity 0→1, y 24→0, scale .97→1 en 0.2s easeOut.
        var visible by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { visible = true }
        val progreso by animateFloatAsState(if (visible) 1f else 0f, tween(200, easing = FastOutSlowInEasing), label = "entrada")

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Column(
                Modifier
                    .widthIn(max = 432.dp)
                    .fillMaxWidth()
                    .graphicsLayer {
                        alpha = progreso
                        translationY = (1 - progreso) * 24.dp.toPx()
                        val s = 0.97f + 0.03f * progreso
                        scaleX = s; scaleY = s
                    },
            ) {
                Cabecera(e.modo)
                Tarjeta {
                    when {
                        e.modo == ModoAcceso.REGISTRARSE && e.enviado && e.error == null && !e.ocupado -> Exito(
                            icono = Lucide.MailCheck, fondo = c.entroBg, tinta = c.entro,
                            titulo = "¡Revisa tu correo!",
                            antes = "Te enviamos un enlace de confirmación a ", destacado = e.identidad.trim(),
                            despues = ". Ábrelo para activar tu cuenta y empezar.",
                            boton = "Ya lo confirmé, quiero entrar",
                        ) { modelo.cambiarModo(ModoAcceso.ENTRAR) }
                        e.modo == ModoAcceso.RECUPERAR && e.recuperadoEnviado && e.error == null && !e.ocupado -> Exito(
                            icono = Lucide.MailCheck, fondo = c.warnBg, tinta = c.warnInk,
                            titulo = "¡Enlace enviado!",
                            antes = "Te enviamos un enlace para restaurar tu contraseña a ", destacado = e.identidad.trim(),
                            despues = ". Ábrelo para ingresar tu nueva contraseña. Si no lo ves en unos minutos, revisa tu carpeta de spam.",
                            boton = "Volver a Iniciar sesión",
                        ) { modelo.cambiarModo(ModoAcceso.ENTRAR) }
                        e.modo == ModoAcceso.ACTUALIZAR && e.contrasenaActualizada && e.error == null && !e.ocupado -> Exito(
                            icono = Lucide.Check, grosorIcono = 2.5f, fondo = c.entroBg, tinta = c.entro,
                            titulo = "¡Contraseña actualizada!",
                            antes = "Tu contraseña ha sido cambiada correctamente. Ya puedes acceder con tus nuevas credenciales.",
                            destacado = null, despues = "",
                            boton = "Entrar a LukApp",
                        ) { modelo.terminarRecuperacion() }
                        else -> Formulario(modelo, e) { modelo.entrarConGoogle(contexto) }
                    }
                    PieConfianza()
                }
            }
        }
    }
}

@Composable
private fun Cabecera(modo: ModoAcceso) {
    val c = LukApp.colores
    Column(Modifier.fillMaxWidth().padding(bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .padding(bottom = 16.dp)
                .size(64.dp)
                .shadow(20.dp, RoundedCornerShape(22.4.dp), ambientColor = Color.Black.copy(.15f), spotColor = Color.Black.copy(.15f))
                .clip(RoundedCornerShape(22.4.dp))
                .background(c.card)
                .border(1.dp, c.line, RoundedCornerShape(22.4.dp))
                .background(
                    Brush.radialGradient(listOf(Color(0x357C3AED), Color.Transparent), center = androidx.compose.ui.geometry.Offset(10f, 10f), radius = 120f),
                    alpha = 0.8f,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Image(painterResource(R.drawable.marca_isotipo), contentDescription = null, modifier = Modifier.size(32.dp))
        }
        Text("LukApp", style = LukApp.tipo.de(28, 700, 1.15f, -0.025f), color = c.ink)
        Text(
            if (modo == ModoAcceso.ENTRAR) "Tu plata tiene historia. Aquí la entiendes." else "Crea tu cuenta y dale contexto a cada peso.",
            Modifier.padding(top = 4.dp),
            style = LukApp.tipo.de(15, 400, 1.625f),
            color = c.inkSoft,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun Tarjeta(contenido: @Composable () -> Unit) {
    val c = LukApp.colores
    val forma = RoundedCornerShape(Medidas.rSheet)
    Box(
        Modifier
            .fillMaxWidth()
            .shadow(32.dp, forma, ambientColor = Color.Black.copy(.16f), spotColor = Color.Black.copy(.3f))
            .clip(forma)
            .background(c.card)
            .background(if (c.esOscuro) Color.Transparent else Color.Transparent)
            .border(1.dp, c.line.copy(alpha = 0.9f), forma),
    ) {
        // Brillo de 1px arriba: `before:via-amber-400/40`.
        Box(
            Modifier.fillMaxWidth().height(1.dp)
                .background(Brush.horizontalGradient(listOf(Color.Transparent, Ambar400.copy(alpha = 0.4f), Color.Transparent))),
        )
        Column(Modifier.padding(24.dp)) { contenido() }
    }
}

@Composable
private fun Exito(
    icono: IconoLucide,
    fondo: Color,
    tinta: Color,
    titulo: String,
    antes: String,
    destacado: String?,
    despues: String,
    boton: String,
    grosorIcono: Float = 2f,
    alPulsar: () -> Unit,
) {
    val c = LukApp.colores
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.padding(bottom = 16.dp).size(64.dp).clip(Medidas.formaCard).background(fondo),
            contentAlignment = Alignment.Center,
        ) { Icono(icono, tamano = 32.dp, grosor = grosorIcono, color = tinta) }
        Text(titulo, style = LukApp.tipo.de(20, 700, 1.2f), color = c.ink)
        Text(
            buildAnnotatedString {
                append(antes)
                if (destacado != null) withStyle(SpanStyle(color = c.ink, fontWeight = FontWeight.Bold)) { append(destacado) }
                append(despues)
            },
            Modifier.padding(top = 12.dp),
            style = LukApp.tipo.de(15, 400, 1.625f),
            color = c.inkSoft,
            textAlign = TextAlign.Center,
        )
        Row(
            Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .clip(Medidas.formaCard)
                .background(c.accent)
                .pulsable(alPulsar = alPulsar)
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(boton, style = LukApp.tipo.de(15, 700, 1.4f), color = c.onAccent)
            Icono(Lucide.ArrowRight, tamano = 16.dp, grosor = 2.5f, color = c.onAccent)
        }
    }
}

@Composable
private fun Formulario(modelo: ModeloAcceso, e: EstadoAcceso, alGoogle: () -> Unit) {
    val c = LukApp.colores
    if (e.modo == ModoAcceso.ENTRAR || e.modo == ModoAcceso.REGISTRARSE) {
        SelectorModo(e.modo) { modelo.cambiarModo(it) }
        BotonGoogle(abriendo = e.abriendoGoogle, deshabilitado = e.ocupado, alPulsar = alGoogle)
    }
    when (e.modo) {
        ModoAcceso.RECUPERAR -> EncabezadoSeccion(Lucide.KeyRound, "Restaurar contraseña") {
            Row(
                Modifier.pulsable { modelo.cambiarModo(ModoAcceso.ENTRAR) },
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(Lucide.ArrowLeft, tamano = 14.dp, color = c.inkFaint)
                Text("Volver", style = LukApp.tipo.de(13, 600), color = c.inkFaint)
            }
        }
        ModoAcceso.ACTUALIZAR -> EncabezadoSeccion(Lucide.Lock, "Ingresa tu nueva contraseña", null)
        else -> {}
    }

    AnimatedContent(
        targetState = e.modo,
        transitionSpec = {
            (fadeIn(tween(220)) + slideInVertically(tween(220)) { 8 }) togetherWith
                (fadeOut(tween(220)) + slideOutVertically(tween(220)) { -8 })
        },
        label = "modo",
    ) { modo ->
        Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
            if (modo == ModoAcceso.REGISTRARSE) {
                Column {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Etiqueta("Tu nombre / apodo")
                        AvisoApodo(e.apodo)
                    }
                    Campo(e.usuario, modelo::usuario, Lucide.User, "Ej. Julián", KeyboardType.Text)
                }
            }
            if (modo != ModoAcceso.ACTUALIZAR) {
                Column {
                    Etiqueta(if (modo == ModoAcceso.ENTRAR) "Tu correo o demo" else "Tu correo", Modifier.padding(bottom = 8.dp))
                    Campo(e.identidad, modelo::identidad, Lucide.Mail, "tu@correo.com",
                        if (modo == ModoAcceso.ENTRAR) KeyboardType.Text else KeyboardType.Email)
                }
            }
            if (modo != ModoAcceso.RECUPERAR) {
                Column {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Etiqueta(if (modo == ModoAcceso.ACTUALIZAR) "Nueva contraseña" else "Contraseña")
                        if (modo == ModoAcceso.ENTRAR) {
                            Text(
                                "¿Olvidaste tu contraseña?",
                                Modifier.pulsable { modelo.cambiarModo(ModoAcceso.RECUPERAR) },
                                style = LukApp.tipo.de(13, 600), color = c.warnInk,
                            )
                        }
                    }
                    Campo(
                        e.contrasena, modelo::contrasena, Lucide.Lock, "••••••••", KeyboardType.Password,
                        secreto = !e.verContrasena,
                        accion = {
                            Box(
                                Modifier
                                    .size(40.dp)
                                    .clip(Medidas.formaControl)
                                    .semantics { contentDescription = if (e.verContrasena) "Ocultar contraseña" else "Mostrar contraseña" }
                                    .pulsable { modelo.verContrasena() },
                                contentAlignment = Alignment.Center,
                            ) { Icono(if (e.verContrasena) Lucide.EyeOff else Lucide.Eye, tamano = 16.dp, grosor = 2.25f, color = c.inkFaint) }
                        },
                        alEnviar = modelo::enviar,
                    )
                    if (modo != ModoAcceso.ENTRAR) {
                        Checklist(e.contrasena, if (modo == ModoAcceso.REGISTRARSE) listOf(e.usuario, e.identidad) else emptyList())
                    }
                }
            }
            if (modo == ModoAcceso.ENTRAR) Recordarme(e.recordarme, modelo::recordarme)
        }
    }

    AnimatedVisibility(e.error != null, enter = fadeIn(tween(200)) + expandVertically(tween(200)), exit = fadeOut(tween(200)) + shrinkVertically(tween(200))) {
        Row(
            Modifier
                .padding(top = 18.dp)
                .fillMaxWidth()
                .clip(Medidas.formaCard)
                .background(c.salioBg)
                .border(1.dp, c.salio.copy(alpha = 0.3f), Medidas.formaCard)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icono(Lucide.AlertTriangle, Modifier.padding(top = 4.dp), tamano = 16.dp, grosor = 2.5f, color = c.salio)
            Text(e.error.orEmpty(), style = LukApp.tipo.de(15, 400, 1.625f), color = c.salio)
        }
    }

    BotonPrincipal(e, modelo.listo(e), modelo::enviar)

    val enlace: Pair<String, () -> Unit>? = when (e.modo) {
        ModoAcceso.RECUPERAR -> "¿Recordaste tu contraseña? " to { modelo.cambiarModo(ModoAcceso.ENTRAR) }
        ModoAcceso.ENTRAR -> "¿No tienes cuenta? " to { modelo.cambiarModo(ModoAcceso.REGISTRARSE) }
        ModoAcceso.REGISTRARSE -> "¿Ya tienes cuenta? " to { modelo.cambiarModo(ModoAcceso.ENTRAR) }
        else -> null
    }
    if (enlace != null) {
        val destino = if (e.modo == ModoAcceso.ENTRAR) "Crear cuenta" else "Iniciar sesión"
        Text(
            buildAnnotatedString {
                append(enlace.first)
                withStyle(SpanStyle(color = c.warnInk, textDecoration = TextDecoration.Underline)) { append(destino) }
            },
            Modifier.fillMaxWidth().padding(top = 20.dp).pulsable(alPulsar = enlace.second),
            style = LukApp.tipo.de(13, 600), color = c.inkSoft, textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun SelectorModo(modo: ModoAcceso, alCambiar: (ModoAcceso) -> Unit) {
    val c = LukApp.colores
    BoxWithConstraints(
        Modifier
            .padding(bottom = 24.dp)
            .fillMaxWidth()
            .clip(Medidas.formaCard)
            .background(c.soft)
            .border(1.dp, c.line.copy(alpha = 0.5f), Medidas.formaCard)
            .padding(4.dp),
    ) {
        val ancho = (maxWidth - 4.dp) / 2
        // La pastilla se desliza con el resorte de framer `layoutId` (stiffness 450, damping 35).
        val desplazamiento by androidx.compose.animation.core.animateDpAsState(
            if (modo == ModoAcceso.ENTRAR) 0.dp else ancho + 4.dp,
            spring(stiffness = 450f, dampingRatio = 35f / (2 * kotlin.math.sqrt(450f))),
            label = "pastilla",
        )
        Box(
            Modifier.offset(x = desplazamiento).width(ancho).height(44.dp)
                .shadow(1.dp, Medidas.formaControl).clip(Medidas.formaControl).background(c.card),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(ModoAcceso.ENTRAR to "Entrar", ModoAcceso.REGISTRARSE to "Crear cuenta").forEach { (m, texto) ->
                val color by animateColorAsState(if (modo == m) c.ink else c.inkSoft, label = "colorModo")
                Box(Modifier.width(ancho).height(44.dp).clip(Medidas.formaControl).pulsable { alCambiar(m) }, contentAlignment = Alignment.Center) {
                    Text(texto, style = LukApp.tipo.de(13, 700), color = color)
                }
            }
        }
    }
}

@Composable
private fun BotonGoogle(abriendo: Boolean, deshabilitado: Boolean, alPulsar: () -> Unit) {
    val c = LukApp.colores
    val forma = RoundedCornerShape(14.dp)
    Column(Modifier.padding(bottom = 17.6.dp)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .graphicsLayer { alpha = if (abriendo || deshabilitado) 0.75f else 1f }
                .clip(forma)
                .background(c.surface)
                .border(1.dp, c.line, forma)
                .pulsable(habilitado = !abriendo && !deshabilitado, escala = 0.985f, alPulsar = alPulsar)
                .padding(horizontal = 16.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(10.4.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (abriendo) Girando(Lucide.Loader2, 18.dp, c.ink, 900)
            else Image(painterResource(R.drawable.google_marca), contentDescription = null, modifier = Modifier.size(20.dp))
            Text(if (abriendo) "Abriendo Google…" else "Continuar con Google", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
        }
        Row(Modifier.padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f).height(1.dp).background(c.line))
            Text("o con tu correo", style = LukApp.tipo.de(12, 500), color = c.inkFaint)
            Box(Modifier.weight(1f).height(1.dp).background(c.line))
        }
    }
}

@Composable
private fun EncabezadoSeccion(icono: IconoLucide, texto: String, derecha: (@Composable () -> Unit)?) {
    val c = LukApp.colores
    Column(Modifier.padding(bottom = 20.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(icono, tamano = 16.dp, color = c.warnInk)
                Text(texto, style = LukApp.tipo.de(15, 700), color = c.ink)
            }
            derecha?.invoke()
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.line.copy(alpha = 0.5f)))
    }
}

@Composable
private fun Etiqueta(texto: String, modifier: Modifier = Modifier) {
    Text(texto.uppercase(), modifier, style = LukApp.tipo.de(13, 700, 1.4f, 0.05f), color = LukApp.colores.inkFaint)
}

@Composable
private fun AvisoApodo(estado: EstadoApodo) {
    val c = LukApp.colores
    when (estado) {
        EstadoApodo.VACIO -> {}
        EstadoApodo.CORTO -> Text("mín. ${ModeloAcceso.APODO_MINIMO} letras", style = LukApp.tipo.de(13, 500), color = c.warnInk)
        EstadoApodo.COMPROBANDO -> Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Girando(Lucide.Loader2, 12.dp, c.inkFaint, 1000)
            Text("comprobando", style = LukApp.tipo.de(13, 500), color = c.inkFaint)
        }
        EstadoApodo.LIBRE -> Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(Lucide.Check, tamano = 12.dp, grosor = 3f, color = c.entro)
            Text("disponible", style = LukApp.tipo.de(13, 700), color = c.entro)
        }
        EstadoApodo.COGIDO -> Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(Lucide.X, tamano = 12.dp, grosor = 3f, color = c.salio)
            Text("ya tomado", style = LukApp.tipo.de(13, 700), color = c.salio)
        }
    }
}

/**
 * El campo de LoginPanel (`campo`): radio 20, borde --fin-line/60, fondo --fin-bg/80,
 * pl-10 pr-4 py-4, 17px. Con foco: borde --fin-accent, fondo --fin-card y anillo accent/25.
 */
@Composable
private fun Campo(
    valor: String,
    alCambiar: (String) -> Unit,
    icono: IconoLucide,
    marcador: String,
    teclado: KeyboardType,
    secreto: Boolean = false,
    accion: (@Composable () -> Unit)? = null,
    alEnviar: (() -> Unit)? = null,
) {
    val c = LukApp.colores
    var enfocado by remember { mutableStateOf(false) }
    val borde by animateColorAsState(if (enfocado) c.accent else c.line.copy(alpha = 0.6f), tween(200), label = "borde")
    val fondo by animateColorAsState(if (enfocado) c.card else c.bg.copy(alpha = 0.8f), tween(200), label = "fondo")
    val forma = Medidas.formaCard
    BasicTextField(
        value = valor,
        onValueChange = alCambiar,
        singleLine = true,
        textStyle = LukApp.tipo.de(17, 400, 1.4f).copy(color = c.ink),
        cursorBrush = SolidColor(c.accent),
        visualTransformation = if (secreto) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = teclado,
            capitalization = KeyboardCapitalization.None,
            autoCorrectEnabled = false,
            imeAction = if (alEnviar != null) ImeAction.Done else ImeAction.Next,
        ),
        keyboardActions = KeyboardActions(onDone = { alEnviar?.invoke() }),
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged { enfocado = it.isFocused }
            .then(if (enfocado) Modifier.border(BorderStroke(3.dp, c.accent.copy(alpha = 0.25f)), forma) else Modifier),
        decorationBox = { interno ->
            Row(
                Modifier.clip(forma).background(fondo).border(1.dp, borde, forma)
                    .padding(start = 14.dp, end = if (accion != null) 6.dp else 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(icono, tamano = 16.dp, color = c.inkFaint)
                Spacer(Modifier.width(10.dp))
                Box(Modifier.weight(1f).padding(vertical = 16.dp)) {
                    if (valor.isEmpty()) Text(marcador, style = LukApp.tipo.de(17, 400, 1.4f), color = c.inkGhost)
                    interno()
                }
                accion?.invoke()
            }
        },
    )
}

@Composable
private fun Checklist(contrasena: String, identificadores: List<String>) {
    val c = LukApp.colores
    val requisitos = evaluarRequisitosContrasena(contrasena)
    val cumplidos = requisitos.count { it.cumple }
    val todos = cumplidos == requisitos.size
    val repite = todos && coincideConIdentificador(contrasena, identificadores)
    val ancho by animateFloatAsState(cumplidos.toFloat() / requisitos.size, tween(250), label = "barra")
    val colorBarra by animateColorAsState(if (todos) VerdeMac else c.inkSoft, tween(250), label = "colorBarra")
    Column(Modifier.padding(top = 9.6.dp)) {
        Box(Modifier.padding(bottom = 9.6.dp).fillMaxWidth().height(4.dp).clip(CircleShape).background(c.line)) {
            Box(Modifier.fillMaxWidth(ancho).height(4.dp).clip(CircleShape).background(colorBarra))
        }
        requisitos.chunked(2).forEach { fila ->
            Row(Modifier.fillMaxWidth().padding(bottom = 6.4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                fila.forEach { r ->
                    val color by animateColorAsState(if (r.cumple) VerdeMac else c.inkFaint, tween(200), label = "req")
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(7.2.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(18.dp).clip(CircleShape)
                                .background(if (r.cumple) VerdeMac else Color.Transparent)
                                .border(1.5.dp, color, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) { Icono(if (r.cumple) Lucide.Check else Lucide.X, tamano = 12.dp, grosor = 3.25f, color = if (r.cumple) Color.White else color) }
                        Text(r.texto, style = LukApp.tipo.de(12, if (r.cumple) 600 else 500, 1.25f), color = color)
                    }
                }
                if (fila.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        if (repite) {
            Text("No puede ser igual a tu usuario ni a tu correo.", Modifier.padding(top = 8.8.dp), style = LukApp.tipo.de(12, 600), color = c.salio)
        }
    }
}

@Composable
private fun Recordarme(activo: Boolean, alCambiar: (Boolean) -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.padding(top = 2.dp).pulsable(escala = 0.95f, rol = androidx.compose.ui.semantics.Role.Checkbox) { alCambiar(!activo) },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(18.dp).clip(Medidas.formaControl)
                .background(if (activo) c.accent else Color.Transparent)
                .border(1.dp, if (activo) c.accent else c.line, Medidas.formaControl),
            contentAlignment = Alignment.Center,
        ) { if (activo) Icono(Lucide.Check, tamano = 14.dp, grosor = 3.5f, color = c.onAccent) }
        Text("Recuérdame", style = LukApp.tipo.de(13, 400), color = c.inkSoft)
    }
}

@Composable
private fun BotonPrincipal(e: EstadoAcceso, listo: Boolean, alPulsar: () -> Unit) {
    val activo = listo && !e.ocupado
    val forma = Medidas.formaCard
    Row(
        Modifier
            .padding(top = 24.dp)
            .fillMaxWidth()
            .graphicsLayer { alpha = if (activo) 1f else 0.3f }
            .then(if (activo) Modifier.shadow(24.dp, forma, ambientColor = Ambar500.copy(.35f), spotColor = Ambar500.copy(.35f)) else Modifier)
            .clip(forma)
            .background(Brush.horizontalGradient(listOf(Ambar500, Ambar600, Ambar500)))
            .pulsable(habilitado = activo, escala = 0.985f, alPulsar = alPulsar)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (e.ocupado) {
            Girando(Lucide.Loader2, 18.dp, Color.White, 1000)
            Text(
                when (e.modo) {
                    ModoAcceso.ENTRAR -> "Entrando…"
                    ModoAcceso.REGISTRARSE -> "Creando tu cuenta…"
                    ModoAcceso.RECUPERAR -> "Enviando enlace…"
                    ModoAcceso.ACTUALIZAR -> "Guardando nueva contraseña…"
                },
                style = LukApp.tipo.de(17, 700), color = Color.White,
            )
        } else {
            Text(
                when (e.modo) {
                    ModoAcceso.ENTRAR -> "Entrar"
                    ModoAcceso.REGISTRARSE -> "Crear mi cuenta"
                    ModoAcceso.RECUPERAR -> "Restaurar contraseña"
                    ModoAcceso.ACTUALIZAR -> "Guardar contraseña"
                },
                style = LukApp.tipo.de(17, 700), color = Color.White,
            )
            Icono(Lucide.ArrowRight, tamano = 18.dp, grosor = 2.5f, color = Color.White)
        }
    }
}

@Composable
private fun PieConfianza() {
    val c = LukApp.colores
    Column(Modifier.padding(top = 28.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.line.copy(alpha = 0.5f)))
        Row(
            Modifier.fillMaxWidth().padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.ShieldCheck, tamano = 14.dp, color = c.entro)
                Text("Tus datos son privados", style = LukApp.tipo.de(13, 500), color = c.inkFaint)
            }
            // La web dice "Integración con iOS" también dentro de la app Android; se conserva el texto
            // tal cual porque cambiar copys no está autorizado (ver docs/android/diferencias.md).
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icono(Lucide.Smartphone, tamano = 14.dp, color = Cielo400)
                Text("Integración con iOS", style = LukApp.tipo.de(13, 500), color = c.inkFaint)
            }
        }
    }
}

/** TemaToggle.tsx: radiogroup de 3 botones de 24dp con ícono de 14dp. */
@Composable
fun SelectorTema(tema: PreferenciaTema, alCambiar: (PreferenciaTema) -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.clip(CircleShape).background(c.card).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        listOf(
            Triple(PreferenciaTema.CLARO, Lucide.Sun, "Claro"),
            Triple(PreferenciaTema.OSCURO, Lucide.Moon, "Oscuro"),
            Triple(PreferenciaTema.SISTEMA, Lucide.Monitor, "Sistema"),
        ).forEach { (opcion, icono, etiqueta) ->
            val activo = tema == opcion
            Box(
                Modifier.size(24.dp).clip(CircleShape)
                    .background(if (activo) c.accent else Color.Transparent)
                    .semantics { contentDescription = etiqueta }
                    .pulsable(rol = androidx.compose.ui.semantics.Role.RadioButton) { alCambiar(opcion) },
                contentAlignment = Alignment.Center,
            ) { Icono(icono, tamano = 14.dp, grosor = 2.5f, color = if (activo) c.onAccent else c.inkSoft) }
        }
    }
}

/** Ícono que gira sin fin (`animate-spin`). */
@Composable
fun Girando(icono: IconoLucide, tamano: androidx.compose.ui.unit.Dp, color: Color, msPorVuelta: Int = 1000) {
    val t = rememberInfiniteTransition(label = "giro")
    val angulo by t.animateFloat(0f, 360f, infiniteRepeatable(tween(msPorVuelta, easing = LinearEasing), RepeatMode.Restart), label = "angulo")
    Icono(icono, Modifier.rotate(angulo), tamano = tamano, grosor = 2.5f, color = color)
}
