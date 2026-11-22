package app.lukapp.ui.dinero

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ADVERTENCIA_GMF
import app.lukapp.dominio.CuentaGmf
import app.lukapp.dominio.FrecuenciaPeriodo
import app.lukapp.dominio.NOTAS_GMF
import app.lukapp.dominio.RegimenGmf
import app.lukapp.dominio.TOPE_EXENTO_UVT
import app.lukapp.dominio.ValorUvt
import app.lukapp.dominio.consumoDelMes
import app.lukapp.dominio.cuentasParaGmf
import app.lukapp.dominio.formatAmountInput
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.monthKey
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.uvtDesactualizada
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/** Lo que el panel guarda en los ajustes de la cuenta (`useAjustesGmf`). */
class AccionesGmf(
    val cambiarUvt: (ValorUvt) -> Unit,
    val cambiarCuentas: (List<String>) -> Unit,
    val cambiarRegimen: (String) -> Unit,
    val cambiarCuentaExenta: (String?) -> Unit,
)

/**
 * PanelGmf.tsx. El 4x1000 explicado y estimado: el cupo exento del mes, cómo lo aplica tu banco, qué cuentas
 * cuentan y la UVT con la que se calcula. La advertencia de que quien liquida es el banco va arriba, no al final:
 * si la cifra no es oficial, decirlo después de leerla no sirve. Todo sale de `consumoDelMes`, igual que la web.
 */
