package app.lukapp.ui.mas

import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.lukapp.R
import app.lukapp.dominio.RegaloPremium
import app.lukapp.dominio.fechaVencimientoRegalo
import app.lukapp.dominio.palabraDias
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.Poppins
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// La paleta del manual de marca. Va fija y no del tema: la tarjeta es morada de noche y de día.
private val Morado = Color(0xFF772AEA)
private val Lavanda = Color(0xFF735AC2)
private val Lima = Color(0xFFB6F246)
private val Magenta = Color(0xFFD4025A)
private val Noche = Color(0xFF1A0838)

/** Quien apagó las animaciones del sistema tampoco ve confeti ni a Luki saltando. */
@Composable
private fun animacionesReducidas(): Boolean {
    val contexto = LocalContext.current
    return remember { Settings.Global.getFloat(contexto.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

private fun estilo(tamano: Int, peso: FontWeight, alto: Float = 1.3f, tracking: Float = 0f, color: Color = Color.White) =
    TextStyle(fontFamily = Poppins, fontWeight = peso, fontSize = tamano.sp, lineHeight = (tamano * alto).sp, letterSpacing = tracking.em, color = color)

/**
 * RegaloPremium.tsx: la celebración de cuando el equipo de LukApp le regala Premium
 * a alguien. Tarjeta morada encima de todo, con confeti de la marca y un solo botón.
 */
@Composable
fun BoxScope.DialogoRegaloPremium(regalo: RegaloPremium, alCerrar: () -> Unit) {
    val reducidas = animacionesReducidas()
    BackHandler(onBack = alCerrar)

    val aparicion = remember { Animatable(if (reducidas) 1f else 0f) }
    LaunchedEffect(Unit) { aparicion.animateTo(1f, spring(dampingRatio = 0.68f, stiffness = 260f)) }
    val numero = remember { Animatable(if (reducidas) 1f else 0.6f) }
    LaunchedEffect(Unit) { kotlinx.coroutines.delay(350); numero.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 320f)) }

    Box(
        Modifier.matchParentSize()
            .alpha(aparicion.value.coerceIn(0f, 1f))
            .background(Color(0xBF0D0726))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = alCerrar)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.widthIn(max = 400.dp).fillMaxWidth()
                .graphicsLayer {
                    val p = aparicion.value
                    translationY = (1f - p) * 40.dp.toPx()
                    scaleX = 0.9f + 0.1f * p
                    scaleY = 0.9f + 0.1f * p
                }
                .shadow(40.dp, RoundedCornerShape(32.dp), ambientColor = Morado, spotColor = Morado)
                .background(Brush.linearGradient(listOf(Color(0xFF2A0F57), Noche, Color(0xFF120527)), start = Offset(0f, 0f), end = Offset(400f, 1100f)), RoundedCornerShape(32.dp))
                .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(32.dp))
                // La tarjeta se traga los toques: solo el fondo de afuera cierra.
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .drawBehind { manchasDeLuz() },
        ) {
            if (!reducidas) {
                Destello(Magenta, 20.dp, 0.2f, Modifier.align(Alignment.TopStart).offset(28.dp, 150.dp))
                Destello(Lima, 16.dp, 0.6f, Modifier.align(Alignment.TopEnd).offset((-36).dp, 70.dp))
                Destello(Color.White.copy(alpha = 0.8f), 12.dp, 1f, Modifier.align(Alignment.TopEnd).offset((-56).dp, 200.dp))
            }
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(
                    Modifier.background(Color.White.copy(alpha = 0.10f), CircleShape)
                        .border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape)
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icono(Lucide.Gift, tamano = 14.dp, grosor = 2.4f, color = Lima)
                    Text("UN REGALO PARA TI", style = estilo(12, FontWeight.Bold, tracking = 0.12f, color = Color.White.copy(alpha = 0.85f)))
                }

                LukiSaltando(reducidas)

                Text(
                    "¡El equipo de LukApp te regaló",
                    style = estilo(23, FontWeight.ExtraBold, alto = 1.15f, tracking = -0.03f),
                    textAlign = TextAlign.Center,
                )
                // La píldora va aparte: un fondo con giro no cabe dentro de un texto en Compose.
                Text(
                    "Premium!",
                    Modifier.padding(top = 6.dp).rotate(-3f)
                        .shadow(10.dp, RoundedCornerShape(12.dp), ambientColor = Lima, spotColor = Lima)
                        .background(Lima, RoundedCornerShape(12.dp))
                        .padding(horizontal = 10.dp, vertical = 2.dp),
                    style = estilo(23, FontWeight.ExtraBold, alto = 1.15f, tracking = -0.03f, color = Noche),
                )

                Row(
                    Modifier.padding(top = 18.dp).scale(numero.value).alpha(numero.value.coerceIn(0f, 1f))
                        .background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(24.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp))
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                        .semantics(mergeDescendants = true) { contentDescription = "${regalo.dias} ${palabraDias(regalo.dias)} de Premium" },
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "${regalo.dias}",
                        style = estilo(54, FontWeight.ExtraBold, alto = 0.95f, tracking = -0.06f).copy(
                            brush = Brush.linearGradient(listOf(Lima, Color(0xFFC9B8FF), Morado)),
                        ),
                    )
                    Text(
                        "${palabraDias(regalo.dias)}\nde Premium",
                        Modifier.padding(bottom = 4.dp),
                        style = estilo(15, FontWeight.SemiBold, alto = 1.25f, color = Color.White.copy(alpha = 0.8f)),
                    )
                }

                Text(
                    "Ya está activo en tu cuenta: aprovecha todo lo de Premium sin pagar nada.",
                    Modifier.padding(top = 16.dp).widthIn(max = 280.dp),
                    style = estilo(14, FontWeight.Normal, alto = 1.6f, color = Color.White.copy(alpha = 0.75f)),
                    textAlign = TextAlign.Center,
                )

                Column(Modifier.padding(top = 16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Ventaja(Lucide.CalendarCheck) {
                        Text(
                            buildAnnotatedString {
                                append("Disfrútalo hasta el ")
                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = Color.White)) { append(fechaVencimientoRegalo(regalo.venceEn)) }
                            },
                            style = estilo(13, FontWeight.Medium, color = Color.White.copy(alpha = 0.8f)),
                        )
                    }
                    Ventaja(Lucide.ShieldCheck) {
                        Text("Sin tarjeta y sin cobros al terminar", style = estilo(13, FontWeight.Medium, color = Color.White.copy(alpha = 0.8f)))
                    }
                }

                Row(
                    Modifier.padding(top = 20.dp).fillMaxWidth().heightIn(min = 48.dp)
                        .shadow(14.dp, RoundedCornerShape(16.dp), ambientColor = Morado, spotColor = Morado)
                        .background(Morado, RoundedCornerShape(16.dp))
                        .clickable(role = Role.Button, onClick = alCerrar)
                        .padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Sparkles, tamano = 18.dp, grosor = 2.4f, color = Color.White)
                    Text("¡A disfrutarlo!", style = estilo(16, FontWeight.Bold))
                }
            }
        }
    }
    if (!reducidas) ConfetiMarca(Modifier.matchParentSize())
}

