package app.lukapp.dominio

import java.text.Collator
import java.time.YearMonth
import java.util.Locale

/** Origen: `lib/detalle.ts` (`FilaContraparte`). */
data class FilaContraparte(val nombre: String, val totalCop: Long, val veces: Int)

/** Origen: `lib/detalle.ts` (`topContrapartes`). Empates por nombre con `localeCompare`. */
fun topContrapartes(transacciones: List<Transaccion>, kind: String, limite: Int = 8): List<FilaContraparte> {
    val porNombre = LinkedHashMap<String, FilaContraparte>()
    for (tx in transacciones) {
        if (tx.kind != kind) continue
        val nombre = extraerContraparte(tx.description) ?: continue
        if (nombre.isEmpty()) continue
        val fila = porNombre[nombre] ?: FilaContraparte(nombre, 0, 0)
        porNombre[nombre] = fila.copy(totalCop = fila.totalCop + tx.amountCop, veces = fila.veces + 1)
    }
    val colador = Collator.getInstance(Locale.forLanguageTag("es"))
    return porNombre.values
        .sortedWith { a, b -> if (b.totalCop != a.totalCop) b.totalCop.compareTo(a.totalCop) else colador.compare(a.nombre, b.nombre) }
        .take(limite)
}

/** Origen: `lib/detalle.ts` (`mayoresMovimientos`). El orden estable conserva el de entrada en empates, igual que Array.sort. */
fun mayoresMovimientos(transacciones: List<Transaccion>, kind: String, limite: Int = 5): List<Transaccion> =
    transacciones.filter { it.kind == kind }.sortedByDescending { it.amountCop }.take(limite)

/** Origen: `lib/detalle.ts` (`DiaDelMes`). */
data class DiaDelMes(val fecha: String, val dia: Int, val gastoCop: Long, val ingresoCop: Long)

/**
 * Origen: `lib/detalle.ts` (`porDiaDelMes`). Todos los días del mes, también los vacíos.
 * Como en la web, todo lo que no es gasto (también una transferencia) suma a `ingresoCop`.
 */
fun porDiaDelMes(transacciones: List<Transaccion>, mes: String): List<DiaDelMes> {
    val (anio, m) = mes.split("-").map(String::toInt)
    val ultimo = YearMonth.of(anio, m).lengthOfMonth()
    val gasto = LongArray(ultimo)
    val ingreso = LongArray(ultimo)
    for (tx in forMonth(transacciones, mes)) {
        val indice = (tx.occurredOn.substring(8, 10).toIntOrNull() ?: 0) - 1
        if (indice < 0 || indice >= ultimo) continue
        if (tx.kind == TipoTx.GASTO) gasto[indice] += tx.amountCop else ingreso[indice] += tx.amountCop
    }
    return (0 until ultimo).map { i -> DiaDelMes("$mes-${(i + 1).toString().padStart(2, '0')}", i + 1, gasto[i], ingreso[i]) }
}

/** Origen: `lib/detalle.ts` (`ResumenDelMes`). */
data class ResumenDetalleMes(val diasConGasto: Int, val promedioPorDiaActivoCop: Long, val diaMasCaro: DiaDelMes?, val movimientos: Int)

/** Origen: `lib/detalle.ts` (`resumenDelMes`). El promedio es sobre los días con gasto, no sobre el mes entero. */
fun resumenDetalleMes(transacciones: List<Transaccion>, mes: String): ResumenDetalleMes {
    val activos = porDiaDelMes(transacciones, mes).filter { it.gastoCop > 0 }
    val total = activos.sumOf { it.gastoCop }
    return ResumenDetalleMes(
        diasConGasto = activos.size,
        promedioPorDiaActivoCop = if (activos.isNotEmpty()) Math.round(total.toDouble() / activos.size) else 0,
        // reduce con ">" estricto: en empate gana el primer día, como en la web.
        diaMasCaro = activos.reduceOrNull { a, b -> if (b.gastoCop > a.gastoCop) b else a },
        movimientos = forMonth(transacciones, mes).size,
    )
}

/** Origen: `lib/resumenMes.ts` (`diasEnMes`). */
fun diasEnMes(mes: String): Int = mes.split("-").map(String::toInt).let { (y, m) -> YearMonth.of(y, m).lengthOfMonth() }

/** Origen: `lib/resumenMes.ts` (`esResumenMesHabilitado`). Meses pasados sí; el actual desde 2 días antes de terminar. */
fun esResumenMesHabilitado(mes: String, hoy: String): Boolean {
    val mesActual = hoy.take(7)
    if (mes < mesActual) return true
    if (mes > mesActual) return false
    return hoy.substring(8, 10).toInt() >= diasEnMes(mes) - 2
}

/** Origen: `lib/resumenMes.ts` (`diaDesbloqueoResumen`). */
fun diaDesbloqueoResumen(mes: String): Int = diasEnMes(mes) - 2
