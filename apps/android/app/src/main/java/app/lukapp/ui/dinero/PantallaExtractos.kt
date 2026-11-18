package app.lukapp.ui.dinero

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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.AnalisisResultado
import app.lukapp.dominio.MovimientoExtraido
import app.lukapp.dominio.MotivoExclusion
import app.lukapp.dominio.RevisionDudosa
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.crearRevisionesImportacion
import app.lukapp.dominio.cuentasParaGmf
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.metricasCoherentes
import app.lukapp.dominio.planearImportacion
import app.lukapp.dominio.rebanadasDelAnalisis
import app.lukapp.dominio.totalesDelAnalisis
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

/** Lo que Importar extractos escribe en el libro; cada una devuelve si se guardó. */
class AccionesExtractos(
    val importar: suspend (List<Transaccion>, List<RevisionDudosa>) -> Boolean,
    val completar: suspend (Transaccion) -> Boolean,
)

/**
 * AnalistaView.tsx. Se sube el PDF del banco, el servidor lo lee y aquí se revisa antes de guardar nada: cuántos movimientos
 * son nuevos, cuáles ya estaban, cuáles «quizá» son los mismos que anotaste a mano (se decide uno por uno) y cuáles no
 * cuentan (traslados propios, pagos de tarjeta, reversos). Nada entra al historial sin pulsar «Importar», y lo dudoso
 * exige confirmar. Por ahora solo PDF.
 */
