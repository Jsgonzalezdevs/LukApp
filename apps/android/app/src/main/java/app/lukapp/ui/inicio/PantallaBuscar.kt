package app.lukapp.ui.inicio

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.FILTRO_VACIO
import app.lukapp.dominio.Filtro
import app.lukapp.dominio.TipoCajita
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.buscarFunciones
import app.lukapp.dominio.filtrarMovimientos
import app.lukapp.dominio.filtroActivo
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.resumirFiltrado
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.calendario.Desplegable
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.iconos.Icono
import app.lukapp.ui.iconos.Lucide
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/**
 * Buscar (BuscadorMovimientos + ResultadosFunciones): busca en TODO el historial —no solo el mes visible— por
 * quién, en qué o cuánto, filtra por tipo, categoría y cuenta, suma lo encontrado y propone las funciones de LukApp
 * que coinciden con lo escrito.
 */
@Composable
fun PantallaBuscar(vista: VistaInicio, alAbrirMovimiento: (Transaccion) -> Unit, alAbrirFuncion: (String) -> Unit, alCerrar: () -> Unit) {
    val c = LukApp.colores
    BackHandler(onBack = alCerrar)
    var texto by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf<String?>(null) }
    var categoria by rememberSaveable { mutableStateOf<String?>(null) }
    var cuentaId by rememberSaveable { mutableStateOf<String?>(null) }
    val filtro = Filtro(texto = texto, categoria = categoria, cuentaId = cuentaId, kind = kind)
    val activo = filtroActivo(filtro)
    val cuentas = remember(vista.libro.cajitas) { vista.libro.cajitas.filter { it.archivedAt == null && (it.tipo == TipoCajita.CUENTA || it.tipo == TipoCajita.TARJETA) } }
    val visibles = remember(vista.libro.transacciones, texto, kind, categoria, cuentaId, vista.catalogo) {
        filtrarMovimientos(vista.libro.transacciones, filtro, vista.catalogo)
            .sortedWith(compareByDescending<Transaccion> { it.occurredOn }.thenByDescending { it.createdAt })
    }
    val resumen = remember(visibles) { resumirFiltrado(visibles) }
    val funciones = remember(texto) { buscarFunciones(texto) }

    Column(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Buscar", style = LukApp.tipo.titulo, color = c.ink)
            Box(Modifier.size(36.dp).clip(CircleShape).background(c.soft).semantics { contentDescription = "Cerrar" }.pulsable(alPulsar = alCerrar), contentAlignment = Alignment.Center) {
                Icono(Lucide.X, tamano = 20.dp, grosor = 2.5f, color = c.inkSoft)
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.fillMaxWidth().clip(Medidas.formaCard).background(c.card).padding(16.dp)) {
                Row(
                    Modifier.fillMaxWidth().clip(Medidas.formaCard).border(2.dp, c.line, Medidas.formaCard).background(c.card).padding(horizontal = 12.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icono(Lucide.Search, tamano = 16.dp, grosor = 2.5f, color = c.inkFaint)
                    val estilo = LukApp.tipo.de(17, 400, 1.3f)
                    BasicTextField(
                        value = texto, onValueChange = { texto = it }, singleLine = true, textStyle = estilo.copy(color = c.ink), cursorBrush = SolidColor(c.accent),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Search),
                        modifier = Modifier.weight(1f).semantics { contentDescription = "Buscar movimientos y funciones" },
                        decorationBox = { interno -> Box { if (texto.isEmpty()) Text("Movimiento o función: almuerzo, pagos fijos…", style = estilo.copy(fontSize = androidx.compose.ui.unit.TextUnit(15f, androidx.compose.ui.unit.TextUnitType.Sp)), color = c.inkGhost); interno() } },
                    )
                }
                if (!activo) Text("Movimientos de todo tu historial y funciones de LukApp.", Modifier.padding(top = 8.dp), style = LukApp.tipo.xs, color = c.inkSoft)

                if (funciones.isNotEmpty()) Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    funciones.forEach { f ->
                        Row(
                            Modifier.fillMaxWidth().clip(Medidas.formaCard).border(1.dp, c.line, Medidas.formaCard).background(c.card).pulsable(escala = 1f, alPulsar = { alAbrirFuncion(f.id) }).padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(f.titulo, style = LukApp.tipo.de(16, 600, 1.4f), color = c.ink)
                                Text(f.ayuda, Modifier.padding(top = 4.dp), style = LukApp.tipo.xs, color = c.inkSoft)
                            }
                            Icono(Lucide.ChevronRight, tamano = 18.dp, color = c.inkSoft)
                        }
                    }
                }

                Text("Filtrar movimientos", Modifier.padding(top = 16.dp), style = LukApp.tipo.de(12, 600, 1.4f), color = c.inkSoft)
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Desplegable(
                        when (kind) { "gasto" -> "Solo gastos"; "ingreso" -> "Solo ingresos"; else -> "Todo" },
                        listOf("Todo" to "", "Solo gastos" to "gasto", "Solo ingresos" to "ingreso"), "Tipo",
                    ) { kind = it.ifEmpty { null } }
                    Desplegable(
                        categoria?.let { vista.catalogo.de(it).nombre } ?: "Toda categoría",
                        listOf("Toda categoría" to "") + vista.catalogo.lista.map { it.nombre to it.clave }, "Categoría",
                    ) { categoria = it.ifEmpty { null } }
                    if (cuentas.isNotEmpty()) Desplegable(
                        cuentas.firstOrNull { it.id == cuentaId }?.nombre ?: "Toda cuenta",
                        listOf("Toda cuenta" to "") + cuentas.map { it.nombre to it.id }, "Cuenta",
                    ) { cuentaId = it.ifEmpty { null } }
                }

                // Solo cuando algo se filtra, y dicho claro: la lista ya no es «este mes», es todo el libro.
                if (activo) Row(
                    Modifier.padding(top = 12.dp).fillMaxWidth().clip(Medidas.formaCard).background(c.bg).padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.ink)) { append("${resumen.cuantos} movimiento${if (resumen.cuantos == 1) "" else "s"}") }
                            append(" en todo tu historial")
                            if (resumen.gastoCop > 0) { append(" · sale "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.salio)) { append(formatCop(resumen.gastoCop)) } }
                            if (resumen.ingresoCop > 0) { append(" · entra "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.entro)) { append(formatCop(resumen.ingresoCop)) } }
                        },
                        Modifier.weight(1f), style = LukApp.tipo.de(13, 400, 1.6f), color = c.inkSoft,
                    )
                    Row(
                        Modifier.clip(Medidas.formaPildora).background(c.soft).semantics { contentDescription = "Limpiar" }.pulsable(alPulsar = { texto = ""; kind = null; categoria = null; cuentaId = null }).padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icono(Lucide.X, tamano = 12.dp, grosor = 3f, color = c.inkSoft)
                        Text("Limpiar", style = LukApp.tipo.de(13, 600, 1.4f), color = c.inkSoft)
                    }
                }
            }

            if (visibles.isEmpty()) Text("No hay movimientos que coincidan con esta búsqueda.", style = LukApp.tipo.de(14, 400, 1.5f), color = c.inkSoft)
            else ListaMovimientos(visibles, vista.catalogo, vista.ajustes.privacidad, vista.hoy, alAbrirMovimiento)
        }
    }
}
