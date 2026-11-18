package app.lukapp.ui.dinero

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Cajita
import app.lukapp.dominio.ClaseCuenta
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.calcularRacha
import app.lukapp.dominio.claseDeCuenta
import app.lukapp.dominio.componerCuentas
import app.lukapp.dominio.entidadDeCuenta
import app.lukapp.dominio.etiquetaTipoCajita
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.monthKey
import app.lukapp.dominio.nombreVisibleCuenta
import app.lukapp.dominio.patrimonio
import app.lukapp.dominio.resumenTarjeta
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.totalPorTipo
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.BotonRedondo
import app.lukapp.ui.comun.IconoCuenta
import app.lukapp.ui.comun.colorHex
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.inicio.CIFRAS_TABULARES
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlin.math.abs
import kotlin.math.min

private data class Grupo(val tipo: String, val titulo: String, val inversion: Boolean? = null)

/** `GRUPOS` de DineroView.tsx, en el mismo orden. */
private val GRUPOS = listOf(
    Grupo(TipoCajita.CUENTA, "Cuentas"),
    Grupo(TipoCajita.CAJITA, "🐷 Ahorro disponible", inversion = false),
    Grupo(TipoCajita.CAJITA, "📈 Inversiones", inversion = true),
    Grupo(TipoCajita.TARJETA, "Tarjetas de crédito"),
    Grupo(TipoCajita.DEUDA, "Deudas"),
)

/** `estiloEntidad`: los colores que una fila con marca le impone a su contenido. */
private data class EstiloEntidad(val fondo: Color, val texto: Color, val velo: Double?)

/**
 * DineroView.tsx. Lo que abre otras pantallas (detalle de cuenta, tarjetas,
 * crear cuenta o ahorro, metas, extractos y herramientas compartidas) aparece
 * solo cuando su destino está migrado; mientras tanto se omite, sin botones
 * que no hagan nada (docs/android/MIGRACION.md).
 */
