package app.lukapp.ui.mas

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.BeneficioPlan
import app.lukapp.dominio.DestinoBeneficio
import app.lukapp.dominio.GUIA_BENEFICIOS
import app.lukapp.dominio.fechaVencimientoRegalo
import app.lukapp.dominio.valorEnGrande
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.IconoLucide
import app.lukapp.ui.iconos.Lucide

/** El fondo de los momentos Premium: más oscuro que la tarjeta del regalo para que las tarjetas resalten. */
private val FondoPremium = Color(0xFF120527)

private val ICONOS_BENEFICIO: Map<String, IconoLucide> = mapOf(
    "dictado" to Lucide.Mic,
    "asesor_ia" to Lucide.Bot,
    "extracto" to Lucide.FileText,
    "espacios_compartidos" to Lucide.Share2,
    "integrantes_espacio" to Lucide.UsersRound,
    "insights_ia" to Lucide.Sparkles,
    "pulso_premium" to Lucide.Gauge,
)

/**
 * BeneficiosPremium.tsx: todo lo que trae Premium, explicado con calma. Se abre desde
 * la celebración del regalo y desde la tarjeta «Tu plan» de Cuenta, con la misma piel
 * morada de la celebración para que se sienta parte de ese mismo momento.
 * La compra de Premium vive en la web, así que aquí no hay botón de planes.
 */
@Composable
fun PantallaBeneficiosPremium(modelo: ModeloCuenta, alCerrar: () -> Unit, alIrA: (DestinoBeneficio) -> Unit) {
    BackHandler(onBack = alCerrar)
    val reducidas = animacionesReducidas()
    val estado by modelo.beneficios.collectAsState()
    val plan = (estado as? EstadoBeneficios.Listo)?.plan
    val esPremium = plan?.esPremium == true
    val esRegalo = plan?.esRegalo == true
    val beneficios = plan?.activos.orEmpty()

    Box(
        Modifier.fillMaxSize().background(FondoPremium).drawBehind { manchasDelFondo() }
            // Tapa lo de atrás: un toque en un hueco no debe caer en la app de abajo.
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
    ) {
        Column(Modifier.fillMaxSize()) {
            // Fija arriba: en una página larga uno tiene que poder volver sin subir hasta el principio.
            Row(
                Modifier.fillMaxWidth().background(FondoPremium.copy(alpha = 0.85f))
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    Modifier.heightIn(min = 40.dp).clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.10f))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
                        .pulsable(alPulsar = alCerrar)
                        .padding(start = 10.dp, end = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.ArrowLeft, tamano = 16.dp, grosor = 2.5f, color = Color.White.copy(alpha = 0.9f))
                    Text("Volver", style = estilo(14, FontWeight.SemiBold, color = Color.White.copy(alpha = 0.9f)))
                }
                Row(
                    Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.10f))
                        .border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Crown, tamano = 14.dp, grosor = 2.4f, color = Lima)
                    Text("LUKAPP PREMIUM", style = estilo(12, FontWeight.Bold, tracking = 0.12f, color = Color.White.copy(alpha = 0.85f)))
                }
            }

            Column(
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                    .windowInsetsPadding(WindowInsets.navigationBars),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = 860.dp).fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 40.dp)) {
                    Encabezado(reducidas, esPremium, plan?.suscripcion?.venceEn?.takeIf { esPremium }, esRegalo)

                    TituloSeccion("LO QUE INCLUYE", Modifier.padding(top = 32.dp)) {
                        if (plan != null) Text(
                            "${beneficios.size} ${if (beneficios.size == 1) "beneficio" else "beneficios"}",
                            style = estilo(13, FontWeight.Medium, color = Color.White.copy(alpha = 0.55f)),
                        )
                    }
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        when (estado) {
                            EstadoBeneficios.Cargando -> TarjetasCargando(reducidas)
                            EstadoBeneficios.Error -> ErrorBeneficios(alReintentar = modelo::cargarBeneficios)
                            is EstadoBeneficios.Listo -> beneficios.forEachIndexed { indice, beneficio ->
                                TarjetaBeneficio(beneficio, indice, reducidas, alIrA = if (esPremium) alIrA else null)
                            }
                        }
                    }

                    TituloSeccion("PREGUNTAS RÁPIDAS", Modifier.padding(top = 32.dp))
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (esRegalo) Pregunta(
                            "¿Me van a cobrar algo?",
                            "No. Es un regalo del equipo: no pedimos tarjeta y cuando termine no se cobra nada.",
                        )
                        Pregunta(
                            if (esPremium) "¿Qué pasa cuando se termine?" else "¿Y si después vuelvo al plan Normal?",
                            "Tu cuenta sigue en el plan Normal, que es gratis. Tus movimientos, cuentas y metas no se borran: lo que cambia son los cupos.",
                        )
                        Pregunta(
                            "¿Los cupos se renuevan?",
                            "Sí. Los cupos de cada mes —registros por voz, consultas al Asesor y extractos— vuelven a empezar el primer día del mes.",
                        )
                        Pregunta(
                            "¿Dónde veo mi plan?",
                            "En Más → Cuenta, en la tarjeta «Tu plan». Ahí ves hasta cuándo te dura y qué tienes activo.",
                        )
                        if (plan != null && !esPremium) Pregunta(
                            "¿Cómo me paso a Premium?",
                            "Entra a LukApp desde la web, en Más → Cuenta: ahí están los planes y precios. Apenas lo actives, también lo tienes aquí.",
                        )
                    }

                    Row(
                        Modifier.padding(top = 32.dp).fillMaxWidth().heightIn(min = 48.dp)
                            .shadow(14.dp, RoundedCornerShape(16.dp), ambientColor = Morado, spotColor = Morado)
                            .clip(RoundedCornerShape(16.dp)).background(Morado)
                            .pulsable(alPulsar = alCerrar)
                            .padding(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (plan != null && !esPremium) {
                            Text("Entendido", style = estilo(16, FontWeight.Bold))
                        } else {
                            Icono(Lucide.Sparkles, tamano = 18.dp, grosor = 2.4f, color = Color.White)
                            Text("¡A disfrutarlo!", style = estilo(16, FontWeight.Bold))
                        }
                    }
                }
            }
        }
    }
}

