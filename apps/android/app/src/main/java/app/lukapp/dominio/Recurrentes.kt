package app.lukapp.dominio

import java.text.Collator
import java.util.Locale
import kotlin.math.abs

// La app NO registra recurrentes sola: los propone y espera un toque, porque un
// movimiento inventado es plata falsa en el libro si el cobro no pasó.

private fun diasDelMesClave(mes: String): Int {
    val (anio, m, _) = partesFecha(mes)
    return fechaUtc(anio, m + 1, 0).dayOfMonth
}

/**
 * Origen: `lib/recurrentes.ts` (`fechaEnMes`). El día 31 en febrero cae el 28: quien
 * paga el último día lo paga igual en febrero.
 */
fun fechaEnMes(recurrente: Recurrente, mes: String): String {
    val dia = minOf(maxOf(1, recurrente.diaDelMes), diasDelMesClave(mes))
    return "$mes-${dia.toString().padStart(2, '0')}"
}

/**
 * Origen: `lib/recurrentes.ts` (`yaRegistrado`). Compara monto, tipo y categoría del
 * mes, no la descripción: pudo registrarse a mano con otro texto.
 */
fun yaRegistrado(recurrente: Recurrente, transacciones: List<Transaccion>, mes: String): Boolean =
    transacciones.any {
        monthKey(it.occurredOn) == mes && it.kind == recurrente.kind &&
            it.category == recurrente.categoria && it.amountCop == recurrente.amountCop
    }

/** Origen: `lib/recurrentes.ts` (`Pendiente`). */
data class Pendiente(val recurrente: Recurrente, val fecha: String, val vencido: Boolean)

/**
 * Origen: `lib/recurrentes.ts` (`pendientesDelMes`). Solo los que ya llegó su día:
 * un libro adelantado es tan inútil como uno atrasado.
 */
fun pendientesDelMes(recurrentes: List<Recurrente>, transacciones: List<Transaccion>, mes: String, hoy: String): List<Pendiente> =
    recurrentes.filter { it.archivedAt == null }
        .map { Pendiente(it, fechaEnMes(it, mes), false) }
        .filter { it.fecha <= hoy }
        .filter { !yaRegistrado(it.recurrente, transacciones, mes) }
        .map { it.copy(vencido = it.fecha < hoy) }
        .sortedBy { it.fecha }

/** Origen: `lib/recurrentes.ts` (`comoTransaccion`). Lleva la fecha del recurrente, no la de hoy. */
fun comoTransaccion(pendiente: Pendiente, id: String, createdAt: String): Transaccion = Transaccion(
    id = id,
    kind = pendiente.recurrente.kind,
    amountCop = pendiente.recurrente.amountCop,
    category = pendiente.recurrente.categoria,
    description = pendiente.recurrente.nombre,
    occurredOn = pendiente.fecha,
    cuentaId = pendiente.recurrente.cuentaId,
    rawTranscript = "Recurrente: ${pendiente.recurrente.nombre}",
    createdAt = createdAt,
)

/** Origen: `lib/recurrentes.ts` (`totalMensual`). */
data class TotalMensual(val gastoCop: Long, val ingresoCop: Long)

/** Origen: `lib/recurrentes.ts` (`totalMensual`). Todo lo que no es ingreso cuenta como gasto. */
fun totalMensual(recurrentes: List<Recurrente>): TotalMensual {
    var gasto = 0L
    var ingreso = 0L
    for (r in recurrentes) {
        if (r.archivedAt != null) continue
        if (r.kind == TipoTx.INGRESO) ingreso += r.amountCop else gasto += r.amountCop
    }
    return TotalMensual(gasto, ingreso)
}

/** Origen: `lib/recurrentes.ts` (`SugerenciaSuscripcion`). */
data class SugerenciaSuscripcion(
    val clave: String,
    val nombre: String,
    val kind: String,
    val amountCop: Long,
    val categoria: String,
    val cuentaId: String?,
    val diaDelMes: Int,
    val meses: Int,
    val promedioCop: Long,
    val ultimaFecha: String,
    val recurrenteExistente: Recurrente?,
    val cambioPrecio: Boolean,
)

// La web escribe `/\\s+/g`, que en un literal de regex busca una barra invertida
// seguida de «s»: en la práctica no colapsa espacios. Se replica tal cual para que
// las claves de agrupación coincidan con las de la web.
private val BARRA_S = Regex("\\\\s+")
private val ES_CO = Locale.forLanguageTag("es-CO")

private fun parteNormalizada(texto: String): String =
    BARRA_S.replace((extraerContraparte(texto) ?: texto).trim().lowercase(ES_CO), " ")