@Composable
fun PantallaDinero(
    vista: VistaInicio,
    alElegirPeriodo: (String) -> Unit,
    alAjustes: () -> Unit,
    alAbrirCuenta: ((Cajita) -> Unit)? = null,
    alAbrirPasivos: ((String) -> Unit)? = null,
    alCrear: ((String) -> Unit)? = null,
    alAbrirMetas: (() -> Unit)? = null,
    alAbrirGmf: (() -> Unit)? = null,
    alAbrirDivision: (() -> Unit)? = null,
    alAbrirVaquitas: (() -> Unit)? = null,
    alAbrirEspacios: (() -> Unit)? = null,
    alAbrirExtractos: (() -> Unit)? = null,
) {
    val c = LukApp.colores
    val libro = vista.libro
    val privacidad = vista.ajustes.privacidad
    val favorita = vista.ajustes.cuentaFavoritaId
    val saldos = saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))
    val vivas = libro.cajitas.filter { it.archivedAt == null }
    val resumen = patrimonio(libro.cajitas, libro.movimientos, libro.transacciones)
    val inversiones = vivas.filter { it.tipo == TipoCajita.CAJITA && it.esInversion }.sumOf { saldos[it.id] ?: 0L }
    val ahorros = vivas.filter { it.tipo == TipoCajita.CAJITA && !it.esInversion }.sumOf { saldos[it.id] ?: 0L }
    val reservado = if (vista.ajustes.contarAhorros) 0L else ahorros
    val deudaTarjetas = abs(totalPorTipo(libro.cajitas, libro.movimientos, TipoCajita.TARJETA, libro.transacciones))
    val disponible = resumen.totalCop - inversiones - reservado - (resumen.deudasCop - deudaTarjetas)
    val hoy = bogotaDate()

    Column(Modifier.fillMaxWidth().padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
        // CabeceraDinero.tsx: período, racha (con TODO el historial, no solo el período) y ajustes.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            SelectorPeriodoNativo(vista, alElegirPeriodo)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val racha = calcularRacha(libro.transacciones, vista.hoy).rachaActual
                Row(
                    Modifier.heightIn(min = 40.dp).clip(CircleShape).background(c.soft).padding(horizontal = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Flame, tamano = 16.dp, color = c.inkSoft)
                    Text("$racha ${if (racha == 1) "día" else "días"}", style = LukApp.tipo.de(13, 700, 1.4f), color = c.inkSoft)
                }
                BotonRedondo("Ajustes", tamano = 40.dp, alPulsar = alAjustes) { Icono(Lucide.Settings2, tamano = 16.dp, color = c.inkSoft) }
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(if (privacidad) "Disponible (cifras ocultas)" else "Disponible", style = LukApp.tipo.xs, color = c.inkFaint)
            Text(
                if (privacidad) "$ ••••••" else formatCop(disponible),
                Modifier.padding(top = 4.dp),
                style = LukApp.tipo.cifra.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink,
            )
            // `-mt-6` dentro de un gap-8: la nota queda a 8dp de la cifra.
            Text(
                "Saldo total menos ahorros reservados y obligaciones.",
                Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkFaint, textAlign = TextAlign.Center,
            )
        }

        // AccesosFunciones de DineroView: lo que se abre desde aquí (Metas y 4x1000; los demás paneles llegan con su versión).
        if (alAbrirMetas != null) app.lukapp.ui.mes.AccesoFuncion("Metas de ahorro", "Ponte un objetivo y mira cuánto te falta", alAbrirMetas)
        if (alAbrirGmf != null) app.lukapp.ui.mes.AccesoFuncion("Impuesto 4x1000", "Cuánto te está costando y en qué cuenta", alAbrirGmf)
        if (alAbrirDivision != null) app.lukapp.ui.mes.AccesoFuncion("Dividir cuenta y propina", "Calcula cuánto le toca a cada uno en salidas y anota tu parte", alAbrirDivision)
        if (alAbrirExtractos != null) app.lukapp.ui.mes.AccesoFuncion("Importar extractos", "Sube el PDF que te manda el banco", alAbrirExtractos)
        if (alAbrirEspacios != null) app.lukapp.ui.mes.AccesoFuncion("Finanzas en Pareja / Compartidas", "Cuentas claras con tu pareja, viajes y gastos del hogar", alAbrirEspacios)
        if (alAbrirVaquitas != null) app.lukapp.ui.mes.AccesoFuncion("Vaquitas y Gastos Compartidos", "Arma vacas para paseos, asados o salidas y salda deudas", alAbrirVaquitas)

        if (vivas.isEmpty()) {
            Column(
                Modifier.fillMaxWidth().border(1.dp, c.line, Medidas.formaCard).padding(horizontal = 20.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Empieza por tu banco", style = LukApp.tipo.cuerpoB, color = c.ink)
                Text(
                    "Agrega dónde tienes la plata y escribe cuánto hay. Lo demás se calcula solo.",
                    Modifier.padding(top = 8.dp).widthIn(max = 320.dp),
                    style = LukApp.tipo.de(15, 400, 1.625f), color = c.inkSoft, textAlign = TextAlign.Center,
                )
                if (alCrear != null) Text(
                    "Agregar cuenta",
                    Modifier.padding(top = 16.dp).clip(Medidas.formaPildora).background(c.accent).pulsable { alCrear(TipoCajita.CUENTA) }.padding(horizontal = 24.dp, vertical = 12.dp),
                    style = LukApp.tipo.de(15, 600, 1.4f), color = c.onAccent,
                )
            }
        }

        GRUPOS.forEach { grupo ->
            val porSaldo = vivas
                .filter { it.tipo == grupo.tipo && (grupo.inversion == null || it.esInversion == grupo.inversion) }
                .sortedByDescending { saldos[it.id] ?: 0L }
            val delGrupo = if (grupo.tipo == TipoCajita.CUENTA) componerCuentas(porSaldo, favorita) else porSaldo
            if (delGrupo.isEmpty()) return@forEach
            Column {
                Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(grupo.titulo, style = LukApp.tipo.xs, color = c.inkFaint)
                    if (grupo.tipo == TipoCajita.CUENTA && delGrupo.size > 2) Text("Por color", style = LukApp.tipo.xs, color = c.inkFaint)
                    if (grupo.tipo == TipoCajita.TARJETA && alAbrirPasivos != null) {
                        Text("Ver todas", Modifier.pulsable { alAbrirPasivos(TipoCajita.TARJETA) }, style = LukApp.tipo.de(13, 600, 1.3f).copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline), color = c.inkSoft)
                    }
                }
                if (grupo.tipo == TipoCajita.CUENTA) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        delGrupo.forEach { FilaCuenta(it, saldos[it.id] ?: 0L, privacidad, it.id == favorita, alAbrirCuenta) }
                    }
                } else {
                    Column(Modifier.clip(Medidas.formaCard).background(c.card)) {
                        delGrupo.forEachIndexed { i, cajita ->
                            FilaCajita(cajita, saldos[cajita.id] ?: 0L, privacidad, cajita.id == favorita, i < delGrupo.lastIndex, vista, hoy, alAbrirCuenta, alAbrirPasivos)
                        }
                    }
                }
            }
        }

        if (vivas.isNotEmpty() && alCrear != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(TipoCajita.CUENTA to "Agregar cuenta", TipoCajita.CAJITA to "🐷 Crear ahorro").forEach { (t, titulo) ->
                    Text(
                        titulo, Modifier.weight(1f).clip(Medidas.formaCard).background(c.soft).pulsable { alCrear(t) }.padding(horizontal = 16.dp, vertical = 16.dp),
                        style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, textAlign = TextAlign.Center,
                    )
                }
            }
        }

        if (vivas.isNotEmpty() && alAbrirPasivos != null) {
            // En la web va junto a «Agregar cuenta» (pendiente) en una cuadrícula de dos.
            Text(
                "Tarjetas de crédito",
                Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.soft).pulsable { alAbrirPasivos(TipoCajita.TARJETA) }.padding(horizontal = 16.dp, vertical = 16.dp),
                style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

/** FilaCuenta.tsx + FilaCuenta.css: tarjeta con la identidad de la marca a la izquierda y el saldo a la derecha. */
@Composable
private fun FilaCuenta(cuenta: Cajita, saldo: Long, privacidad: Boolean, principal: Boolean, alAbrir: ((Cajita) -> Unit)?) {
    val c = LukApp.colores
    val entidad = entidadDeCuenta(cuenta)
    val efectivo = claseDeCuenta(cuenta) == ClaseCuenta.EFECTIVO
    // El efectivo tiene identidad propia (verde #18794E) también con nombres personalizados; una marca gana si se reconoce.
    val fondo = entidad?.let { colorHex(it.fondo) } ?: if (efectivo) Color(0xFF18794E) else c.soft
    val texto = entidad?.let { colorHex(it.texto) } ?: if (efectivo) Color.White else c.ink
    val forma = RoundedCornerShape(14.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(Medidas.formaCard)
            .background(c.card)
            .border(1.dp, c.line, Medidas.formaCard)
            .then(if (alAbrir != null) Modifier.pulsable { alAbrir(cuenta) } else Modifier)
            .padding(start = 6.dp, top = 6.dp, bottom = 6.dp, end = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier
                // `flex: 0 1 60%`: arranca en el 60 % de la fila y solo cede si las cifras no caben.
                .weight(0.6f)
                .heightIn(min = 70.dp)
                .clip(forma)
                .background(fondo)
                .then(velo(entidad?.sombraLectura))
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(32.dp).border(1.dp, texto.copy(alpha = 0.18f), CircleShape),
                contentAlignment = Alignment.Center,
            ) { IconoCuenta(cuenta, 22.dp, texto) }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(nombreVisibleCuenta(cuenta), style = LukApp.tipo.de(17, 600, 1.25f), color = texto)
                Text(etiquetaTipoCajita(cuenta), style = LukApp.tipo.de(13, 400, 1.3f), color = texto)
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(0.4f)) {
            Text(
                if (privacidad) "$ ••••••" else formatCop(saldo),
                style = LukApp.tipo.de(17, 600, 1.3f).copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.ink, textAlign = TextAlign.End,
            )
            if (principal) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icono(Lucide.Star, tamano = 12.dp, color = c.inkSoft)
                    Text("Principal", style = LukApp.tipo.de(13, 400, 1.3f), color = c.inkSoft)
                }
            }
        }
    }
}