@Composable
fun PantallaExtractos(vista: VistaInicio, modelo: ModeloExtractos, acciones: AccionesExtractos, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val trabajos by modelo.trabajos.collectAsState()
    val cuentas = remember(vista.libro.cajitas) { cuentasParaGmf(vista.libro.cajitas) }
    var cuentaId by rememberSaveable { mutableStateOf(if (cuentas.size == 1) cuentas[0].id else "") }
    var historico by rememberSaveable { mutableStateOf(false) }
    var ahora by remember { mutableStateOf(System.currentTimeMillis()) }
    val selector = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> if (uris.isNotEmpty()) modelo.elegir(uris) }
    // Un solo reloj para todos los «van Ns», en vez de uno por trabajo.
    val hayEnCurso = trabajos.any { it.fase == FaseTrabajo.SUBIENDO }
    LaunchedEffect(hayEnCurso) { while (hayEnCurso) { delay(1000); ahora = System.currentTimeMillis() } }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Importar extractos", style = LukApp.tipo.titulo, color = c.ink)
                Text("Sube el PDF, la foto o la hoja que te manda el banco", style = LukApp.tipo.xs, color = c.inkSoft)
            }
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.card).padding(horizontal = 24.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icono(Lucide.FileText, tamano = 36.dp, color = c.inkFaint)
                Text("Sube tus extractos", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(20, 600, 1.3f), color = c.ink)
                Text("Elige PDF, fotos, Excel .xlsx o CSV; puedes elegir varios. Hasta 4 MB cada archivo.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft, textAlign = TextAlign.Center)
                Row(
                    Modifier.padding(top = 20.dp).clip(CircleShape).background(c.accent).semantics { contentDescription = "Elegir archivos" }.pulsable(alPulsar = { selector.launch(arrayOf("*/*")) }).padding(horizontal = 28.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.FileUp, tamano = 16.dp, grosor = 3f, color = c.onAccent)
                    Text("Elegir archivos", style = LukApp.tipo.de(17, 600, 1.2f), color = c.onAccent)
                }
                Text(
                    "Los PDF se leen en el servidor de LukApp y descuentan de tu plan; las fotos, hojas Excel y CSV se leen en este teléfono y no se envían a ningún lado. Revisa cada fila y sus posibles duplicados antes de guardar. Si un PDF tiene contraseña, te la pedimos aquí mismo y no la guardamos.",
                    Modifier.padding(top = 16.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint,
                )
            }

            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
                Text("¿A qué cuenta de LukApp pertenece este extracto?", style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                Box(Modifier.padding(top = 8.dp)) {
                    Desplegable(cuentas.firstOrNull { it.id == cuentaId }?.nombre ?: "Selecciona una cuenta", cuentas.map { it.nombre to it.id }, "Cuenta del extracto") { cuentaId = it }
                }
                Text("Puedes importar los movimientos como actividad actual o conservar un historial antiguo sin alterar el saldo de hoy.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint)
                Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).pulsable(escala = 1f, alPulsar = { historico = !historico }).padding(12.dp), verticalAlignment = Alignment.Top) {
                    Checkbox(checked = historico, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint))
                    Column(Modifier.padding(start = 8.dp)) {
                        Text("Importar como historial antiguo", style = LukApp.tipo.de(13, 700, 1.4f), color = c.ink)
                        Text("Los movimientos aparecerán en tus reportes, pero no sumarán ni restarán del saldo actual de la cuenta.", style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
                    }
                }
            }

            trabajos.forEach { t ->
                when (t.fase) {
                    FaseTrabajo.SUBIENDO -> {
                        val s = maxOf(0L, (ahora - t.inicio) / 1000)
                        Row(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("⏳", style = LukApp.tipo.de(20, 400, 1.2f))
                            Column(Modifier.weight(1f)) {
                                Text(t.nombre, style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink, maxLines = 1)
                                Text(if (s > 0) "Leyendo tu extracto… van ${s}s" else "Leyendo tu extracto…", style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft)
                            }
                        }
                    }
                    FaseTrabajo.ESPERANDO_CONTRASENA -> TrabajoConContrasena(t, modelo)
                    FaseTrabajo.ERROR -> Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).padding(20.dp)) {
                        Text(t.nombre, style = LukApp.tipo.de(13, 600, 1.4f), color = c.salio, maxLines = 1)
                        Text(t.mensaje.orEmpty(), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.5f), color = c.salio)
                        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (t.reintentable) Boton("Reintentar", c.card, c.salio) { modelo.reintentar(t.id) }
                            Boton("Quitar", Color.Transparent, c.inkSoft) { modelo.quitar(t.id) }
                        }
                    }
                    FaseTrabajo.LISTO -> TrabajoListo(t, vista, cuentaId.ifEmpty { null }, historico, acciones) { modelo.quitar(t.id) }
                }
            }
            if (trabajos.isNotEmpty()) Text("Puedes seguir eligiendo más extractos mientras estos terminan.", Modifier.fillMaxWidth(), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun Boton(texto: String, fondo: Color, tinta: Color, alPulsar: () -> Unit) {
    Text(texto, Modifier.clip(CircleShape).background(fondo).semantics { contentDescription = texto }.pulsable(escala = 1f, alPulsar = alPulsar).padding(horizontal = 16.dp, vertical = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = tinta)
}

@Composable
private fun TrabajoConContrasena(t: TrabajoExtracto, modelo: ModeloExtractos) {
    val c = LukApp.colores
    var clave by remember(t.id) { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).padding(20.dp)) {
        Text(t.nombre, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
        Text("${t.mensaje.orEmpty()} La usamos solo para abrir este PDF; no se guarda en LukApp.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
        val estilo = LukApp.tipo.de(17, 400, 1.3f)
        BasicTextField(
            value = clave, onValueChange = { clave = it }, singleLine = true, textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent),
            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.padding(top = 12.dp).fillMaxWidth().semantics { contentDescription = "Contraseña del extracto" }.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).background(c.card).padding(12.dp),
            decorationBox = { interno -> Box { if (clave.isEmpty()) Text("Contraseña del extracto", style = estilo, color = c.inkGhost); interno() } },
        )
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Desbloquear PDF", Modifier.alpha(if (clave.isEmpty()) 0.4f else 1f).clip(CircleShape).background(c.accent).semantics { contentDescription = "Desbloquear PDF" }
                    // Se vacía antes de mandarla: nunca queda asociada al trabajo ni se reutiliza en otro extracto.
                    .pulsable(alPulsar = { if (clave.isNotEmpty()) { val k = clave; clave = ""; modelo.desbloquear(t.id, k) } }).padding(horizontal = 16.dp, vertical = 8.dp),
                style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent,
            )
            Boton("Quitar extracto", Color.Transparent, c.inkSoft) { modelo.quitar(t.id) }
        }
    }
}