private fun numeroMes(fecha: String): Int {
    val (anio, mes, _) = partesFecha(fecha.take(7))
    return anio * 12 + mes
}

/**
 * Origen: `lib/recurrentes.ts` (`detectarSuscripciones`). Cobros parecidos (±15 %) en
 * los tres últimos meses seguidos; nunca se registran solos.
 */
fun detectarSuscripciones(transacciones: List<Transaccion>, recurrentes: List<Recurrente>, hoy: String): List<SugerenciaSuscripcion> {
    val grupos = LinkedHashMap<String, MutableList<Transaccion>>()
    for (tx in transacciones) {
        if (!tx.afectaSaldo || tx.kind == TipoTx.TRANSFERENCIA || tx.amountCop <= 0) continue
        val parte = parteNormalizada(tx.description)
        if (parte.isEmpty()) continue
        grupos.getOrPut("${tx.kind}|$parte") { mutableListOf() }.add(tx)
    }
    val vivos = recurrentes.filter { it.archivedAt == null }
    val sugerencias = mutableListOf<SugerenciaSuscripcion>()
    for ((clave, grupo) in grupos) {
        val porMes = LinkedHashMap<String, MutableList<Transaccion>>()
        for (tx in grupo) porMes.getOrPut(monthKey(tx.occurredOn)) { mutableListOf() }.add(tx)
        val meses = porMes.keys.sorted()
        if (meses.size < 3) continue
        val ultimosTres = meses.takeLast(3)
        val idx = ultimosTres.map(::numeroMes)
        if (idx[2] != numeroMes(hoy) && idx[2] != numeroMes(hoy) - 1) continue
        if (idx[1] != idx[2] - 1 || idx[0] != idx[1] - 1) continue
        val filasMes = ultimosTres.map { mes -> porMes.getValue(mes).sortedByDescending { it.occurredOn }[0] }
        val montos = filasMes.map { it.amountCop }.sorted()
        val mediana = montos[1]
        if (montos.any { abs(it - mediana).toDouble() / mediana > 0.15 }) continue
        val ultima = filasMes[2]
        val parteClave = clave.substring(clave.indexOf('|') + 1)
        val recurrente = vivos.firstOrNull { it.kind == ultima.kind && parteNormalizada(it.nombre) == parteClave }
        val cambioPrecio = recurrente != null && abs(ultima.amountCop - recurrente.amountCop).toDouble() / recurrente.amountCop > 0.15
        if (recurrente != null && !cambioPrecio) continue
        sugerencias.add(
            SugerenciaSuscripcion(
                clave = clave,
                nombre = recurrente?.nombre ?: (extraerContraparte(ultima.description) ?: ultima.description).trim(),
                kind = ultima.kind,
                amountCop = ultima.amountCop,
                categoria = ultima.category,
                cuentaId = ultima.cuentaId,
                diaDelMes = ultima.occurredOn.takeLast(2).toInt(),
                meses = meses.size,
                promedioCop = Math.round(montos.sum().toDouble() / montos.size),
                ultimaFecha = ultima.occurredOn,
                recurrenteExistente = recurrente,
                cambioPrecio = cambioPrecio,
            ),
        )
    }
    val colador = Collator.getInstance(Locale.forLanguageTag("es"))
    return sugerencias.sortedWith { a, b -> colador.compare(a.nombre, b.nombre) }
}

/** Origen: `lib/recurrentes.ts` (`proximosRecurrentes`). Item de la lista de próximos cobros. */
data class ProximoRecurrente(val recurrente: Recurrente, val fecha: String)

/** Origen: `lib/recurrentes.ts` (`proximosRecurrentes`). Cobros de gasto en los próximos `dias` días. */
fun proximosRecurrentes(
    recurrentes: List<Recurrente>,
    hoy: String,
    transacciones: List<Transaccion> = emptyList(),
    dias: Int = 60,
): List<ProximoRecurrente> {
    val hasta = shiftDays(hoy, dias)
    val meses = LinkedHashSet<String>()
    var cursor = hoy
    while (cursor <= hasta) {
        meses.add(cursor.take(7))
        cursor = shiftDays(cursor, 1)
    }
    val colador = Collator.getInstance(Locale.forLanguageTag("es"))
    return recurrentes.filter { it.archivedAt == null && it.kind == TipoTx.GASTO }
        .flatMap { r -> meses.map { ProximoRecurrente(r, fechaEnMes(r, it)) } }
        .filter { it.fecha >= hoy && it.fecha <= hasta && !yaRegistrado(it.recurrente, transacciones, monthKey(it.fecha)) }
        .sortedWith { a, b -> a.fecha.compareTo(b.fecha).takeIf { it != 0 } ?: colador.compare(a.recurrente.nombre, b.recurrente.nombre) }
}
