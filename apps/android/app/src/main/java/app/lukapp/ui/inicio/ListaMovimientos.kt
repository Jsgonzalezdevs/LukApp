package app.lukapp.ui.inicio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lukapp.dominio.Catalogo
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.dayLabel
import app.lukapp.dominio.formatCop
import app.lukapp.dominio.formatSigned
import app.lukapp.ui.comun.Emoji
import app.lukapp.ui.comun.pulsable
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.Medidas

/** Cifras con `tabular-nums`, como en la web: las columnas de montos no bailan. */
internal const val CIFRAS_TABULARES = "tnum"

private data class GrupoDia(val fecha: String, val items: List<Transaccion>, val neto: Long)

/** `groupByDay` de TransactionList.tsx: días de más reciente a más viejo, filas por createdAt. */
private fun agruparPorDia(txs: List<Transaccion>): List<GrupoDia> =
    txs.groupBy { it.occurredOn }.entries
        .sortedByDescending { it.key }
        .map { (fecha, items) ->
            GrupoDia(
                fecha,
                items.sortedByDescending { it.createdAt },
                items.sumOf { if (it.kind == "ingreso") it.amountCop else if (it.kind == "gasto") -it.amountCop else 0L },
            )
        }

/**
 * TransactionList.tsx: una tarjeta por día con líneas finas internas, ícono de
 * 44dp con el emoji de la categoría, descripción 17/600 y monto con signo en
 * verde (entró), rojo (salió) o tinta suave (transferencia).
 *
 * Pendiente frente a la web: deslizar para repetir/editar y el punto de "algo
 * que revisar" (`conSenal`), porque dependen de Captura y de las señales, que
 * aún no están migradas. La fila solo es pulsable si hay `alAbrir`, igual que allá.
 */
@Composable
fun ListaMovimientos(
    movimientos: List<Transaccion>,
    catalogo: Catalogo,
    privacidad: Boolean,
    hoy: String,
    alAbrir: ((Transaccion) -> Unit)? = null,
) {
    val c = LukApp.colores
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        agruparPorDia(movimientos).forEach { grupo ->
            val etiqueta = dayLabel(grupo.fecha, hoy)
            Column(Modifier.semantics { contentDescription = etiqueta }) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Text(etiqueta.replaceFirstChar { it.uppercase() }, Modifier.semantics { heading() }, style = LukApp.tipo.xs, color = c.inkFaint)
                    Text(
                        if (privacidad) "$ ••••••" else formatCop(grupo.neto),
                        style = LukApp.tipo.xs.copy(fontFeatureSettings = CIFRAS_TABULARES), color = c.inkFaint,
                    )
                }
                Column(Modifier.clip(Medidas.formaCard).background(c.card)) {
                    grupo.items.forEachIndexed { i, tx -> FilaMovimiento(tx, catalogo, privacidad, ultima = i == grupo.items.lastIndex, alAbrir) }
                }
            }
        }
    }
}

@Composable
private fun FilaMovimiento(tx: Transaccion, catalogo: Catalogo, privacidad: Boolean, ultima: Boolean, alAbrir: ((Transaccion) -> Unit)?) {
    val c = LukApp.colores
    val entrada = catalogo.de(tx.category)
    val esIngreso = tx.kind == "ingreso"
    val esTransferencia = tx.kind == "transferencia"
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .background(c.surface)
                .then(if (alAbrir != null) Modifier.pulsable(escala = 0.98f, etiqueta = "Ver ${tx.description}") { alAbrir(tx) } else Modifier)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(44.dp).shadow(1.dp, Medidas.formaCard, ambientColor = Color.Black.copy(.05f)).clip(Medidas.formaCard).background(c.soft),
                contentAlignment = Alignment.Center,
            ) { Emoji(entrada.emoji, 20) }
            Column(Modifier.weight(1f)) {
                Text(tx.description, style = LukApp.tipo.de(17, 600, 1.4f), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(entrada.nombre, Modifier.weight(1f, fill = false), style = LukApp.tipo.de(15, 400, 1.4f), color = c.inkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (!tx.afectaSaldo) {
                        Text(
                            "🕰️ Histórico",
                            Modifier
                                .semantics { contentDescription = "Movimiento histórico; no modifica el saldo actual" }
                                .clip(Medidas.formaPildora).background(c.soft).padding(horizontal = 8.dp, vertical = 2.dp),
                            style = LukApp.tipo.de(11, 600, 1.4f), color = c.inkSoft,
                        )
                    }
                }
            }
            Text(
                if (privacidad) "${if (esIngreso) "+" else if (esTransferencia) "↔" else "−"}$ ••••••" else formatSigned(tx.amountCop, tx.kind),
                style = LukApp.tipo.de(17, 600, 1.4f).copy(fontFeatureSettings = CIFRAS_TABULARES),
                color = if (esIngreso) c.entro else if (esTransferencia) c.inkSoft else c.salio,
            )
        }
        // `boxShadow: inset 0 -1px 0 0 var(--fin-line)` en todas menos la última.
        if (!ultima) Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
    }
}