@Composable
private fun TrabajoListo(t: TrabajoExtracto, vista: VistaInicio, cuentaId: String?, historico: Boolean, acciones: AccionesExtractos, alQuitar: () -> Unit) {
    val c = LukApp.colores
    val r = t.resultado ?: return
    val ambito = rememberCoroutineScope()
    var contraido by rememberSaveable(t.id) { mutableStateOf(false) }
    var importado by rememberSaveable(t.id) { mutableStateOf(0) }
    var verPosibles by rememberSaveable(t.id) { mutableStateOf(false) }
    var confirmarDudosos by rememberSaveable(t.id) { mutableStateOf(false) }
    var revisionesGuardadas by rememberSaveable(t.id) { mutableStateOf(false) }
    var aceptados by rememberSaveable(t.id) { mutableStateOf(setOf<String>()) }
    var ocupado by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Se recalcula contra el libro de AHORA: importar el extracto A hace que el B ya no ofrezca como nuevas las mismas filas.
    val plan = remember(r, vista.libro.transacciones, cuentaId) { planearImportacion(r.movimientos, vista.libro.transacciones, { UUID.randomUUID().toString() }, cuentaId = cuentaId) }
    val dudosos = remember(r) { r.movimientos.filter { it.confianza != "alta" } }
    val aImportar = plan.nuevos.size + aceptados.size
    val soloTraslados = aImportar == 0 && plan.excluidos.any { it.exclusion == MotivoExclusion.TRASLADO_PROPIO }

    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(20.dp)) {
        error?.let { Text(it, Modifier.padding(bottom = 8.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.salio) }
        Row(Modifier.fillMaxWidth().pulsable(escala = 1f, alPulsar = { contraido = !contraido }), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icono(Lucide.Check, tamano = 20.dp, grosor = 2.5f, color = c.entro)
            Column(Modifier.weight(1f)) {
                Text(t.nombre, style = LukApp.tipo.de(17, 600, 1.3f), color = c.ink, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(r.periodo.etiqueta + if (importado > 0) " · $importado importado${if (importado == 1) "" else "s"}" else "", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkFaint)
                Text(if (r.entidad != null) "Banco identificado: ${r.entidad}" else "Banco no identificado con certeza", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
            }
            Icono(if (contraido) Lucide.ChevronDown else Lucide.ChevronUp, tamano = 16.dp, grosor = 3f, color = c.inkFaint)
            Box(Modifier.size(32.dp).semantics { contentDescription = "Quitar ${t.nombre} de la lista" }.pulsable(escala = 1f, alPulsar = alQuitar), contentAlignment = Alignment.Center) { Icono(Lucide.X, tamano = 14.dp, grosor = 3f, color = c.inkGhost) }
        }
        if (contraido) return@Column

        Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(16.dp)) {
                Text("Importar a tu historial", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                Row(Modifier.padding(top = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Conteo("Nuevos", plan.nuevos.size, c.entro, Modifier.weight(1f))
                    Conteo("Quizá repetidos", plan.posibles.size, c.warnInk, Modifier.weight(1f))
                    Conteo("Ya estaban", plan.duplicados.size, c.inkSoft, Modifier.weight(1f))
                    Conteo("No cuentan", plan.excluidos.size, c.inkFaint, Modifier.weight(1f))
                }

                if (plan.posibles.isNotEmpty() && importado == 0) Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).padding(12.dp)) {
                    Text(
                        "${plan.posibles.size} movimiento${if (plan.posibles.size == 1) "" else "s"} del extracto ${if (plan.posibles.size == 1) "cae" else "caen"} el mismo día y por el mismo monto que algo que ya tienes, pero con otro texto. Puede ser lo mismo que anotaste a mano — o dos gastos iguales de verdad.",
                        style = LukApp.tipo.de(13, 400, 1.5f), color = c.warnInk,
                    )
                    Text(if (verPosibles) "Ocultar" else "Revisarlos uno por uno", Modifier.padding(top = 8.dp).pulsable(escala = 1f, alPulsar = { verPosibles = !verPosibles }), style = LukApp.tipo.de(13, 600, 1.4f), color = c.warnInk)
                    if (verPosibles) plan.posibles.forEach { p ->
                        val marcado = p.clave in aceptados
                        Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.card).padding(12.dp)) {
                            Text("Ya tienes: ${p.yaTengo.description}", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                            Text("El extracto dice: ${p.movimiento.descripcion}", style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                            Row(Modifier.padding(top = 8.dp).fillMaxWidth().pulsable(escala = 1f, alPulsar = { aceptados = if (marcado) aceptados - p.clave else aceptados + p.clave }), verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = marcado, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint))
                                Text("Son distintos, impórtalo también", Modifier.padding(start = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                            }
                            Text(
                                "Completar este movimiento",
                                Modifier.padding(top = 8.dp).clip(CircleShape).background(c.entroBg).semantics { contentDescription = "Completar este movimiento" }.pulsable(alPulsar = {
                                    ambito.launch {
                                        val completado = p.yaTengo.copy(
                                            description = p.movimiento.descripcion, category = p.movimiento.categoria, cuentaId = p.yaTengo.cuentaId ?: cuentaId,
                                            rawTranscript = "${p.yaTengo.rawTranscript} · extracto: ${p.movimiento.descripcion}".trim(),
                                        )
                                        error = if (acciones.completar(completado)) null else "No se pudo guardar. Inténtalo de nuevo."
                                    }
                                }).padding(horizontal = 12.dp, vertical = 8.dp),
                                style = LukApp.tipo.de(13, 600, 1.4f), color = c.entro,
                            )
                        }
                    }
                }

                if (dudosos.isNotEmpty() && importado == 0) Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.salioBg).padding(12.dp)) {
                    Text(
                        "El lector marcó ${dudosos.size} fila${if (dudosos.size == 1) "" else "s"} con confianza media o baja (una foto puede confundir cifras). Comprueba fecha, detalle y monto en cada una antes de importar.",
                        style = LukApp.tipo.de(13, 400, 1.5f), color = c.salio,
                    )
                    Row(Modifier.padding(top = 12.dp).fillMaxWidth().pulsable(escala = 1f, alPulsar = { confirmarDudosos = !confirmarDudosos }), verticalAlignment = Alignment.Top) {
                        Checkbox(checked = confirmarDudosos, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.salio))
                        Text("Revisé los movimientos reconocidos y quiero importarlos", Modifier.padding(start = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.salio)
                    }
                }

                if (revisionesGuardadas) Text(
                    if (importado > 0) "Importaste $importado movimiento${if (importado == 1) "" else "s"} y guardaste lo pendiente en Revisar movimientos." else "Guardamos las filas dudosas en Revisar movimientos para que puedas volver a ellas.",
                    Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.entroBg).padding(12.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.entro,
                ) else if (importado > 0) Text(
                    "Importaste $importado movimiento${if (importado == 1) "" else "s"}.",
                    Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.entroBg).padding(12.dp), style = LukApp.tipo.de(15, 600, 1.4f), color = c.entro,
                ) else {
                    val bloqueado = ocupado || cuentaId == null || (aImportar == 0 && !soloTraslados) || (dudosos.isNotEmpty() && !confirmarDudosos)
                    val texto = when {
                        dudosos.isNotEmpty() && !confirmarDudosos -> "Revisa las filas antes de importar"
                        cuentaId == null -> "Elige la cuenta para importar"
                        soloTraslados -> "Guardar transferencias para revisar"
                        aImportar == 0 -> "Nada nuevo por importar"
                        else -> "${if (historico) "Guardar en historial" else "Importar"} $aImportar movimiento${if (aImportar == 1) "" else "s"}"
                    }
                    Text(
                        if (ocupado) "Guardando…" else texto,
                        Modifier.padding(top = 12.dp).fillMaxWidth().alpha(if (bloqueado) 0.3f else 1f).clip(CircleShape).background(c.accent).semantics { contentDescription = "Importar movimientos" }
                            .pulsable(alPulsar = {
                                if (!bloqueado) ambito.launch {
                                    ocupado = true
                                    val extra = plan.posibles.filter { it.clave in aceptados }
                                    val total = (plan.nuevos + extra.map { it.transaccion }).map { it.copy(afectaSaldo = if (historico) false else it.afectaSaldo) }
                                    val revisiones = crearRevisionesImportacion(
                                        t.id, t.nombre, total, dudosos, extra, plan.excluidos.filter { it.exclusion == MotivoExclusion.TRASLADO_PROPIO }, java.time.Instant.now().toString(),
                                    )
                                    if (acciones.importar(total, revisiones)) { importado = total.size; revisionesGuardadas = revisiones.isNotEmpty(); error = null }
                                    else error = "No se pudo guardar. Inténtalo de nuevo."
                                    ocupado = false
                                }
                            }).padding(horizontal = 24.dp, vertical = 12.dp),
                        style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent, textAlign = TextAlign.Center,
                    )
                }
                if (plan.duplicados.isNotEmpty() && plan.nuevos.isNotEmpty()) Text("${plan.duplicados.size} ya estaban en tu historial y no se van a duplicar.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint)
            }
            ReporteExtracto(r, vista)
        }
    }
}