/** Las tres manchas difusas de color detrás del contenido (los `blur-3xl` de la web). */
private fun DrawScope.manchasDeLuz() {
    fun mancha(color: Color, centro: Offset, radio: Float) =
        drawCircle(Brush.radialGradient(listOf(color, Color.Transparent), center = centro, radius = radio), radio, centro)
    mancha(Morado.copy(alpha = 0.55f), Offset(56.dp.toPx(), 40.dp.toPx()), 150.dp.toPx())
    mancha(Magenta.copy(alpha = 0.30f), Offset(size.width - 30.dp.toPx(), 190.dp.toPx()), 120.dp.toPx())
    mancha(Lima.copy(alpha = 0.15f), Offset(144.dp.toPx(), size.height - 24.dp.toPx()), 130.dp.toPx())
}

@Composable
private fun Ventaja(icono: app.lukapp.ui.iconos.IconoLucide, texto: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icono(icono, tamano = 16.dp, grosor = 2.3f, color = Lima)
        texto()
    }
}

@Composable
private fun LukiSaltando(reducidas: Boolean) {
    val modificador = Modifier.padding(top = 10.dp).height(112.dp)
    if (reducidas) {
        Image(painterResource(R.drawable.luki_saltando), "Luki, la mascota de LukApp, saltando de alegría", modificador)
        return
    }
    val bucle = rememberInfiniteTransition(label = "luki")
    val salto by bucle.animateFloat(0f, 1f, infiniteRepeatable(tween(800, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "salto")
    val vaiven by bucle.animateFloat(-3f, 3f, infiniteRepeatable(tween(1600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "vaiven")
    Image(
        painterResource(R.drawable.luki_saltando), "Luki, la mascota de LukApp, saltando de alegría",
        modificador.graphicsLayer { translationY = -12.dp.toPx() * salto; rotationZ = vaiven },
    )
}

private val formaDestello: Path by lazy {
    // El destello de cuatro puntas del manual, en un lienzo de 24×24.
    Path().apply {
        moveTo(12f, 0f)
        cubicTo(12.9f, 6.2f, 17.8f, 11.1f, 24f, 12f)
        cubicTo(17.8f, 12.9f, 12.9f, 17.8f, 12f, 24f)
        cubicTo(11.1f, 17.8f, 6.2f, 12.9f, 0f, 12f)
        cubicTo(6.2f, 11.1f, 11.1f, 6.2f, 12f, 0f)
        close()
    }
}

/** Un destello titilando de fondo. */
@Composable
private fun Destello(color: Color, tamano: Dp, retraso: Float, modifier: Modifier) {
    val bucle = rememberInfiniteTransition(label = "destello")
    val fase by bucle.animateFloat(
        0f, 1f,
        infiniteRepeatable(tween(1200, delayMillis = 0, easing = FastOutSlowInEasing), RepeatMode.Reverse, androidx.compose.animation.core.StartOffset((retraso * 1000).toInt())),
        label = "fase",
    )
    Canvas(modifier.size(tamano).graphicsLayer { scaleX = 0.8f + 0.35f * fase; scaleY = scaleX; rotationZ = 20f * fase; alpha = 0.6f + 0.4f * fase }) {
        scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) { drawPath(formaDestello, color) }
    }
}

private enum class Forma { CINTA, CIRCULO, DESTELLO }

private class Papelito(
    var x: Float, var y: Float, var vx: Float, var vy: Float,
    var giro: Float, val velocidadGiro: Float, var vaiven: Float, val velocidadVaiven: Float,
    val tamano: Float, val color: Color, val forma: Forma,
)

private val COLORES_CONFETI = listOf(Morado, Lavanda, Lima, Magenta, Color.White, Lima, Morado)
private const val GRAVEDAD = 0.16f
private const val ROCE = 0.988f
private const val DURACION_MS = 5_200L

private fun azar(min: Float, max: Float) = min + Random.nextFloat() * (max - min)

private fun rafaga(x: Float, y: Float, cantidad: Int, angulo: Float, apertura: Float, fuerza: Float, densidad: Float) = List(cantidad) {
    val a = angulo + azar(-apertura, apertura)
    val v = fuerza * azar(0.55f, 1.05f)
    val forma = if (Random.nextFloat() < 0.55f) Forma.CINTA else if (Random.nextFloat() < 0.6f) Forma.CIRCULO else Forma.DESTELLO
    Papelito(
        x, y, cos(a) * v, sin(a) * v,
        azar(0f, 2 * PI.toFloat()), azar(-0.2f, 0.2f), azar(0f, 2 * PI.toFloat()), azar(0.05f, 0.14f),
        (if (forma == Forma.DESTELLO) azar(6f, 10f) else azar(5f, 9f)) * densidad,
        COLORES_CONFETI.random(), forma,
    )
}

/**
 * ConfetiMarca.tsx: dos cañones desde las esquinas de abajo y una lluvia suave desde
 * arriba, para que el confeti rodee la tarjeta en vez de taparla. La física es la de
 * la web, pensada a 60 cuadros: aquí se escala por el tiempo real de cada cuadro.
 */
@Composable
private fun ConfetiMarca(modifier: Modifier) {
    var papelitos by remember { mutableStateOf<List<Papelito>>(emptyList()) }
    var cuadro by remember { mutableLongStateOf(0L) }
    var desvanecer by remember { mutableStateOf(1f) }
    var tamanoLienzo by remember { mutableStateOf(Size.Zero) }
    val densidad = androidx.compose.ui.platform.LocalDensity.current.density.coerceAtMost(3f)

    LaunchedEffect(tamanoLienzo) {
        if (tamanoLienzo == Size.Zero || papelitos.isNotEmpty()) return@LaunchedEffect
        val (ancho, alto) = tamanoLienzo
        // Las velocidades de la web están en px CSS; aquí se pasan a px reales.
        val fuerza = (alto / densidad / 42f).coerceIn(14f, 22f) * densidad
        var lista = rafaga(0f, alto, 70, -PI.toFloat() / 3, 0.35f, fuerza, densidad) + rafaga(ancho, alto, 70, -2 * PI.toFloat() / 3, 0.35f, fuerza, densidad)
        var segundaOla = false
        val inicio = withFrameNanos { it }
        var anterior = inicio
        while (true) {
            val ahora = withFrameNanos { it }
            val transcurrido = (ahora - inicio) / 1_000_000L
            val pasos = ((ahora - anterior) / 16_666_667f).coerceIn(0.25f, 3f)
            anterior = ahora
            if (!segundaOla && transcurrido > 650) {
                segundaOla = true
                lista = lista + List(60) { rafaga(azar(0f, ancho), -20f * densidad, 1, PI.toFloat() / 2, 0.3f, 3f * densidad, densidad)[0] }
            }
            val roce = Math.pow(ROCE.toDouble(), pasos.toDouble()).toFloat()
            for (p in lista) {
                p.vx *= roce
                p.vy = p.vy * roce + GRAVEDAD * densidad * pasos
                p.x += (p.vx + sin(p.vaiven) * 0.6f * densidad) * pasos
                p.y += p.vy * pasos
                p.giro += p.velocidadGiro * pasos
                p.vaiven += p.velocidadVaiven * pasos
            }
            lista = lista.filter { it.y <= alto + 30f * densidad }
            papelitos = lista
            desvanecer = if (transcurrido > DURACION_MS - 1_200) ((DURACION_MS - transcurrido) / 1_200f).coerceAtLeast(0f) else 1f
            cuadro = ahora
            if (transcurrido >= DURACION_MS) { papelitos = emptyList(); break }
        }
    }

    Canvas(modifier.onSizeChanged { tamanoLienzo = Size(it.width.toFloat(), it.height.toFloat()) }) {
        @Suppress("UNUSED_EXPRESSION") cuadro // leerlo hace que el lienzo se redibuje en cada cuadro
        for (p in papelitos) {
            translate(p.x, p.y) {
                rotate(Math.toDegrees(p.giro.toDouble()).toFloat(), pivot = Offset.Zero) {
                    when (p.forma) {
                        // El coseno aplasta la cinta como si girara sobre su eje.
                        Forma.CINTA -> scale(1f, cos(p.vaiven), pivot = Offset.Zero) {
                            drawRect(p.color, Offset(-p.tamano / 2, -p.tamano * 0.9f), Size(p.tamano, p.tamano * 1.8f), alpha = desvanecer)
                        }
                        Forma.CIRCULO -> drawCircle(p.color, p.tamano / 2, Offset.Zero, alpha = desvanecer)
                        Forma.DESTELLO -> drawPath(destelloConfeti(p.tamano), p.color, alpha = desvanecer)
                    }
                }
            }
        }
    }
}

private fun destelloConfeti(r: Float) = Path().apply {
    for (i in 0 until 8) {
        val radio = if (i % 2 == 0) r else r * 0.34f
        val angulo = (PI / 4 * i).toFloat()
        if (i == 0) moveTo(cos(angulo) * radio, sin(angulo) * radio) else lineTo(cos(angulo) * radio, sin(angulo) * radio)
    }
    close()
}
