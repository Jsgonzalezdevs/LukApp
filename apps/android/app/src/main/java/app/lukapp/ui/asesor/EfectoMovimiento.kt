package app.lukapp.ui.asesor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.CATEGORY_LABELS
import app.lukapp.dominio.claveDePeriodo
import app.lukapp.dominio.gastadoEnCategoria
import app.lukapp.dominio.idsPasivos
import app.lukapp.dominio.saldosPorCajita
import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.ui.VistaInicio
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/**
 * `efectoMovimiento` + «Revisar y editar movimiento» de AsesorView. Nunca guarda: solo
 * muestra qué pasaría con el saldo y el tope y lleva a Captura con el movimiento cargado.
 */
@Composable
fun EfectoMovimiento(accion: ParsedTransaction, etiquetaBoton: String, vista: VistaInicio, alRevisar: () -> Unit) {
    val c = LukApp.colores
    val libro = vista.libro
    val monto = accion.amount ?: 0L
    val cuenta = libro.cajitas.firstOrNull { it.id == accion.cuentaId }
    val saldo = accion.cuentaId?.let { saldosPorCajita(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))[it] }
    val cambio = when (accion.kind) { "ingreso" -> monto; "gasto" -> -monto; else -> 0L }
    val presupuesto = libro.presupuestos.firstOrNull { it.categoria == accion.category }
    val categoria = libro.categorias.firstOrNull { it.id == accion.category }?.nombre ?: CATEGORY_LABELS[accion.category] ?: accion.category
    val gasto = if (accion.kind == "gasto") gastadoEnCategoria(libro.transacciones, claveDePeriodo(vista.hoy, vista.ajustes.periodo), vista.ajustes.periodo, accion.category) else null
    Column(Modifier.padding(top = 12.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.fillMaxWidth().clip(Medidas.formaControl).background(c.bg).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(buildAnnotatedString {
                append("🧾 "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(accion.description.ifEmpty { categoria }) }
                append(" · $categoria · ${miles(monto)} COP")
            }, style = LukApp.tipo.xs, color = c.inkSoft)
            if (cuenta != null && saldo != null) Text("Si confirmas, ${cuenta.nombre} pasaría de ${miles(saldo)} a ${miles(saldo + cambio)} COP.", style = LukApp.tipo.xs, color = c.inkSoft)
            if (presupuesto != null && gasto != null) Text("En $categoria llevas ${miles(gasto)} de ${miles(presupuesto.montoCop)} COP; con este movimiento serían ${miles(gasto + monto)} COP.", style = LukApp.tipo.xs, color = c.inkSoft)
            Text("Puedes revisar y editar los datos antes de guardarlo.", style = LukApp.tipo.xs, color = c.inkSoft)
        }
        Box(Modifier.fillMaxWidth().heightIn(min = 36.dp).clip(Medidas.formaControl).background(c.accent).pulsable(alPulsar = alRevisar).padding(horizontal = 12.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            Text(etiquetaBoton, style = LukApp.tipo.de(13, 600, 1.4f), color = c.onAccent)
        }
    }
}