/** Las manchas de luz de la web (`blur-3xl`), quietas detrás de todo mientras el contenido se desplaza. */
private fun DrawScope.manchasDelFondo() {
    fun mancha(color: Color, centro: Offset, radio: Float) =
        drawCircle(Brush.radialGradient(listOf(color, Color.Transparent), center = centro, radius = radio), radio, centro)
    mancha(Morado.copy(alpha = 0.45f), Offset(64.dp.toPx(), 64.dp.toPx()), 190.dp.toPx())
    mancha(Magenta.copy(alpha = 0.22f), Offset(size.width - 48.dp.toPx(), 300.dp.toPx()), 170.dp.toPx())
    mancha(Lima.copy(alpha = 0.10f), Offset(size.width * 0.45f, size.height - 40.dp.toPx()), 190.dp.toPx())
}

@Composable
private fun Encabezado(reducidas: Boolean, esPremium: Boolean, venceEn: String?, esRegalo: Boolean) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        LukiSaltando(reducidas, Modifier.padding(top = 4.dp).height(104.dp))
        Text(
            if (esPremium) "Todo lo que trae tu" else "Todo lo que trae",
            Modifier.padding(top = 12.dp).semantics { heading() },
            style = estilo(30, FontWeight.ExtraBold, alto = 1.08f, tracking = -0.035f),
            textAlign = TextAlign.Center,
        )
        // La píldora va aparte: un fondo con giro no cabe dentro de un texto en Compose.
        Text(
            "Premium",
            Modifier.padding(top = 6.dp).rotate(-2f)
                .shadow(10.dp, RoundedCornerShape(12.dp), ambientColor = Lima, spotColor = Lima)
                .background(Lima, RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 2.dp),
            style = estilo(30, FontWeight.ExtraBold, alto = 1.08f, tracking = -0.035f, color = Noche),
        )
        Text(
            "Más cupo para anotar por voz, hablar con el Asesor e importar extractos, y herramientas que te ayudan a decidir antes de gastar.",
            Modifier.padding(top = 16.dp).widthIn(max = 420.dp),
            style = estilo(15, FontWeight.Normal, alto = 1.6f, color = Color.White.copy(alpha = 0.75f)),
            textAlign = TextAlign.Center,
        )
        if (venceEn != null) {
            Row(
                Modifier.padding(top = 16.dp).clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.07f))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icono(if (esRegalo) Lucide.Gift else Lucide.CalendarCheck, tamano = 16.dp, grosor = 2.3f, color = Lima)
                Text(
                    buildAnnotatedString {
                        append(if (esRegalo) "Regalo del equipo · activo hasta el " else "Activo hasta el ")
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = Color.White)) { append(fechaVencimientoRegalo(venceEn)) }
                    },
                    style = estilo(13, FontWeight.Medium, color = Color.White.copy(alpha = 0.85f)),
                )
            }
        }
    }
}

@Composable
private fun TituloSeccion(texto: String, modifier: Modifier = Modifier, extra: @Composable () -> Unit = {}) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
        Text(texto, Modifier.semantics { heading() }, style = estilo(13, FontWeight.Bold, tracking = 0.12f, color = LavandaClara))
        extra()
    }
}