/** El velo de lectura de `estiloEntidad`: linear-gradient(115deg, negro a+0.08 → negro a). */
private fun velo(sombra: Double?): Modifier = if (sombra == null) Modifier else Modifier.background(
    Brush.linearGradient(listOf(Color.Black.copy(alpha = (sombra + 0.08).toFloat()), Color.Black.copy(alpha = sombra.toFloat()))),
)

/** Fila de ahorro, inversión, tarjeta o deuda dentro de la tarjeta de su grupo (DineroView.tsx). */
@Composable
private fun FilaCajita(
    cajita: Cajita, saldo: Long, privacidad: Boolean, favorita: Boolean, conLinea: Boolean,
    vista: VistaInicio, hoy: String, alAbrir: ((Cajita) -> Unit)?, alAbrirPasivos: ((String) -> Unit)?,
) {
    val c = LukApp.colores
    val entidad = entidadDeCuenta(cajita)
    val texto = entidad?.let { colorHex(it.texto) }
    val pasivo = TipoCajita.esPasivo(cajita.tipo)
    val meta = cajita.metaCop
    val pct = if (meta != null && meta > 0) min(100.0, saldo.toDouble() / meta * 100) else null
    val pagoMensual = if (cajita.tipo == TipoCajita.TARJETA) {
        resumenTarjeta(cajita, abs(saldo), vista.libro.transacciones, vista.libro.movimientos, monthKey(hoy), hoy).pagoSiguienteCop
    } else 0L
    // Con marca, `--fin-soft` pasa a ser el color del texto al 9 % (`${texto}18`).
    val suave = texto?.copy(alpha = 0x18 / 255f) ?: c.soft
    val tinta = texto ?: c.ink
    Column(
        Modifier
            .fillMaxWidth()
            .background(entidad?.let { colorHex(it.fondo) } ?: Color.Transparent)
            .then(velo(entidad?.sombraLectura))
            // Tarjetas y deudas se abren en su propia vista (DeudasView), no en el detalle de una cuenta.
            .then(
                if (pasivo && alAbrirPasivos != null) Modifier.pulsable { alAbrirPasivos(cajita.tipo) }
                else if (!pasivo && alAbrir != null) Modifier.pulsable { alAbrir(cajita) } else Modifier,
            ),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(44.dp).clip(CircleShape).background(suave), contentAlignment = Alignment.Center) {
                IconoCuenta(cajita, 22.dp, texto ?: c.inkSoft, grosor = 2f)
            }
            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(nombreVisibleCuenta(cajita), Modifier.weight(1f, fill = false), style = LukApp.tipo.de(17, 600, 1.4f), color = tinta, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (favorita) {
                        Row(
                            Modifier.clip(CircleShape).background(c.warnBg).padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icono(Lucide.Star, tamano = 12.dp, color = c.warnInk, relleno = Color(0xFFF59E0B))
                            Text("Principal", style = LukApp.tipo.de(13, 700), color = c.warnInk)
                        }
                    }
                }
                Text(
                    if (cajita.tipo == TipoCajita.TARJETA && pagoMensual > 0) "Pago mensual estimado: ${formatCop(pagoMensual)}" else etiquetaTipoCajita(cajita),
                    Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = texto ?: c.inkFaint,
                )
                if (pct != null) {
                    Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(4.dp).clip(CircleShape).background(suave)) {
                        Box(Modifier.fillMaxWidth((pct / 100).toFloat().coerceIn(0f, 1f)).height(4.dp).clip(CircleShape).background(c.accent))
                    }
                    Text("${Math.round(pct)}% de ${formatCop(meta ?: 0)}", Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = texto ?: c.inkFaint)
                }
            }
            Text(
                if (privacidad) "$ ••••••" else formatCop(saldo),
                style = LukApp.tipo.de(17, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES),
                color = texto ?: if (pasivo) c.salio else c.ink,
            )
        }
        if (conLinea) Box(Modifier.fillMaxWidth().height(1.dp).background(texto?.copy(alpha = 0x30 / 255f) ?: c.line))
    }
}