@Composable
private fun Conteo(etiqueta: String, n: Int, color: Color, m: Modifier) {
    val c = LukApp.colores
    Column(m.clip(Medidas.formaControl).background(c.card).padding(horizontal = 4.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$n", style = LukApp.tipo.de(20, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = color)
        Text(etiqueta, style = LukApp.tipo.de(11, 600, 1.2f), color = c.inkSoft, textAlign = TextAlign.Center)
    }
}

/** AnalistaReporte.tsx: el veredicto, los totales (recalculados desde las filas, no los del texto), lo que no se sumó y por qué, y el detalle. */
@Composable
private fun ReporteExtracto(r: AnalisisResultado, vista: VistaInicio) {
    val c = LukApp.colores
    val totales = totalesDelAnalisis(r.movimientos)
    val gastos = rebanadasDelAnalisis(r.movimientos, "gasto")
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Tarjeta {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Veredicto", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
                Text(r.periodo.etiqueta, Modifier.clip(CircleShape).background(c.soft).padding(horizontal = 12.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
            }
            Text(r.veredicto, Modifier.padding(top = 12.dp), style = LukApp.tipo.de(17, 400, 1.5f), color = c.ink)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Cifra("Ingresos", totales.ingresos, c.entro, Modifier.weight(1f))
            Cifra("Gastos", totales.gastos, c.salio, Modifier.weight(1f))
            Cifra("Balance", totales.balance, if (totales.balance >= 0) c.entro else c.salio, Modifier.weight(1f))
        }
        if (totales.excluidos.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.soft).padding(20.dp)) {
            Text("No se sumó a los totales", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            Text("Sumar estas líneas contaría dos veces la misma plata.", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkSoft)
            totales.excluidos.forEach { e ->
                Row(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.card).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${e.motivo} (${e.cuantos})", Modifier.weight(1f), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                    Text(formatCop(e.montoCop), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkSoft)
                }
            }
        }
        if (!metricasCoherentes(r)) Text(
            "La tabla de métricas no cuadra con los movimientos extraídos. Los totales de arriba se calcularon desde los movimientos, que se pueden auditar línea por línea.",
            Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.warnBg).padding(16.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.warnInk,
        )
        if (gastos.isNotEmpty()) Tarjeta {
            Text("En qué se fue", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            gastos.forEach { s ->
                val cat = vista.catalogo.de(s.categoria)
                Column(Modifier.padding(top = 12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${cat.emoji} ${cat.nombre}", Modifier.weight(1f), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink, maxLines = 1)
                        Text("${formatCop(s.total)} · ${app.lukapp.ui.mes.pctJs(s.pct)}%", style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                    }
                    Box(Modifier.padding(top = 6.dp).fillMaxWidth().height(8.dp).clip(CircleShape).background(c.soft)) {
                        Box(Modifier.fillMaxWidth(maxOf(s.total.toFloat() / gastos[0].total, 0.04f)).height(8.dp).clip(CircleShape).background(c.inkSoft))
                    }
                }
            }
        }
        Tarjeta {
            Text("Movimientos reconocidos", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            Text("Revisa el detalle antes de importar.", style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
            r.movimientos.forEach { m -> FilaMovimiento(m, vista) }
        }
        if (r.alertas.isNotEmpty()) Tarjeta {
            Text("Alertas", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            r.alertas.forEach { a ->
                val (fondo, tinta) = when (a.severidad) { "alta" -> c.salioBg to c.salio; "media" -> c.warnBg to c.warnInk; else -> c.soft to c.inkSoft }
                Column(Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(fondo).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text(a.titulo, style = LukApp.tipo.de(13, 600, 1.4f), color = tinta)
                    Text(a.detalle, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.5f), color = tinta)
                }
            }
        }
        if (r.recomendaciones.isNotEmpty()) Tarjeta {
            Text("Qué puedes hacer", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            r.recomendaciones.forEachIndexed { i, rec ->
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(24.dp).clip(Medidas.formaControl).background(c.soft), contentAlignment = Alignment.Center) { Text("${i + 1}", style = LukApp.tipo.de(13, 600, 1.2f), color = c.inkSoft) }
                    Column(Modifier.weight(1f)) {
                        Text(rec.titulo, style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink)
                        Text(rec.detalle, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(15, 400, 1.5f), color = c.inkSoft)
                        rec.ahorroMensualCop?.let { Text("Ahorras ~${formatCop(Math.round(it))}/mes", Modifier.padding(top = 8.dp).clip(CircleShape).background(c.entroBg).padding(horizontal = 12.dp, vertical = 4.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.entro) }
                    }
                }
            }
        }
        if (r.advertencias.isNotEmpty()) Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(20.dp)) {
            Text("Lo que no quedó claro", style = LukApp.tipo.de(15, 600, 1.4f), color = c.inkSoft)
            r.advertencias.forEach { Text("· $it", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(15, 400, 1.5f), color = c.inkSoft) }
        }
        Text("Análisis informativo, no asesoría financiera certificada.", Modifier.padding(horizontal = 4.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint)
    }
}

@Composable
private fun Tarjeta(contenido: @Composable () -> Unit) { Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(LukApp.colores.card).padding(20.dp)) { contenido() } }

@Composable
private fun Cifra(etiqueta: String, valor: Long, color: Color, m: Modifier) {
    val c = LukApp.colores
    Column(m.clip(Medidas.formaCard).background(c.card).padding(12.dp)) {
        Text(etiqueta, style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
        Text(formatCop(valor), style = LukApp.tipo.de(15, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = color, maxLines = 1)
    }
}

@Composable
private fun FilaMovimiento(m: MovimientoExtraido, vista: VistaInicio) {
    val c = LukApp.colores
    Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.soft).padding(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(m.descripcion, Modifier.weight(1f), style = LukApp.tipo.de(13, 600, 1.4f), color = c.ink, maxLines = 1)
            Text("${if (m.tipo == "ingreso") "+" else "-"}${formatCop(m.montoCop)}", Modifier.padding(start = 8.dp), style = LukApp.tipo.de(13, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = if (m.tipo == "ingreso") c.entro else c.salio)
        }
        Text("${m.fecha} · ${vista.catalogo.de(m.categoria).nombre}${m.contraparte?.let { " · $it" } ?: ""}", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkSoft)
        m.detalle?.takeIf { it.isNotEmpty() }?.let { Text(it, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint) }
    }
}
