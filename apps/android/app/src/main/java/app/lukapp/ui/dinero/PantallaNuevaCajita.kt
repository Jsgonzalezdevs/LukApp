package app.lukapp.ui.dinero

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.ClaseCuenta
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.conPuntos
import app.lukapp.dominio.parseAmountInput
import app.lukapp.dominio.parseSaldoInput
import app.lukapp.dominio.reconocerEntidad
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.CampoTexto
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.calendario.Etiquetado
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas
import kotlinx.coroutines.launch

/** `CAJITA_ICONS` de data/modelos.ts. */
private val ICONOS_CAJITA = listOf("Wallet", "PiggyBank", "Tent", "Car", "Home", "GraduationCap", "Laptop", "Gift", "LifeBuoy", "Gem", "Plane")
/** `MONEDAS_DISPONIBLES`. */
private val MONEDAS = listOf("COP", "USD", "EUR", "MXN", "CAD", "GBP")

/** Lo que el formulario manda a guardar; devuelve si se guardó. */
class AccionCrearCajita(val crear: suspend (nombre: String, icon: String, tipo: String, clase: String?, meta: Long?, tasa: Double?, inversion: Boolean, moneda: String, saldoInicial: Long?) -> Boolean)

/**
 * El formulario de creación de CajitasView.tsx para cuentas («Agregar cuenta») y ahorros («Tu nuevo ahorro»).
 * Las tarjetas de crédito (cupo, corte, pago) siguen su propio camino en Tarjetas y deudas.
 */