@Composable
private fun TarjetasCargando(reducidas: Boolean) {
    val brillo = if (reducidas) 0.7f else {
        val bucle = rememberInfiniteTransition(label = "cargando")
        bucle.animateFloat(0.45f, 1f, infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "brillo").value
    }
    Column(
        Modifier.semantics(mergeDescendants = true) { contentDescription = "Cargando los beneficios" },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(4) {
            Box(
                Modifier.fillMaxWidth().height(178.dp).alpha(brillo).clip(RoundedCornerShape(24.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(24.dp)),
            )
        }
    }
}

@Composable
private fun ErrorBeneficios(alReintentar: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("No pudimos cargar los beneficios.", style = estilo(15, FontWeight.SemiBold), textAlign = TextAlign.Center)
        Text(
            "Revisa tu conexión e inténtalo otra vez.",
            Modifier.padding(top = 4.dp),
            style = estilo(13, FontWeight.Normal, color = Color.White.copy(alpha = 0.65f)),
            textAlign = TextAlign.Center,
        )
        Row(
            Modifier.padding(top = 16.dp).heightIn(min = 40.dp).clip(CircleShape)
                .background(Color.White.copy(alpha = 0.12f))
                .pulsable(alPulsar = alReintentar)
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(Lucide.RefreshCw, tamano = 16.dp, grosor = 2.4f, color = Color.White)
            Text("Reintentar", style = estilo(14, FontWeight.SemiBold))
        }
    }
}

@Composable
private fun TarjetaBeneficio(beneficio: BeneficioPlan, indice: Int, reducidas: Boolean, alIrA: ((DestinoBeneficio) -> Unit)?) {
    val guia = GUIA_BENEFICIOS[beneficio.clave]
    val aparicion = remember { Animatable(if (reducidas) 1f else 0f) }
    LaunchedEffect(Unit) { aparicion.animateTo(1f, tween(350, delayMillis = 50 * indice, easing = FastOutSlowInEasing)) }

    Column(
        Modifier.fillMaxWidth()
            .graphicsLayer { alpha = aparicion.value; translationY = (1f - aparicion.value) * 14.dp.toPx() }
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Color.White.copy(alpha = 0.09f), Color.White.copy(alpha = 0.03f))))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp))
            .padding(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                Modifier.size(44.dp).clip(RoundedCornerShape(16.dp))
                    .background(Morado.copy(alpha = 0.35f))
                    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icono(ICONOS_BENEFICIO[beneficio.clave] ?: Lucide.Sparkles, tamano = 20.dp, grosor = 2.3f, color = Lima)
            }
            Column(Modifier.weight(1f)) {
                Text(beneficio.titulo, style = estilo(16, FontWeight.Bold, alto = 1.2f))
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontSize = estilo(18, FontWeight.ExtraBold).fontSize, fontWeight = FontWeight.ExtraBold, color = Color.White)) {
                            append(valorEnGrande(beneficio))
                        }
                        if (beneficio.detalle.isNotEmpty()) append("  ${beneficio.detalle}")
                    },
                    Modifier.padding(top = 4.dp),
                    style = estilo(13, FontWeight.Normal, alto = 1.4f, color = Color.White.copy(alpha = 0.6f)),
                )
            }
        }
        if (guia != null) Text(
            guia.explicacion,
            Modifier.padding(top = 12.dp),
            style = estilo(14, FontWeight.Normal, alto = 1.6f, color = Color.White.copy(alpha = 0.75f)),
        )
        if (guia != null && alIrA != null) {
            Row(
                Modifier.padding(top = 12.dp).heightIn(min = 40.dp).clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.10f))
                    .pulsable(alPulsar = { alIrA(guia.destino) })
                    .padding(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(guia.accion, style = estilo(13, FontWeight.SemiBold))
                Icono(Lucide.ArrowRight, tamano = 14.dp, grosor = 2.5f, color = Color.White)
            }
        }
    }
}

/** Los `<details>` de la web: una pregunta que se despliega al tocarla. */
@Composable
private fun Pregunta(titulo: String, respuesta: String) {
    var abierta by rememberSaveable(titulo) { mutableStateOf(false) }
    val giro by animateFloatAsState(if (abierta) 180f else 0f, tween(200), label = "giro")
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = if (abierta) 0.08f else 0.05f))
            .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(16.dp))
            .clickable(role = Role.Button, onClickLabel = if (abierta) "Ocultar respuesta" else "Ver respuesta") { abierta = !abierta }
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(titulo, Modifier.weight(1f), style = estilo(15, FontWeight.SemiBold))
            Icono(Lucide.ChevronDown, tamano = 16.dp, grosor = 2.4f, color = Color.White.copy(alpha = 0.6f), modifier = Modifier.rotate(giro))
        }
        AnimatedVisibility(abierta, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
            Text(
                respuesta,
                Modifier.padding(top = 8.dp),
                style = estilo(14, FontWeight.Normal, alto = 1.6f, color = Color.White.copy(alpha = 0.72f)),
            )
        }
    }
}