/**
 * CabeceraDinero usa un `<select>` del navegador: en el teléfono abre el
 * selector del sistema. Aquí es el menú desplegable del sistema, con las
 * mismas 13 opciones y el mismo aspecto de pastilla cerrado.
 */
@Composable
private fun SelectorPeriodoNativo(vista: VistaInicio, alElegir: (String) -> Unit) {
    val c = LukApp.colores
    var abierto by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    Box {
        Row(
            Modifier.clip(CircleShape).background(c.soft).pulsable(etiqueta = "Cambiar período") { abierto = true }.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icono(Lucide.CalendarDays, tamano = 16.dp, color = c.ink)
            Text(
                app.lukapp.dominio.etiquetaDePeriodo(vista.clavePeriodo, vista.ajustes.periodo).replaceFirstChar { it.uppercase() },
                style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink, maxLines = 1,
            )
        }
        androidx.compose.material3.DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            (0 until 13).map { app.lukapp.dominio.periodoAdyacente(vista.maxClavePeriodo, -it, vista.ajustes.periodo) }.forEach { clave ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(app.lukapp.dominio.etiquetaDePeriodo(clave, vista.ajustes.periodo).replaceFirstChar { it.uppercase() }, style = LukApp.tipo.de(15, if (clave == vista.clavePeriodo) 600 else 400)) },
                    onClick = { alElegir(clave); abierto = false },
                )
            }
        }
    }
}