@Composable
fun PantallaNuevaCajita(tipo: String, vista: VistaInicio, accion: AccionCrearCajita, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    val ambito = rememberCoroutineScope()
    val esCuenta = tipo == TipoCajita.CUENTA
    var nombre by rememberSaveable { mutableStateOf("") }
    var clase by rememberSaveable { mutableStateOf(ClaseCuenta.BANCO) }
    var inversion by rememberSaveable { mutableStateOf(false) }
    var moneda by rememberSaveable { mutableStateOf("COP") }
    var icono by rememberSaveable { mutableStateOf(ICONOS_CAJITA[0]) }
    var saldo by rememberSaveable { mutableStateOf("") }
    var meta by rememberSaveable { mutableStateOf("") }
    var rinde by rememberSaveable { mutableStateOf(false) }
    var tasa by rememberSaveable { mutableStateOf("") }
    var errorTasa by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val entidad = if (esCuenta) reconocerEntidad(nombre) else null
    val valido = nombre.isNotBlank() && !guardando

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(if (esCuenta) "Agregar cuenta" else "🐷 Tu nuevo ahorro", style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Etiquetado("Nombre") {
                CampoTexto(nombre, {
                    nombre = it
                    // Como la web: si el nombre es un banco o billetera conocidos, la clase se ajusta sola.
                    if (esCuenta) reconocerEntidad(it)?.claseCuenta?.let { cl -> clase = cl }
                }, if (esCuenta) "Ej: Nequi, Bancolombia" else "Ej: Vacaciones", "Nombre")
            }
            if (esCuenta) {
                Text(
                    if (entidad != null) "${entidad.nombre} · Color reconocido automáticamente" else "Escribe el nombre de tu banco o billetera para reconocer su color.",
                    style = LukApp.tipo.xs, color = if (entidad != null) c.ink else c.inkFaint,
                )
                Etiquetado("Tipo de cuenta") {
                    Desplegable(ClaseCuenta.ETIQUETAS[clase] ?: clase, listOf(ClaseCuenta.BANCO, ClaseCuenta.BILLETERA, ClaseCuenta.EFECTIVO).map { (ClaseCuenta.ETIQUETAS[it] ?: it) to it }, "Tipo de cuenta") { clase = it }
                }
            } else {
                Text("¿Qué estás guardando?", style = LukApp.tipo.de(14, 600, 1.4f), color = c.inkSoft)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(Triple(false, "🐷 Ahorro", "Para algo que quieres"), Triple(true, "📈 Inversión", "Dinero invertido")).forEach { (valor, titulo, detalle) ->
                        Column(
                            Modifier.weight(1f).clip(Medidas.formaCard).border(2.dp, if (inversion == valor) c.accent else c.line, Medidas.formaCard).background(if (inversion == valor) c.soft else c.card)
                                .semantics { contentDescription = titulo }.pulsable(escala = 1f, alPulsar = { inversion = valor }).padding(12.dp),
                        ) {
                            Text(titulo, style = LukApp.tipo.de(14, 600, 1.4f), color = c.ink)
                            Text(detalle, style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkFaint)
                        }
                    }
                }
                if (inversion) {
                    Etiquetado("Moneda") { Desplegable(moneda, MONEDAS.map { it to it }, "Moneda") { moneda = it } }
                    Text("Tus totales siguen en COP; cada aporte guarda su moneda y tasa. 💱", style = LukApp.tipo.de(12, 400, 1.4f), color = c.inkFaint)
                }
            }

            Etiquetado(if (esCuenta) "¿Cuánto tienes en esta cuenta?" else "¿Con cuánto empiezas? (opcional)") {
                CampoTexto(saldo, { saldo = conPuntos(it) }, "0", "Saldo inicial", numerico = true)
            }
            Text(
                if (esCuenta) "Escribe 0 si está vacía. Si dejas este campo en blanco, el saldo quedará pendiente de confirmar."
                else if (inversion) "Empieza en 0 y agrega tus aportes con su moneda. 💱" else "Puedes empezar en \$0 y agregar dinero después. 💸",
                style = LukApp.tipo.de(13, 400, 1.5f), color = c.inkFaint,
            )

            if (!esCuenta) {
                Text("Ícono", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ICONOS_CAJITA.forEach { nombreIcono ->
                        Box(
                            Modifier.size(40.dp).clip(Medidas.formaCard).border(2.dp, if (icono == nombreIcono) c.accent else c.line, Medidas.formaCard).background(c.card)
                                .semantics { contentDescription = "Ícono $nombreIcono" }.pulsable(escala = 1f, alPulsar = { icono = nombreIcono }),
                            contentAlignment = Alignment.Center,
                        ) { Icono(Lucide.porNombre[nombreIcono] ?: Lucide.Wallet, tamano = 20.dp, color = if (icono == nombreIcono) c.ink else c.inkSoft) }
                    }
                }
                Etiquetado("Meta a la que quieres llegar (opcional)") { CampoTexto(meta, { meta = conPuntos(it) }, "0", "Meta", numerico = true) }
                // La tasa describe el ahorro; nunca registra rendimientos como dinero recibido.
                Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        Modifier.fillMaxWidth().semantics { contentDescription = "Este ahorro genera rendimientos" }.pulsable(escala = 1f, alPulsar = { rinde = !rinde; errorTasa = false }),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Este ahorro genera rendimientos", Modifier.weight(1f), style = LukApp.tipo.de(15, 600, 1.4f), color = c.ink)
                        Switch(checked = rinde, onCheckedChange = null, colors = SwitchDefaults.colors(checkedTrackColor = c.accent, checkedThumbColor = c.onAccent))
                    }
                    if (rinde) {
                        Etiquetado("Tasa efectiva anual (%)") { CampoTexto(tasa, { tasa = it.filter { ch -> ch.isDigit() || ch == ',' || ch == '.' }; errorTasa = false }, "Ej: 9,5", "Tasa efectiva anual") }
                        if (errorTasa) Text("Escribe una tasa mayor que 0.", style = LukApp.tipo.xs, color = c.salio)
                    }
                }
            }

            error?.let { Text(it, style = LukApp.tipo.xs, color = c.salio) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (guardando) "Guardando…" else "Guardar",
                    Modifier.weight(1f).clip(Medidas.formaControl).background(c.accent.copy(alpha = if (valido) 1f else 0.4f)).pulsable(habilitado = valido, alPulsar = {
                        // La coma es el separador decimal en un teclado colombiano: se aceptan ambas.
                        val t = tasa.replace(',', '.').toDoubleOrNull()
                        if (!esCuenta && rinde && (t == null || t <= 0)) { errorTasa = true; return@pulsable }
                        guardando = true; error = null
                        ambito.launch {
                            val ok = accion.crear(
                                nombre, if (esCuenta) "Wallet" else icono, tipo, if (esCuenta) clase else null, parseAmountInput(meta),
                                if (!esCuenta && rinde) t else null, !esCuenta && inversion, if (!esCuenta) moneda else "COP",
                                if (esCuenta) parseSaldoInput(saldo) else (parseAmountInput(saldo) ?: 0L),
                            )
                            if (ok) alCerrar() else error = "No se pudo guardar. Inténtalo de nuevo."
                            guardando = false
                        }
                    }).padding(vertical = 12.dp),
                    style = LukApp.tipo.de(17, 600, 1.3f), color = c.onAccent, textAlign = TextAlign.Center,
                )
                Text("Cancelar", Modifier.clip(Medidas.formaControl).border(1.dp, c.line, Medidas.formaControl).pulsable(habilitado = !guardando, alPulsar = alCerrar).padding(horizontal = 16.dp, vertical = 12.dp), style = LukApp.tipo.de(17, 600, 1.3f), color = c.inkSoft)
            }
        }
    }
}