@Composable
fun PantallaGmf(vista: VistaInicio, acciones: AccionesGmf, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ajustes = vista.ajustes
    val uvt = ajustes.uvt
    val anioActual = vista.hoy.take(4).toInt()
    // `mesCalendarioActivo` de LukAppApp.tsx: el 4x1000 se queda anclado al mes calendario sea cual sea el período.
    val clave = vista.clavePeriodo
    val mes = if (ajustes.periodo.frecuencia == FrecuenciaPeriodo.MENSUAL) monthKey(if (clave.length > 7) clave else "$clave-01") else vista.hoy.take(7)

    val cuentas = remember(vista.libro.cajitas) { cuentasParaGmf(vista.libro.cajitas) }
    val idsCubiertos = ajustes.cuentasGmf ?: cuentas.filter { it.esFinanciera }.map { it.id }
    val cubiertas = idsCubiertos.toSet()
    val consumo = remember(vista.libro, mes, uvt, idsCubiertos, ajustes.regimenGmf, ajustes.cuentaExentaGmf) {
        consumoDelMes(
            vista.libro.transacciones, mes, uvt, cubiertas, ajustes.regimenGmf, ajustes.cuentaExentaGmf,
            cuentas.filter { it.esBajoMonto }.map { it.id }.toSet(), vista.libro.movimientos,
        )
    }
    var editandoUvt by rememberSaveable { mutableStateOf(false) }
    var borrador by rememberSaveable { mutableStateOf("") }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("El 4x1000", Modifier.weight(1f), style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(ADVERTENCIA_GMF, Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft)

            // Cómo te lo aplica TU banco: los dos esquemas conviven en la práctica.
            Tarjeta {
                Text("¿Cómo te lo aplica tu banco?", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OpcionRegimen(
                        "Repartido entre mis cuentas", "Lo que dice la norma desde diciembre de 2024. El cupo es tuyo, no de una cuenta.",
                        ajustes.regimenGmf == RegimenGmf.DISTRIBUIDO,
                    ) { acciones.cambiarRegimen(RegimenGmf.DISTRIBUIDO) }
                    OpcionRegimen(
                        "Solo una cuenta marcada", "El esquema viejo. Úsalo si tu banco todavía te cobra en las demás cuentas.",
                        ajustes.regimenGmf == RegimenGmf.MARCADA,
                    ) { acciones.cambiarRegimen(RegimenGmf.MARCADA) }
                }
                if (ajustes.regimenGmf == RegimenGmf.MARCADA) {
                    Text("¿Cuál marcaste en el banco?", Modifier.padding(top = 12.dp), style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                    Box(Modifier.padding(top = 8.dp)) {
                        val actual = cuentas.firstOrNull { it.id == ajustes.cuentaExentaGmf }?.etiqueta ?: "Ninguna"
                        Desplegable(actual, listOf("Ninguna" to "") + cuentas.map { it.etiqueta to it.id }, "Cuenta que marcaste en el banco") { acciones.cambiarCuentaExenta(it.ifEmpty { null }) }
                    }
                }
            }

            // Cupo del mes
            Tarjeta {
                Text("Tu cupo exento este mes", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                Text(formatCop(consumo.disponibleCop), Modifier.padding(top = 4.dp), style = LukApp.tipo.de(28, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                Text("libres de ${formatCop(consumo.topeCop)} ($TOPE_EXENTO_UVT UVT)", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                Box(Modifier.padding(top = 12.dp).fillMaxWidth().height(8.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Has usado el ${app.lukapp.ui.mes.pctJs(consumo.pctUsado)}% del cupo" }) {
                    Box(Modifier.fillMaxWidth((consumo.pctUsado / 100.0).toFloat().coerceIn(0f, 1f)).height(8.dp).clip(CircleShape).background(if (consumo.pctUsado >= 100) c.salio else c.entro))
                }
                val negrita = SpanStyle(fontWeight = FontWeight.SemiBold, color = c.ink)
                val rojo = SpanStyle(fontWeight = FontWeight.SemiBold, color = c.salio)
                val texto: AnnotatedString = buildAnnotatedString {
                    append("Han salido "); withStyle(negrita) { append(formatCop(consumo.salidasCop)) }; append(" de tus cuentas financieras incluidas.")
                    if (consumo.sinCupoCop > 0) {
                        append(" Otros "); withStyle(negrita) { append(formatCop(consumo.sinCupoCop)) }; append(" salieron de cuentas sin cupo y pagan desde el primer peso.")
                    }
                    if (consumo.bajoMontoGravadoCop > 0) {
                        append(" Se excedió el tope de depósitos de bajo monto por "); withStyle(rojo) { append(formatCop(consumo.bajoMontoGravadoCop)) }; append(", que también pagan.")
                    }
                    if (consumo.gravadoCop > 0) {
                        append(" En total pagarían "); withStyle(rojo) { append("~${formatCop(consumo.gmfEstimadoCop)}") }
                        append(" de 4x1000 sobre ${formatCop(consumo.gravadoCop)}.")
                    }
                    if (consumo.salidasCop > 0 && consumo.gravadoCop == 0L) append(" Por ahora no se estima cobro: las salidas siguen dentro de los cupos exentos aplicables.")
                }
                Text(texto, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft)
            }

            // Cuentas que cuentan
            Tarjeta {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icono(Lucide.Landmark, tamano = 14.dp, grosor = 3f, color = c.inkSoft)
                    Text("¿Cuáles están en una entidad financiera?", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                }
                Text("Solo lo que sale de un banco, billetera o cooperativa consume cupo. El efectivo no.", Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
                if (cuentas.isEmpty()) {
                    Text(
                        "Todavía no tienes cuentas registradas. Créalas en Cuentas para marcar cuáles cobran GMF.",
                        Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(12.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint,
                    )
                } else {
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        cuentas.forEach { cu -> FilaCuenta(cu, cu.id in cubiertas) { acciones.cambiarCuentas(if (cu.id in cubiertas) idsCubiertos.filter { it != cu.id } else idsCubiertos + cu.id) } }
                    }
                }
            }

            // La UVT
            Tarjeta {
                Text("Valor de la UVT (${uvt.anio})", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                if (editandoUvt) {
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) { CampoTexto(borrador, { borrador = conPuntos(it) }, "0", "Valor de la UVT en pesos", numerico = true) }
                        Box(
                            Modifier.clip(Medidas.formaControl).background(c.accent).semantics { contentDescription = "Guardar la UVT" }.pulsable(alPulsar = {
                                val pesos = parseAmountInput(borrador)
                                if (pesos != null && pesos > 0) acciones.cambiarUvt(ValorUvt(anioActual, pesos, "Editado a mano"))
                                editandoUvt = false
                            }).padding(horizontal = 16.dp, vertical = 12.dp),
                        ) { Text("Guardar", style = LukApp.tipo.de(15, 600, 1.4f), color = c.onAccent) }
                    }
                } else {
                    Row(Modifier.padding(top = 4.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                        Text(formatCop(uvt.pesos), style = LukApp.tipo.de(28, 600, 1.2f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink)
                        Text(
                            "Cambiar",
                            Modifier.clip(CircleShape).background(c.soft).semantics { contentDescription = "Cambiar la UVT" }.pulsable(alPulsar = { borrador = formatAmountInput(uvt.pesos); editandoUvt = true }).padding(horizontal = 12.dp, vertical = 8.dp),
                            style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft,
                        )
                    }
                }
                if (uvt.fuente.isNotEmpty()) Text(uvt.fuente, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.4f), color = c.inkFaint)
                // La UVT cambia cada enero: calcular en silencio con la del año pasado daría un tope equivocado.
                if (uvtDesactualizada(uvt, anioActual)) {
                    Text(
                        "Este valor es de ${uvt.anio} y estamos en $anioActual. La DIAN publica uno nuevo cada diciembre — actualízalo o el cupo de arriba estará mal.",
                        Modifier.padding(top = 8.dp).fillMaxWidth().clip(Medidas.formaControl).background(c.warnBg).padding(12.dp),
                        style = LukApp.tipo.de(13, 400, 1.6f), color = c.warnInk,
                    )
                }
            }

            // Lo que dice la norma: cada afirmación con su fundamento y la fecha en que se verificó.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NOTAS_GMF.forEach { nota ->
                    var abierta by rememberSaveable(nota.id) { mutableStateOf(false) }
                    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).pulsable(escala = 1f, alPulsar = { abierta = !abierta }).padding(horizontal = 16.dp, vertical = 12.dp).semantics { contentDescription = nota.titulo }) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(nota.titulo, Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                            Icono(if (abierta) Lucide.ChevronUp else Lucide.ChevronDown, tamano = 16.dp, grosor = 2.5f, color = c.inkGhost)
                        }
                        if (abierta) {
                            Text(nota.cuerpo, Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft)
                            Text("${nota.fundamento} · verificado el ${nota.verificado}", Modifier.padding(top = 8.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Tarjeta(contenido: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(LukApp.colores.card).padding(16.dp)) { contenido() }
}

@Composable
private fun OpcionRegimen(titulo: String, nota: String, elegida: Boolean, alElegir: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaControl).border(2.dp, if (elegida) c.ink else c.line, Medidas.formaControl).background(if (elegida) c.bg else c.card)
            .semantics { contentDescription = titulo }.pulsable(escala = 1f, alPulsar = alElegir).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top,
    ) {
        Box(Modifier.padding(top = 3.dp).size(18.dp).clip(CircleShape).border(2.dp, if (elegida) c.accent else c.inkFaint, CircleShape), contentAlignment = Alignment.Center) {
            if (elegida) Box(Modifier.size(8.dp).clip(CircleShape).background(c.accent))
        }
        Column(Modifier.weight(1f)) {
            Text(titulo, style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
            Text(nota, Modifier.padding(top = 4.dp), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkFaint)
        }
    }
}

@Composable
private fun FilaCuenta(cuenta: CuentaGmf, incluida: Boolean, alAlternar: () -> Unit) {
    val c = LukApp.colores
    Row(
        Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.bg).semantics { contentDescription = "${cuenta.nombre} está en una entidad financiera" }
            .pulsable(escala = 1f, alPulsar = alAlternar).padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(cuenta.etiqueta, Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1)
        Checkbox(
            checked = incluida, onCheckedChange = null,
            colors = CheckboxDefaults.colors(checkedColor = c.entro, checkmarkColor = c.onIn, uncheckedColor = c.inkFaint),
        )
    }
}
